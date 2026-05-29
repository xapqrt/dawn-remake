const { app } = require("electron");
const { applySwitches } = require("./util/switches");
const os = require("os");

// ─── Set OS scheduling priority to high ─────────────────────────────────────────
try {
  os.setPriority(0, -10);
  console.log(`[DawnClient] Main process CPU priority set to high:`, os.getPriority());
} catch (e) {
  console.error("[DawnClient] Failed to set main process CPU priority:", e);
}

// ─── Apply Chromium command-line switches BEFORE the app is ready ─────────────
// This is the ONLY place these should be set. They must come before app.ready.
const Store = require("electron-store");
const { default_settings } = require("./util/defaults.json");

const store = new Store();
if (!store.has("settings")) store.set("settings", default_settings);
const settings = store.get("settings");

applySwitches(settings);

// ─── App lifecycle ─────────────────────────────────────────────────────────────
app.on("ready", () => {
  const { initSplash } = require("./windows/splash");
  const { initResourceSwapper } = require("./addons/swapper");
  initSplash();
  initResourceSwapper();
});

app.on("window-all-closed", () => app.quit());
