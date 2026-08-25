(function () {
  const requiredCollections = ["markets", "assets", "asset_plans", "historical_assets", "finance", "data_status"];
  const requiredAssetFields = ["fiscal_year", "month", "quarter", "market_id", "content_typology", "asset_type", "delivery_status", "asset_volume"];
  const requiredPlanFields = ["fiscal_year", "market_id", "fy_planned_assets", "current_tracker_volume", "utilization_pct"];
  const requiredHistoryFields = ["market_id", "period_label", "assets_delivered", "comparable_to_current", "comparable_to_plan"];
  const requiredFinanceFields = ["fiscal_year", "market_id", "nestle_budget_usd000", "approved_am_net_fee_usd000", "used_so_far_usd000", "prior_year_nestle_budget_usd000", "prior_year_approved_am_net_fee_usd000", "prior_year_used_so_far_usd000", "prior_year_studio_budget_usd000", "prior_year_kol_budget_usd000"];
  const requiredTatFields = ["brief_id", "fiscal_year", "delivery_quarter", "market_id", "brief_date", "delivery_date", "content_typologies", "asset_type_group", "turnaround_days", "scope_class"];

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
    data.asset_plans.forEach((record, index) => {
      requiredPlanFields.forEach((field) => {
        if (!(field in record)) throw new Error(`Asset plan ${index + 1} is missing “${field}”.`);
      });
      if (!marketIds.has(record.market_id)) throw new Error(`Asset plan ${index + 1} uses an unknown market.`);
    });
    data.historical_assets.forEach((record, index) => {
      requiredHistoryFields.forEach((field) => {
        if (!(field in record)) throw new Error(`Historical asset record ${index + 1} is missing “${field}”.`);
      });
      if (!marketIds.has(record.market_id)) throw new Error(`Historical asset record ${index + 1} uses an unknown market.`);
    });
    data.finance.forEach((record, index) => {
      requiredFinanceFields.forEach((field) => {
        if (!(field in record)) throw new Error(`Finance record ${index + 1} is missing “${field}”.`);
      });
      if (!marketIds.has(record.market_id)) throw new Error(`Finance record ${index + 1} uses an unknown market.`);
    });
    if (data.tat_records !== undefined && !Array.isArray(data.tat_records)) throw new Error("TAT records must be a collection.");
    (data.tat_records || []).forEach((record, index) => {
      requiredTatFields.forEach((field) => {
        if (!(field in record)) throw new Error(`TAT record ${index + 1} is missing “${field}”.`);
      });
      if (!marketIds.has(record.market_id)) throw new Error(`TAT record ${index + 1} uses an unknown market.`);
      if (record.turnaround_days !== null && !Number.isFinite(Number(record.turnaround_days))) throw new Error(`TAT record ${index + 1} has an invalid duration.`);
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
