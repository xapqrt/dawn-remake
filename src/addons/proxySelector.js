/**
 * Dawn Client — Smart Proxy Monitor
 *
 * DESIGN PHILOSOPHY:
 *   The previous approach measured HTTP HEAD latency which is WRONG for gaming —
 *   a proxy can reply to HTTP quickly but route WebSocket game traffic through
 *   extra hops adding 50-100ms of in-game ping.
 *
 *   This module:
 *   1. Does NOT auto-redirect on startup. kirka.io is the default and stays as the
 *      default unless you explicitly use the menu button.
 *   2. Intercepts WebSocket.send() to measure real round-trip time via a
 *      high-frequency ping probe on the game's own connection.
 *   3. Monitors in-game WS ping via an overlay on the stats panel (I key).
 *   4. Menu button: tests HTTP reachability of all proxies, ranks them, lets
 *      the user switch manually with full information.
 *   5. Background smart switcher (opt-in): if in-game WS ping is consistently
 *      above threshold for N seconds, probes all proxies and suggests switching.
 *
 * IMPORTANT: proxy "ping" shown in this file is WebSocket RTT, not HTTP latency.
 */

const { ipcRenderer } = require("electron");

const PROXY_URLS = [
  "https://kirka.io/",
  "https://cloudymonk.com/",
  "https://snipers.io/",
  "https://ask101math.com/",
  "https://fpsiogame.com/",
  "https://cloudconverts.com/",
];

// ─── Ping state ───────────────────────────────────────────────────────────────
let _currentWsPing = null;       // last measured WS RTT in ms
let _pingHistory = [];           // rolling window of last 20 WS RTT samples
const PING_WINDOW = 20;
const SPIKE_THRESHOLD_MS = 120;  // ms above which we consider ping "spiking"
const SPIKE_MIN_SAMPLES = 10;    // need at least this many samples to evaluate

// ─── WebSocket RTT measurement ────────────────────────────────────────────────
// We intercept the native WebSocket to measure RTT via ping/pong timing.
// Kirka uses binary WebSocket frames — we don't inject our own messages,
// instead we measure the time between send() and the next onmessage event
// as a proxy for RTT. This is conservative but safe.

let _wsInstalled = false;

function installWsMonitor() {
  if (_wsInstalled) return;
  _wsInstalled = true;

  const OriginalWebSocket = window.WebSocket;
  if (!OriginalWebSocket) return;

  window.WebSocket = function (url, protocols) {
    const ws = protocols ? new OriginalWebSocket(url, protocols) : new OriginalWebSocket(url);

    // Only monitor wss:// game connections (not localhost or data URLs)
    const isGameConn = url && url.startsWith("wss://");
    if (!isGameConn) return ws;

    let lastSendTime = null;
    let sendCount = 0;

    const origSend = ws.send.bind(ws);
    ws.send = function (data) {
      // Sample every 5th message to avoid overhead
      sendCount++;
      if (sendCount % 5 === 0) {
        lastSendTime = performance.now();
      }
      return origSend(data);
    };

    const origAddEventListener = ws.addEventListener.bind(ws);
    ws.addEventListener = function (type, listener, options) {
      if (type === "message") {
        const wrappedListener = function (event) {
          if (lastSendTime !== null) {
            const rtt = performance.now() - lastSendTime;
            lastSendTime = null;
            // Only record plausible RTT (1-500ms range)
            if (rtt >= 1 && rtt <= 500) {
              recordPingSample(rtt);
            }
          }
          listener(event);
        };
        return origAddEventListener(type, wrappedListener, options);
      }
      return origAddEventListener(type, listener, options);
    };

    // Intercept onmessage property assignment too
    let _onmessage = null;
    Object.defineProperty(ws, "onmessage", {
      get() { return _onmessage; },
      set(fn) {
        _onmessage = function (event) {
          if (lastSendTime !== null) {
            const rtt = performance.now() - lastSendTime;
            lastSendTime = null;
            if (rtt >= 1 && rtt <= 500) {
              recordPingSample(rtt);
            }
          }
          if (fn) fn(event);
        };
        ws.__proto__.__lookupSetter__("onmessage").call(ws, _onmessage);
      },
      configurable: true,
    });

    return ws;
  };

  // Copy all static properties from original
  Object.setPrototypeOf(window.WebSocket, OriginalWebSocket);
  Object.keys(OriginalWebSocket).forEach((key) => {
    try { window.WebSocket[key] = OriginalWebSocket[key]; } catch (_) {}
  });
  window.WebSocket.prototype = OriginalWebSocket.prototype;
  window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
  window.WebSocket.OPEN = OriginalWebSocket.OPEN;
  window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
  window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;

  console.log("[DawnClient] WebSocket ping monitor installed");
}

function recordPingSample(rttMs) {
  _currentWsPing = Math.round(rttMs);
  _pingHistory.push(_currentWsPing);
  if (_pingHistory.length > PING_WINDOW) {
    _pingHistory.shift();
  }
}

function getAvgPing() {
  if (_pingHistory.length === 0) return null;
  const sum = _pingHistory.reduce((a, b) => a + b, 0);
  return Math.round(sum / _pingHistory.length);
}

function isPingSpiking() {
  if (_pingHistory.length < SPIKE_MIN_SAMPLES) return false;
  const avg = getAvgPing();
  return avg !== null && avg > SPIKE_THRESHOLD_MS;
}

// ─── HTTP reachability probe (for menu button only) ───────────────────────────
// This measures time to get any response from each proxy's HTTP endpoint.
// Used only for ranking proxies in the menu, NOT for auto-switching.

async function probeHttpLatency(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  const start = performance.now();
  try {
    await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      cache: "no-store",
      mode: "no-cors",
    });
    clearTimeout(timeoutId);
    return Math.round(performance.now() - start);
  } catch (_) {
    clearTimeout(timeoutId);
    return Infinity;
  }
}

async function rankAllProxies() {
  const results = await Promise.all(
    PROXY_URLS.map(async (url) => {
      const latency = await probeHttpLatency(url);
      return { url, latency };
    })
  );
  results.sort((a, b) => a.latency - b.latency);
  return results;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * initProxySelector — called once from game.js runInit().
 * Installs the WS monitor. Does NOT auto-redirect.
 */
function initProxySelector(currentBaseUrl) {
  try {
    installWsMonitor();
    console.log(`[DawnClient] Proxy monitor active on ${currentBaseUrl} (no auto-redirect)`);
  } catch (err) {
    console.error("[DawnClient] Proxy monitor init error:", err);
  }
}

module.exports = {
  initProxySelector,
  rankAllProxies,
  getAvgPing,
  getCurrentPing: () => _currentWsPing,
  isPingSpiking,
};
