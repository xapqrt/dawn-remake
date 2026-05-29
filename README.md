# ⚡ Dawn Remake Client

Welcome to the **Dawn Remake Client**, a heavily optimized fork of [zVipexx/dawn-client](https://github.com/zVipexx/dawn-client) (up to v1.0.9) built specifically for Kirka.io gamers. 

Our goal is simple: **Maximum FPS, Flat-line Ping, Zero Input Delay, and Cool Laptops.**

---

## 🚀 Dawn Remake vs. Dawn Client v1.0.9: What's Improved?

Here is a breakdown of why Dawn Remake runs circles around the original client:

| Feature / Fix | Original Dawn Client (v1.0.9) | Dawn Remake Client (Remake) | Why it matters to you |
| :--- | :--- | :--- | :--- |
| **Lobby & Menu Lag** | ❌ Runs menus at 350+ FPS, causing CPU lag and slow button clicks. | ✅ **Smart 60 FPS Lobby Cap** | Shop, inventory, and play buttons load instantly; CPU is saved for matches. |
| **Laptop Heating (AFK/Tab-out)** | ❌ Runs at full speed in the background, cooking your laptop. | ✅ **Thermal Guard (5/30 FPS Cap)** | Drops to 5 FPS when minimized, 30 FPS when tabbed out. Laptop stays ice cold when you're not playing. Instantly wakes back up when clicked. |
| **Ping Spikes & Jitter** | ❌ Sockets go "cold", causing periodic 80-160ms spikes. | ✅ **Flat-line Ping Tuning** | Keeps game sockets warm and active. Flat-line connection with zero random stutters or rubberbanding. |
| **Proxy Selector** | ❌ Startup redirects you to slow proxies based on fake browser page loads. | ✅ **Real WebSocket Ping Monitor** | Keeps `kirka.io` as default. Measures real in-game gameplay ping, and only offers to switch if a proxy is 50ms+ faster. |
| **App Startup Hangs** | ❌ Frequently hangs on a blank screen or fails to open on macOS. | ✅ **Async Boot & Gatekeeper Bypass** | Completely rebuilt startup loop to ensure the app opens instantly on double-click. |
| **Micro-Stutters** | ❌ Suffers from tiny freezes (garbage collection pauses) during fights. | ✅ **Zero-Allocation Game Loop** | Re-engineered scheduler uses zero-overhead memory queues, eliminating micro-stutters during combat. |
| **Input Lag** | ❌ Standard browser rendering pipeline latency. | ✅ **WebGL Direct-Draw & Metal Zero-Copy** | Bypasses layout compositor delay, drawing frames directly to screen. 8-16ms faster time-to-first-shot. |

---

## 🎨 Core Dawn Features
All base features you love are still fully supported:
- **Resource Swapper**: Swap your skins, sounds, crosshairs, and textures. Just open the swapper folder in settings.
- **Discord Rich Presence**: Show your friends when you are in the lobby or dominating in a match.
- **Auto Opener**: Instantly open packs and chests with one click.
- **Custom CSS / Themes**: Customize the UI look with custom CSS stylesheets.
- **Userscript / Adblock support**: Run your favorite scripts and block background ads.

---

## ⌨️ Hotkeys

| Hotkey | Action |
| ------ | ------ |
| **Shift (Right)** | Open Client Settings Menu |
| **F2** | Take Screenshot (Saves and copies to clipboard) |
| **F4** | Return to Lobby / Home |
| **F5** | Reload Game Client |
| **F6** | Load Custom URL |
| **F7** | Copy Current URL |
| **F11** | Toggle Fullscreen |
| **F12** | Toggle Developer Tools |

---

## 🌐 Fixing macOS Wi-Fi Ping Spikes

If you play on Wi-Fi and experience periodic ping spikes (e.g. your latency jumps to 200ms+ every few minutes), this is caused by macOS background scanning processes. Apply these three fixes to achieve flat-line ping:

### 1. Disable AirDrop/AWDL scanning (Highly Recommended)
macOS uses Apple Wireless Direct Link (AWDL) to scan for nearby Apple devices. This scanning process splits your Wi-Fi antenna's focus and spikes gaming ping.
- **To disable AWDL during gaming:** Open Terminal and run:
  ```bash
  sudo ifconfig awdl0 down
  ```
- **To enable AirDrop back after playing:** Open Terminal and run:
  ```bash
  sudo ifconfig awdl0 up
  ```

### 2. Disable Location Wi-Fi Scanning
The system location daemon (`locationd`) scans local access points to triangulate your Mac's position.
1. Open **System Settings > Privacy & Security > Location Services**.
2. Click **System Services (Details...)** at the bottom.
3. Toggle **Networking & Wireless** (or "Wi-Fi Networking") to **OFF**.

### 3. Change Router to a non-DFS Channel
If your 5GHz network is configured to use DFS (Dynamic Frequency Selection) channels (channels 52–140), macOS will periodically pause networking to listen for radar interference. Log into your router settings and manually set your 5GHz channel to a **non-DFS channel** (e.g., **36, 44, or 149**).

---

## 🛠️ Build and Install

### Prerequisites
Make sure you have [Node.js](https://nodejs.org) installed on your system.

### Build instructions
To build the application for your operating system:
```bash
# Install dependencies
npm install

# Compile the production installer (DMG for macOS, EXE for Windows)
npm run build
```
The finished package will be saved in the `build/` folder.
