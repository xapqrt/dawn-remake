const { app } = require("electron");
const { applySwitches } = require("./util/switches");

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
