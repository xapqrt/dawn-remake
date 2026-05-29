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

  // ─── Network: low-latency, no proxy overhead, no background noise ────────────
  // no-proxy-server: skip WPAD/PAC proxy lookups → saves ~20-150 ms on WS connect
  app.commandLine.appendSwitch("no-proxy-server");
  // Async DNS: resolve hostnames off the main thread (prevents DNS stall spikes)
  app.commandLine.appendSwitch("enable-async-dns");
  // TCP Fast Open: send data in the first SYN packet (reduces RTT by 1 round trip)
  app.commandLine.appendSwitch("enable-tcp-fastopen");
  // Suppress device-discovery multicast noise on the local network
  app.commandLine.appendSwitch("disable-device-discovery-notifications");
  // Disables all background network queries (updates, telemetry, etc.) to eliminate ping spikes
  app.commandLine.appendSwitch("disable-background-networking");
  app.commandLine.appendSwitch("disable-client-side-phishing-detection");
  app.commandLine.appendSwitch("disable-component-update");
  app.commandLine.appendSwitch("disable-default-apps");
  app.commandLine.appendSwitch("disable-domain-reliability");
  app.commandLine.appendSwitch("disable-sync");
  app.commandLine.appendSwitch("no-first-run");
  app.commandLine.appendSwitch("no-default-browser-check");

  // ─── Low-Latency WebGL & Graphics Compositing optimizations ─────────────────
  app.commandLine.appendSwitch("enable-webgl-image-chromium");
  app.commandLine.appendSwitch("enable-drdc");
  app.commandLine.appendSwitch("enable-hardware-overlays");

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
  ];

  const disableFeatures = [
    // Prevents macOS window occlusion from throttling the renderer when switching apps
    "CalculateNativeWinOcclusion",
    "UseChromeOSDirectVideoDecoder",
    // Unnecessary UI features — saves renderer init time
    "ChromeWhatsNewUI",
    "IPHSidePanelGenericMenuFeature",
    // Disables background Safe Browsing URL lookups and fetches to prevent network jitter
    "SafeBrowsing",
    "BackgroundFetch",
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
