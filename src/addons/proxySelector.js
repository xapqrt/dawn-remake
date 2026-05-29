/**
 * Dawn Client — Auto Proxy Selector
 *
 * On startup, pings all known Kirka.io mirrors/proxies and automatically
 * switches to the fastest one. Results are cached for 5 minutes to prevent
 * excessive network probing during gameplay.
 *
 * Proxy list comes from defaults.json (allowed_urls) and is injected via
 * ipcRenderer.sendSync("get-settings") → settings.
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

const CACHE_KEY = "dawn-proxy-best-url";
const CACHE_TIME_KEY = "dawn-proxy-best-url-time";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Measures latency to a URL by fetching the root document.
 * Returns Infinity if unreachable.
 * Uses a 3-second timeout to avoid hanging.
 */
async function pingUrl(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  const start = performance.now();
  try {
    await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      cache: "no-store",
      mode: "no-cors", // no-cors lets us probe cross-origin without CORS errors
    });
    clearTimeout(timeoutId);
    return performance.now() - start;
  } catch (_) {
    clearTimeout(timeoutId);
    return Infinity;
  }
}

/**
 * Pings all proxies in parallel and returns the URL with the lowest latency.
 */
async function findBestProxy() {
  const results = await Promise.all(
    PROXY_URLS.map(async (url) => {
      const latency = await pingUrl(url);
      return { url, latency };
    })
  );

  results.sort((a, b) => a.latency - b.latency);
  console.log(
    "[DawnClient] Proxy latencies:",
    results.map((r) => `${r.url.replace("https://", "").replace("/", "")}=${r.latency === Infinity ? "UNREACHABLE" : Math.round(r.latency) + "ms"}`).join(", ")
  );

  const best = results.find((r) => r.latency !== Infinity);
  return best ? best.url : null;
}

/**
 * Main entry point — called from game.js during runInit().
 * Checks cache first, then probes if stale.
 * If the best proxy differs from current settings.base_url, notifies main process.
 */
async function initProxySelector(currentBaseUrl) {
  try {
    const now = Date.now();
    const cachedUrl = localStorage.getItem(CACHE_KEY);
    const cachedTime = parseInt(localStorage.getItem(CACHE_TIME_KEY) || "0", 10);

    let bestUrl = null;

    if (cachedUrl && (now - cachedTime) < CACHE_TTL_MS) {
      bestUrl = cachedUrl;
      console.log(`[DawnClient] Proxy cache hit: ${bestUrl} (expires in ${Math.round((CACHE_TTL_MS - (now - cachedTime)) / 1000)}s)`);
    } else {
      console.log("[DawnClient] Probing proxy latencies...");
      bestUrl = await findBestProxy();
      if (bestUrl) {
        localStorage.setItem(CACHE_KEY, bestUrl);
        localStorage.setItem(CACHE_TIME_KEY, now.toString());
        console.log(`[DawnClient] Best proxy selected: ${bestUrl}`);
      }
    }

    if (bestUrl && bestUrl !== currentBaseUrl) {
      console.log(`[DawnClient] Switching base_url from ${currentBaseUrl} to ${bestUrl}`);
      // Persist the new base_url to settings so next launch uses it
      ipcRenderer.send("update-setting", "base_url", bestUrl);
      // Redirect the window to the better proxy
      // Small delay to let the setting flush before navigation
      setTimeout(() => {
        if (window.location.href.startsWith(currentBaseUrl)) {
          window.location.href = bestUrl;
        }
      }, 500);
    } else {
      console.log(`[DawnClient] Already on best proxy: ${currentBaseUrl}`);
    }
  } catch (err) {
    console.error("[DawnClient] Proxy selector error:", err);
  }
}

module.exports = { initProxySelector };
