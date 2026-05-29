const { app } = require("electron");
const dns = require("dns").promises;

async function startApp() {
  try {
    const domains = ["kirka.io", "api.kirka.io", "api2.kirka.io"];
    const mappings = [];
    
    // Resolve all domains in parallel to minimize startup delay
    const resolvePromise = Promise.all(
      domains.map(async (domain) => {
        try {
          const ips = await dns.resolve4(domain);
          if (ips && ips.length > 0) {
            mappings.push(`MAP ${domain} ${ips[0]}`);
          }
        } catch (_) {}
      })
    );

    // Bound DNS query time to 150ms so startup remains instant even on offline / DNS lag scenarios
    await Promise.race([
      resolvePromise,
      new Promise((resolve) => setTimeout(resolve, 150))
    ]);

    if (mappings.length > 0) {
      const rules = mappings.join(", ");
      app.commandLine.appendSwitch("host-rules", rules);
      console.log("[DawnClient] Local DNS host-rules mapped:", rules);
    }
  } catch (e) {
    console.error("[DawnClient] DNS pre-resolve skipped:", e);
  }

  app.on("ready", async () => {
    const { initSplash } = require("./windows/splash");
    const { initResourceSwapper } = require("./addons/swapper");
    initSplash();
    initResourceSwapper();
  });
}

app.on("window-all-closed", () => app.quit());

startApp();
