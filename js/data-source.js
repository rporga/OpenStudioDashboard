(function () {
  const requiredCollections = ["markets", "assets", "finance", "data_status"];
  const requiredAssetFields = ["fiscal_year", "month", "quarter", "market_id", "content_typology", "asset_type", "delivery_status", "asset_volume"];
  const requiredFinanceFields = ["fiscal_year", "market_id", "q2rf_budget_usd000", "approved_am_net_fee_usd000", "actual_spend_usd000"];

  function isPresent(value) {
    return value !== null && value !== undefined && value !== "";
  }

  function validate(data) {
    if (!data || typeof data !== "object") throw new Error("The data source did not return a valid object.");
    requiredCollections.forEach((key) => {
      if (!Array.isArray(data[key])) throw new Error(`Required collection “${key}” is missing.`);
    });
    const marketIds = new Set(data.markets.map((market) => market.id));
    if (marketIds.size !== data.markets.length) throw new Error("Market IDs must be unique.");
    data.assets.forEach((record, index) => {
      requiredAssetFields.forEach((field) => {
        if (!isPresent(record[field])) throw new Error(`Asset record ${index + 1} is missing “${field}”.`);
      });
      if (!marketIds.has(record.market_id)) throw new Error(`Asset record ${index + 1} uses an unknown market.`);
      if (!Number.isFinite(Number(record.asset_volume))) throw new Error(`Asset record ${index + 1} has an invalid volume.`);
    });
    data.finance.forEach((record, index) => {
      requiredFinanceFields.forEach((field) => {
        if (!(field in record)) throw new Error(`Finance record ${index + 1} is missing “${field}”.`);
      });
      if (!marketIds.has(record.market_id)) throw new Error(`Finance record ${index + 1} uses an unknown market.`);
    });
    return data;
  }

  async function fetchJson(url) {
    if (!url) throw new Error("No data URL is configured.");
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Data request failed with status ${response.status}.`);
    return validate(await response.json());
  }

  async function load() {
    const config = window.DATA_CONFIG || {};
    if (config.mode === "online") {
      try {
        return { data: await fetchJson(config.onlineUrl), source: "online", usedFallback: false };
      } catch (error) {
        if (!config.fallbackToLocal) throw error;
        const data = await fetchJson(config.localUrl);
        return { data, source: "local", usedFallback: true, onlineError: error.message };
      }
    }
    return { data: await fetchJson(config.localUrl), source: "local", usedFallback: false };
  }

  window.DashboardDataSource = { load, validate };
})();
