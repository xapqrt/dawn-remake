const { app, session, protocol, net } = require("electron");
const path = require("path");
const fs = require("fs");
const url = require("url");

const initResourceSwapper = () => {
  protocol.handle("dawnclient", (request) => {
    const rawPath = decodeURIComponent(request.url.slice("dawnclient://".length));
    return net.fetch(url.pathToFileURL(rawPath).toString());
  });

  const SWAP_FOLDER = path.join(
    app.getPath("documents"),
    "DawnClient",
    "swapper"
  );
  const assetsFolder = path.join(SWAP_FOLDER, "assets");
  const folders = ["css", "media", "img", "js"];
  let folder_regex_generator = "DawnClient[\\\\/]swapper[\\\\/]assets[\\\\/](";
  folder_regex_generator += folders.join("|");
  folder_regex_generator += ")[\\\\/][^\\\\/]+\\.[^.]+$";
  let folder_regex = new RegExp(folder_regex_generator, "");

  try {
    if (!fs.existsSync(assetsFolder))
      fs.mkdirSync(assetsFolder, { recursive: true });
    folders.forEach((folder) => {
      const folderPath = path.join(assetsFolder, folder);
      if (!fs.existsSync(folderPath))
        fs.mkdirSync(folderPath, { recursive: true });
    });
  } catch (e) {
    console.error(e);
  }

  const swap = {
    filter: { urls: [] },
    files: {},
  };

  const proxyUrls = [
    "snipers.io",
    "ask101math.com",
    "fpsiogame.com",
    "cloudconverts.com",
    "kirka.io",
  ];

  const allFilesSync = (dir) => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const filePath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          allFilesSync(filePath);
        } else {
          const useAssets = folder_regex.test(filePath);
          if (!useAssets || filePath.toLowerCase().endsWith(".glb")) continue;

          proxyUrls.forEach((proxy) => {
            const kirk = `*://${proxy}${filePath.replace(SWAP_FOLDER, "").replace(/\\/g, "/")}*`;
            const matchResult = kirk.match(/\/[^\/]+\.(?:[a-zA-Z0-9]+)\*/gi);
            if (!matchResult) return;
            const origfilterurl = matchResult[0];
            let filterurl = origfilterurl.replace(/\_/g, "");
            filterurl = filterurl.replace("/", "/*");
            filterurl = filterurl.replace(".", "*.*");
            swap.filter.urls.push(kirk.replace(origfilterurl, filterurl));
            swap.files[kirk.replace(/\*|_/g, "")] = url.format({
              pathname: filePath,
              protocol: "",
              slashes: false,
            });
          });
        }
      }
    } catch (e) {
      console.error("[DawnClient Swapper] Dir scan error:", e);
    }
  };

  allFilesSync(SWAP_FOLDER);

  if (swap.filter.urls.length) {
    session.defaultSession.webRequest.onBeforeRequest(
      swap.filter,
      (details, callback) => {
        const redirect =
          "dawnclient://" +
          (swap.files[details.url.replace(/https|http|(\?.*)|(#.*)|\_/gi, "")] ||
            details.url);
        callback({ cancel: false, redirectURL: redirect });
      }
    );
  }
};

module.exports = { initResourceSwapper };
