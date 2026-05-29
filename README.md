# Dawn Remake Client

A highly optimized Electron client for Kirka.io built to deliver the absolute lowest input latency and most stable ping.

---

## ⚡ The Dawn Remake Optimization Layer
This version is an optimized fork of [zVipexx/dawn-client](https://github.com/zVipexx/dawn-client) engineered to resolve input delay, micro-stutters, and network jitter:

### 1. High-Precision Single-Master-Loop Scheduler
* **The Problem in Base Client:** The default browser-level implementation of nested timers enforces a **4ms minimum clamp** on `setTimeout`, capping rendering loops to a maximum of 200-250 FPS. Scheduling a separate timer for every game script callback also wasted CPU and caused thermal throttling on M-series Macs.
* **Our Solution:** Built a single, unified master tick scheduler.
  - All callbacks are queued and executed in a single high-performance batch.
  - Uses `MessageChannel` port messaging (`postMessage` macrotasks) for sub-millisecond, non-clamped event loop yielding.
  - Dynamically switches to `setTimeout` only for long sleeps to protect CPU thermals, maintaining a rock-solid **300-350+ FPS** (up to a 370 FPS cap).

### 2. Bypassing Compositor Latency (Lowest First-Shot Delay)
* Intercepts WebGL canvas context requests at evaluation-start and applies:
  - `desynchronized: true`: Bypasses double-buffered compositor pipeline queues, drawing WebGL output directly to screen presentation layers. This eliminates 1-2 frames (**8-16ms**) of input-to-display latency, giving you the fastest time-to-first-shot.
  - `powerPreference: "high-performance"`: Requests discrete GPU cores (or high-performance graphics clusters) directly for the WebGL pipeline.

### 3. Background Network Isolation (Zero Ping Spikes)
* Applied Chromium command-line switches to shut down background browser threads that run diagnostic queries, telemetry, and updates:
  - `disable-background-networking` (stops background fetches)
  - `disable-client-side-phishing-detection` (stops safe-browsing real-time checks)
  - `disable-component-update` (disables background plugin downloads)
  - `disable-sync` / `disable-domain-reliability`
  - Disabled `SafeBrowsing` and `BackgroundFetch` features.
* **Result:** The client's WebSockets operate in near-total isolation from background traffic, resolving casual latency spikes and rubberbanding.

### 4. Dynamic VSync & Core GPU Optimization
* Restored native VSync toggling. Disabling "Unlimited FPS" completely suspends the scheduler and locks the client to your monitor's native refresh rate (e.g. 120Hz ProMotion) with zero overhead.
* Enabled modern GPU pipeline optimization flags:
  - `enable-webgl-image-chromium` (direct WebGL presentation layers)
  - `enable-drdc` (dual-threaded rendering thread)
  - `enable-hardware-overlays` (bypasses composition lag)

---

## 🎨 Base Features
All core Dawn Client features are fully supported:
- Discord Rich Presence
- Custom Resource Swapper (Skins, Sounds, Crosshairs, CSS, etc.)
- Userscripts & Adblock support
- Pack/Chest Auto Opener
- Map Images in Server List & Unofficial Lobby News
- Custom Listing Prices & Seller Username resolution in the Market
- Skip Loading Screen & Fullscreen shortcuts

## ⌨️ Hotkeys
| Hotkey | Description |
| ------ | ----------- |
| **F2** | Take screenshot and copy to clipboard |
| **F4** | Return to https://kirka.io |
| **F5** | Reload client |
| **F6** | Load URL |
| **F7** | Copy current URL |
| **F11**| Toggle Fullscreen |
| **F12 / Ctrl+Shift+I** | Open Developer Tools |

---

## 🛠️ Build & Installation

### Prerequites
Ensure you have [Node.js](https://nodejs.org) installed on your system.

### Build Executable (DMG / EXE)
To compile the production distribution package:
```bash
# Install dependencies
npm install

# Build the client DMG (macOS) or setup executable (Windows)
npm run build
```
The compiled binaries will be outputted to the `build/` directory.

---

## Credits
* **zVipexx** (Base Dawn Client)
* **irrvlo** (Juice Client concept)
* **AwesomeSam** (Resource Swapper)
* **Cheeseburger** (Auto Opener)
* **Error430** & **robertpakalns** (Base tweaks)
