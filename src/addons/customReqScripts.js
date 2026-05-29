// from CarrySheriff!

const customReqScripts = (settings) => {
  const originalXHR = window.XMLHttpRequest;
  const originalFetch = window.fetch;
  const { base_url, custom_list_price, market_names } = settings;
  let ids = [];
  let newprice;
  let updating = false;
  const profileCache = new Map();

  // Intercept fetch responses to capture market seller IDs
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input.url;
    const response = await originalFetch.apply(this, arguments);
    if (url && (url.includes("/api/market") || url.includes("market"))) {
      try {
        const clone = response.clone();
        const data = await clone.json();
        console.log("[DawnClient] Intercepted fetch market response:", data);
        let marketItems = [];
        if (Array.isArray(data)) {
          marketItems = data;
        } else if (data && typeof data === "object") {
          marketItems = data.data || data.items || data.list || [];
        }
        if (Array.isArray(marketItems) && marketItems.length > 0) {
          ids = marketItems.map(
            (item) =>
              item.userId ||
              item.sellerId ||
              item.user?.id ||
              item.seller?.id ||
              ""
          );
          console.log("[DawnClient] Extracted market seller IDs (fetch):", ids);
        }
      } catch (e) {
        console.error("[DawnClient] Error intercepting fetch market response:", e);
      }
    }
    return response;
  };

  // Intercept XHR responses to capture market seller IDs
  window.XMLHttpRequest = function () {
    const xhr = new originalXHR();
    let requestUrl = "";

    xhr.open = function (method, url, ...args) {
      requestUrl = url;
      originalXHR.prototype.open.apply(this, [method, url, ...args]);
    };

    xhr.addEventListener("readystatechange", function () {
      if (xhr.readyState === 4 && xhr.status === 200) {
        if (requestUrl && (requestUrl.includes("/api/market") || requestUrl.includes("market"))) {
          try {
            const data = JSON.parse(xhr.responseText);
            console.log("[DawnClient] Intercepted XHR market response:", data);
            let marketItems = [];
            if (Array.isArray(data)) {
              marketItems = data;
            } else if (data && typeof data === "object") {
              marketItems = data.data || data.items || data.list || [];
            }
            if (Array.isArray(marketItems) && marketItems.length > 0) {
              ids = marketItems.map(
                (item) =>
                  item.userId ||
                  item.sellerId ||
                  item.user?.id ||
                  item.seller?.id ||
                  ""
              );
              console.log("[DawnClient] Extracted market seller IDs (XHR):", ids);
            }
          } catch (e) {
            console.error("[DawnClient] Error intercepting XHR market response:", e);
          }
        }
      }
    });

    xhr.send = function (data) {
      if (
        requestUrl &&
        requestUrl.includes(`api2.${base_url.replace("https://", "")}`) &&
        location.href === `${base_url}inventory` &&
        document.querySelector(".vm--container > .vm--modal > .wrapper-modal")?.id !== "sell-item-modal" &&
        data &&
        newprice &&
        custom_list_price
      ) {
        try {
          const json = JSON.parse(data);
          if (Object.keys(json).length === 2) {
            for (let key in json) {
              if (typeof json[key] === "number" && json[key] !== 0) {
                json[key] = newprice;
              }
            }
          }
          data = JSON.stringify(json);
        } catch { }
      }
      originalXHR.prototype.send.call(this, data);
    };

    return xhr;
  };

  async function marketUsers() {
    const itemElements = Array.from(document.getElementsByClassName("item-name"));
    if (itemElements.length === 0) {
      updating = false;
      return;
    }

    console.log(`[DawnClient] Resolving usernames for ${itemElements.length} market items`);

    const promises = itemElements.map(async (elem, i) => {
      const sellerId = ids[i];
      if (!sellerId) return;

      // 1. Check cache first
      if (profileCache.has(sellerId)) {
        const cached = profileCache.get(sellerId);
        if (cached) {
          elem.innerText = elem.innerText.split(" - ")[0] + ` - ${cached.name}#${cached.shortId}`;
        }
        return;
      }

      // 2. Stagger requests slightly to prevent spamming
      try {
        await new Promise((resolve) => setTimeout(resolve, i * 50));
        let fetchreq = await originalFetch(`https://api.kirka.io/api/user/getProfile`, {
          headers: {
            accept: "application/json, text/plain, */*",
            "content-type": "application/json;charset=UTF-8",
            Referer: base_url,
            "Referrer-Policy": "strict-origin-when-cross-origin",
          },
          body: `{"id":"${sellerId}"}`,
          method: "POST",
        });
        
        if (!fetchreq.ok) throw new Error(`HTTP error ${fetchreq.status}`);
        const profile = await fetchreq.json();
        
        if (profile && profile.shortId) {
          profileCache.set(sellerId, { name: profile.name, shortId: profile.shortId });
          elem.innerText = elem.innerText.split(" - ")[0] + ` - ${profile.name}#${profile.shortId}`;
        }
      } catch (err) {
        console.error(`[DawnClient] Failed to fetch market user profile for ${sellerId}:`, err);
      }
    });

    try {
      await Promise.all(promises);
    } catch (e) {
      console.error("[DawnClient] Error resolving market users:", e);
    } finally {
      updating = false;
    }
  }

  const inputElem = Object.assign(document.createElement("input"), {
    id: "juice-custom-listing",
    type: "number",
    min: "0",
    placeholder: "Custom amount",
    onchange: (e) => (newprice = Number(e.target.value)),
  });

  Object.assign(inputElem.style, {
    marginTop: "-.5em",
    marginBottom: "1em",
    border: ".125rem solid #202639",
    outline: "none",
    background: "#2f3957",
    width: "50%",
    height: "2.875rem",
    paddingLeft: ".5rem",
    boxSizing: "border-box",
    fontWeight: "600",
    fontSize: "1rem",
    color: "#f2f2f2",
    boxShadow: "0 1px 2px rgba(0,0,0,.4), inset 0 0 8px rgba(0,0,0,.4)",
    borderRadius: ".25rem",
  });

  const observer = new MutationObserver(() => {
    if (window.location.href === `${base_url}inventory` && custom_list_price) {
      const sellElem = document.querySelector(".cont-sell");
      if (sellElem && !document.getElementById("juice-custom-listing") && sellElem.parentElement.parentElement.id !== "sell-item-modal") {
        sellElem.children[1].after(inputElem);
      }
    }

    if (
      window.location.href === `${base_url}hub/market` &&
      document.getElementsByClassName("subjects").length === 2 &&
      !document
        .getElementsByClassName("item-name")[0]
        ?.innerText.includes(" - ") &&
      !updating &&
      ids.length > 0 &&
      market_names
    ) {
      updating = true;
      marketUsers();
    }
  });

  const startObserver = () => {
    observer.observe(document.body, { childList: true, subtree: true });
    console.log("[DawnClient] customReqScripts MutationObserver attached.");
  };

  const stopObserver = () => {
    observer.disconnect();
    console.log("[DawnClient] customReqScripts MutationObserver detached.");
  };

  document.addEventListener("dawn-url-change", ({ detail: url }) => {
    if (url === `${base_url}inventory` || url === `${base_url}hub/market`) {
      startObserver();
    } else {
      stopObserver();
    }
  });

  if (window.location.href === `${base_url}inventory` || window.location.href === `${base_url}hub/market`) {
    startObserver();
  }
};

module.exports = { customReqScripts };
