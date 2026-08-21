(function () {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const TYPOLOGIES = ["Consumer Engagement Content", "Prime Content / Amplification", "Evergreen Content", "Real-time Content", "Other / Unclassified"];
  const ASSET_TYPES = ["Asset Creation", "Asset Adaptation", "Asset Localization", "Asset Transcreation", "Compositioning & Versioning", "Unclassified"];
  const STATUSES = ["Completed", "On-Track", "Delayed", "Not Started", "Unclassified"];

  const hasValue = (value) => value !== null && value !== undefined && value !== "";
  const sum = (values) => values.filter(hasValue).reduce((total, value) => total + Number(value), 0);
  const nullableSum = (values) => values.some(hasValue) ? sum(values) : null;
  const formatNumber = (value, decimals = 0) => hasValue(value) ? Number(value).toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : "Awaiting data";
  const formatPercent = (value, decimals = 0) => hasValue(value) ? `${Number(value).toFixed(decimals)}%` : "Awaiting data";
  const percentage = (part, whole) => whole > 0 ? (part / whole) * 100 : null;

  function marketMap(data) {
    return Object.fromEntries(data.markets.map((market) => [market.id, market]));
  }

  function selectedMarketIds(data, filters) {
    return filters.market === "all" ? data.markets.map((market) => market.id) : [filters.market];
  }

  function filterAssets(data, filters) {
    const marketIds = new Set(selectedMarketIds(data, filters));
    return data.assets.filter((record) =>
      Number(record.fiscal_year) === Number(filters.year) &&
      marketIds.has(record.market_id) &&
      (filters.quarter === "all" || record.quarter === filters.quarter) &&
      (filters.typology === "all" || record.content_typology === filters.typology)
    );
  }

  function filterFinance(data, filters) {
    const marketIds = new Set(selectedMarketIds(data, filters));
    return data.finance.filter((record) => Number(record.fiscal_year) === Number(filters.year) && marketIds.has(record.market_id));
  }

  function elapsedMonths(data, year) {
    const report = new Date(`${data.settings.reporting_date}T12:00:00`);
    const selectedYear = Number(year);
    if (selectedYear < report.getFullYear()) return 12;
    if (selectedYear > report.getFullYear()) return 0;
    return report.getMonth() + 1;
  }

  function assetSummary(records, data, year) {
    const total = sum(records.map((record) => record.asset_volume));
    const completed = sum(records.filter((record) => record.delivery_status === "Completed").map((record) => record.asset_volume));
    const creation = sum(records.filter((record) => record.asset_type === "Asset Creation").map((record) => record.asset_volume));
    const adaptation = sum(records.filter((record) => record.asset_type === "Asset Adaptation").map((record) => record.asset_volume));
    const months = elapsedMonths(data, year);
    return {
      total, completed, creation, adaptation,
      other: total - creation - adaptation,
      utilization: percentage(completed, total),
      monthlyAverage: months > 0 ? completed / months : null,
      elapsedMonths: months
    };
  }

  function aggregateBy(records, key, valueKey = "asset_volume") {
    return records.reduce((result, record) => {
      const name = record[key] ?? "Unclassified";
      result[name] = (result[name] || 0) + Number(record[valueKey] || 0);
      return result;
    }, {});
  }

  function assetsByMarket(data, filters) {
    const map = marketMap(data);
    const ids = selectedMarketIds(data, filters);
    return ids.map((id) => {
      const records = filterAssets(data, { ...filters, market: id });
      return { market: map[id], records, summary: assetSummary(records, data, filters.year) };
    });
  }

  function financeByMarket(data, filters) {
    const map = marketMap(data);
    const ids = selectedMarketIds(data, filters);
    return ids.map((id) => {
      const record = data.finance.find((item) => Number(item.fiscal_year) === Number(filters.year) && item.market_id === id) || {};
      const remaining = hasValue(record.q2rf_budget_usd000) && hasValue(record.actual_spend_usd000) ? Number(record.q2rf_budget_usd000) - Number(record.actual_spend_usd000) : null;
      return { market: map[id], ...record, remaining_budget_usd000: remaining };
    });
  }

  function financeSummary(rows) {
    const fields = ["q2rf_budget_usd000", "approved_am_net_fee_usd000", "actual_spend_usd000", "remaining_budget_usd000", "studio_budget_usd000", "kol_budget_usd000", "studio_spend_usd000", "kol_spend_usd000"];
    const result = {};
    fields.forEach((field) => { result[field] = nullableSum(rows.map((row) => row[field])); });
    result.approvedComplete = rows.length > 0 && rows.every((row) => hasValue(row.approved_am_net_fee_usd000));
    result.actualComplete = rows.length > 0 && rows.every((row) => hasValue(row.actual_spend_usd000));
    result.completeMarkets = rows.filter((row) => hasValue(row.q2rf_budget_usd000) && hasValue(row.approved_am_net_fee_usd000) && hasValue(row.actual_spend_usd000) && hasValue(row.studio_budget_usd000) && hasValue(row.kol_budget_usd000)).length;
    return result;
  }

  function filterTat(data, filters, includeLongRunning = false) {
    const marketIds = new Set(selectedMarketIds(data, filters));
    return (data.tat_records || []).filter((record) =>
      Number(record.fiscal_year) === Number(filters.year) &&
      marketIds.has(record.market_id) &&
      (filters.quarter === "all" || record.delivery_quarter === filters.quarter) &&
      (filters.typology === "all" || (record.content_typologies || []).includes(filters.typology)) &&
      record.turnaround_days !== null &&
      (record.scope_class === "standard" || (includeLongRunning && record.scope_class === "long_running"))
    );
  }

  function average(values) {
    return values.length ? sum(values) / values.length : null;
  }

  function median(values) {
    if (!values.length) return null;
    const sorted = values.map(Number).sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function tatMetric(records, metric = "median") {
    const values = records.map((record) => Number(record.turnaround_days)).filter(Number.isFinite);
    return metric === "average" ? average(values) : median(values);
  }

  function tatSummary(records, metric = "median") {
    const count = records.length;
    const typed = (type) => records.filter((record) => record.asset_type_group === type);
    return {
      count,
      metric: tatMetric(records, metric),
      median: tatMetric(records, "median"),
      average: tatMetric(records, "average"),
      within14: count ? percentage(records.filter((record) => Number(record.turnaround_days) <= 14).length, count) : null,
      within30: count ? percentage(records.filter((record) => Number(record.turnaround_days) <= 30).length, count) : null,
      creation: tatMetric(typed("Creation"), metric),
      creationCount: typed("Creation").length,
      adaptation: tatMetric(typed("Adaptation"), metric),
      adaptationCount: typed("Adaptation").length,
      mixed: tatMetric(typed("Mixed"), metric),
      mixedCount: typed("Mixed").length
    };
  }

  function tatByMarket(data, filters, metric = "median", includeLongRunning = false) {
    const map = marketMap(data);
    return selectedMarketIds(data, filters).map((id) => {
      const marketFilters = { ...filters, market: id };
      const records = filterTat(data, marketFilters, includeLongRunning);
      const longRunningExcluded = (data.tat_records || []).filter((record) =>
        Number(record.fiscal_year) === Number(filters.year) &&
        record.market_id === id &&
        record.scope_class === "long_running" &&
        (filters.quarter === "all" || record.delivery_quarter === filters.quarter) &&
        (filters.typology === "all" || (record.content_typologies || []).includes(filters.typology))
      ).length;
      return { market: map[id], records, summary: tatSummary(records, metric), longRunningExcluded };
    });
  }

  window.DashboardCalc = {
    MONTHS, TYPOLOGIES, ASSET_TYPES, STATUSES, hasValue, sum, nullableSum, formatNumber, formatPercent,
    percentage, marketMap, selectedMarketIds, filterAssets, filterFinance, elapsedMonths, assetSummary,
    aggregateBy, assetsByMarket, financeByMarket, financeSummary, filterTat, average, median,
    tatMetric, tatSummary, tatByMarket
  };
})();
