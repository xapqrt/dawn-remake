const { app } = require("electron");

function applySwitches(settings) {
  // ─── Unlock GPU frame rate (required so our JS master-loop can control FPS) ──
  // Without these two, Chromium clamps to display refresh rate (60/120 Hz) and
  // the JS scheduler can never push beyond that. With them, the GPU renders as
  // fast as our JS queue drains — and the JS queue IS the cap.
  if (settings.unlimited_fps) {
    app.commandLine.appendSwitch("disable-frame-rate-limit");
    app.commandLine.appendSwitch("disable-gpu-vsync");
  }

  // ─── GPU pipeline: force hardware acceleration, Metal path, zero-copy ────────
  app.commandLine.appendSwitch("ignore-gpu-blacklist");
  app.commandLine.appendSwitch("ignore-gpu-blocklist");
  app.commandLine.appendSwitch("enable-gpu-rasterization");
  app.commandLine.appendSwitch("enable-zero-copy");
  app.commandLine.appendSwitch("enable-oop-rasterization");
  app.commandLine.appendSwitch("disable-software-rasterizer");
  app.commandLine.appendSwitch("enable-webgl-draft-extensions");
  app.commandLine.appendSwitch("gpu-no-context-lost");
  // Force lowest possible GPU latency: bypass GPU process sandboxing (lower IPC overhead)
  app.commandLine.appendSwitch("disable-gpu-sandbox");
  // Disable GPU watchdog thread to prevent recurring polling micro-stutters
  app.commandLine.appendSwitch("disable-gpu-watchdog");
  // Set MSAA sample count to 0 for GPU rasterization to optimize WebGL canvas drawing speed
  app.commandLine.appendSwitch("gpu-rasterization-msaa-sample-count", "0");

  // ─── Apple Silicon / Metal-specific optimisations ─────────────────────────────
  if (process.platform === "darwin") {
    app.commandLine.appendSwitch("enable-native-gpu-memory-buffers");
    app.commandLine.appendSwitch("high-dpi-support", "1");
    // Tell Chromium there are 4 GB of GPU memory available — prevents fallback
    // to software paths when the GPU memory budget heuristic is hit
    app.commandLine.appendSwitch("force-gpu-mem-available-mb", "4096");
    // Map textures directly to GPU buffers, eliminating double-copy overhead and laptop heat
    app.commandLine.appendSwitch("enable-gpu-memory-buffer-compositor-resources");
    app.commandLine.appendSwitch("enable-gpu-memory-buffer-video-frames");
  }

  // ─── Prevent background throttling, App Nap, or occlusion-based CPU cuts ─────
  app.commandLine.appendSwitch("disable-background-timer-throttling");
  app.commandLine.appendSwitch("disable-renderer-backgrounding");
  app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");

  // ─── Input latency: bypass IPC flood protection for 1000Hz+ mice ──────────────
  app.commandLine.appendSwitch("disable-ipc-flooding-protection");

  // ─── Rendering: sRGB color profile (avoids Display-P3 wide-gamut conversion) ──
  app.commandLine.appendSwitch("force-color-profile", "srgb");

  // ─── V8 / JS engine: stable optimisation flags for V8 13.x (Electron 38) ─────
  // Only stable flags — experimental ones crash the renderer in Electron 38
  app.commandLine.appendSwitch("js-flags",
    "--turbo-fast-api-calls " +
    "--harmony " +
    "--max_semi_space_size=128 " +
    "--min_semi_space_size=128"
  );

  // ─── Network: targeted noise suppression, WebSocket-safe ─────────────────────
  // REMOVED: --disable-background-networking — this flag kills Chromium's TCP/WS
  //   keep-alive infrastructure and causes WebSocket connections to go cold,
  //   producing exactly the 80-160ms periodic ping spikes the user reported.
  // REMOVED: --disable-domain-reliability — this also interferes with connection
  //   monitoring and makes WS reconnects slower.
  //
  // Instead, only suppress things that are truly noise:
  // Suppress mDNS/SSDP device-discovery multicast noise
  app.commandLine.appendSwitch("disable-device-discovery-notifications");
  // Kill phishing detection (fetches URLs in the background, causes network jitter)
  app.commandLine.appendSwitch("disable-client-side-phishing-detection");
  // Kill Chromium auto-update checks (background fetches)
  app.commandLine.appendSwitch("disable-component-update");
  app.commandLine.appendSwitch("disable-default-apps");
  // Kill sync (background network traffic)
  app.commandLine.appendSwitch("disable-sync");
  app.commandLine.appendSwitch("no-first-run");
  app.commandLine.appendSwitch("no-default-browser-check");
  // Async DNS resolver: resolves hostnames off the main thread (prevents DNS stall spikes)
  app.commandLine.appendSwitch("enable-async-dns");
  // TCP Fast Open: allows sending data on initial handshake, reducing WS handshake RTT
  app.commandLine.appendSwitch("enable-tcp-fast-open");
  // Disable low-end device mode to prevent Chromium from throttling rendering threads
  app.commandLine.appendSwitch("disable-low-end-device-mode");

  // ─── Low-Latency WebGL & Graphics Compositing ────────────────────────────────
  app.commandLine.appendSwitch("enable-webgl-image-chromium");
  app.commandLine.appendSwitch("enable-drdc");
  app.commandLine.appendSwitch("enable-hardware-overlays");
  // Prevents per-frame driver overhead that causes GPU ms spikes in WebGL apps
  app.commandLine.appendSwitch("disable-gpu-driver-bug-workarounds");
  // Use begin-frame scheduling for lower GPU submission latency
  app.commandLine.appendSwitch("enable-begin-frame-scheduling");

  // ─── Feature flags (SINGLE call each — Chromium ignores all but the last) ─────
  const enableFeatures = [
    // Canvas rendered on GPU thread, freeing the main JS thread
    "CanvasOopRasterization",
    // WASM SIMD: ARM NEON on M-series = huge speedup for game physics/collisions
    "WebAssemblySimd",
    // Multi-threaded WASM
    "WebAssemblyThreads",
    // Required for threaded WASM
    "SharedArrayBuffer",
    // Metal-backed Skia renderer — Electron 38 default on macOS
    "SkiaGraphite",
    // Hardware video decode (cuts CPU usage during video playback/cutscenes)
    "VaapiVideoDecoder",
    // WebSocket over HTTP/3 QUIC — lower RTT on modern routers (Chrome 116+)
    "WebSocketOverHttp3",
  ];

  const disableFeatures = [
    // Prevents macOS window occlusion from throttling the renderer when switching apps
    "CalculateNativeWinOcclusion",
    "UseChromeOSDirectVideoDecoder",
    // Unnecessary UI features — saves renderer init time
    "ChromeWhatsNewUI",
    "IPHSidePanelGenericMenuFeature",
    // Safe Browsing does background URL fetches that cause network jitter in-game
    "SafeBrowsing",
    // BackgroundFetch API — can trigger background downloads during gameplay
    "BackgroundFetch",
    // Speculative prerendering — wastes bandwidth on pages we didn't navigate to
    "Prerender2",
  ];

  // On non-macOS platforms, disable Metal/Graphite (not available there)
  if (process.platform !== "darwin") {
    disableFeatures.push("SkiaGraphite");
  }

  app.commandLine.appendSwitch("enable-features",  enableFeatures.join(","));
  app.commandLine.appendSwitch("disable-features", disableFeatures.join(","));

  // ─── In-process GPU: Windows-only, user-controlled ───────────────────────────
  // Reduces GPU↔renderer IPC overhead on Windows. Not safe on macOS (causes hang).
  if (settings.in_process_gpu && process.platform !== "darwin") {
    app.commandLine.appendSwitch("in-process-gpu");
  }
}

module.exports = { applySwitches };
