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

  function assetPlanRecord(data, marketId, year) {
    return data.asset_plans.find((record) => record.market_id === marketId && Number(record.fiscal_year) === Number(year)) || null;
  }

  function historicalAssetRecord(data, marketId) {
    return data.historical_assets.find((record) => record.market_id === marketId) || null;
  }

  function elapsedMonths(data, year) {
    const report = new Date(`${data.settings.reporting_date}T12:00:00`);
    const selectedYear = Number(year);
    if (selectedYear < report.getFullYear()) return 12;
    if (selectedYear > report.getFullYear()) return 0;
    return report.getMonth() + 1;
  }

  function assetSummary(records, data, year) {
    const currentVolume = sum(records.map((record) => record.asset_volume));
    const status = aggregateBy(records, "delivery_status");
    const creation = sum(records.filter((record) => record.asset_type === "Asset Creation").map((record) => record.asset_volume));
    const adaptation = sum(records.filter((record) => record.asset_type === "Asset Adaptation").map((record) => record.asset_volume));
    const months = elapsedMonths(data, year);
    return {
      currentVolume, total: currentVolume,
      completed: status.Completed || 0,
      onTrack: status["On-Track"] || 0,
      delayed: status.Delayed || 0,
      notStarted: status["Not Started"] || 0,
      statusMissing: status.Unclassified || 0,
      creation, adaptation, other: currentVolume - creation - adaptation,
      monthlyAverage: months > 0 ? currentVolume / months : null,
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
      const summary = assetSummary(records, data, filters.year);
      const plan = assetPlanRecord(data, id, filters.year);
      const history = historicalAssetRecord(data, id);
      const fullView = filters.quarter === "all" && filters.typology === "all";
      const planned = plan && hasValue(plan.fy_planned_assets) ? Number(plan.fy_planned_assets) : null;
      const hasCurrentVolume = records.length > 0;
      summary.planned = planned;
      summary.utilization = fullView && hasCurrentVolume && planned > 0 ? percentage(summary.currentVolume, planned) : null;
      summary.planYoyChange = hasValue(planned) && history?.comparable_to_plan && Number(history.assets_delivered) > 0
        ? ((planned - Number(history.assets_delivered)) / Number(history.assets_delivered)) * 100
        : null;
      summary.yoyChange = fullView && hasCurrentVolume && history?.comparable_to_current && Number(history.assets_delivered) > 0
        ? ((summary.currentVolume - Number(history.assets_delivered)) / Number(history.assets_delivered)) * 100
        : null;
      return { market: map[id], records, summary, plan, history, hasCurrentVolume, fullView };
    });
  }

  function portfolioAssetSummary(byMarket, data, filters) {
    const reporting = byMarket.filter((row) => row.hasCurrentVolume);
    const currentVolume = sum(reporting.map((row) => row.summary.currentVolume));
    const completed = sum(reporting.map((row) => row.summary.completed));
    const onTrack = sum(reporting.map((row) => row.summary.onTrack));
    const delayed = sum(reporting.map((row) => row.summary.delayed));
    const notStarted = sum(reporting.map((row) => row.summary.notStarted));
    const statusMissing = sum(reporting.map((row) => row.summary.statusMissing));
    const creation = sum(reporting.map((row) => row.summary.creation));
    const adaptation = sum(reporting.map((row) => row.summary.adaptation));
    const other = sum(reporting.map((row) => row.summary.other));
    const comparable = byMarket.filter((row) => row.fullView && row.hasCurrentVolume && hasValue(row.summary.planned));
    const knownScope = byMarket.filter((row) => hasValue(row.summary.planned));
    const planned = nullableSum(knownScope.map((row) => row.summary.planned));
    const comparablePlanned = nullableSum(comparable.map((row) => row.summary.planned));
    const comparableCurrentVolume = nullableSum(comparable.map((row) => row.summary.currentVolume));
    const months = elapsedMonths(data, filters.year);
    const historical = nullableSum(byMarket.map((row) => row.history?.assets_delivered));
    const comparableHistory = byMarket.filter((row) => row.fullView && row.hasCurrentVolume && row.history?.comparable_to_current && hasValue(row.history.assets_delivered));
    const comparableHistorical = nullableSum(comparableHistory.map((row) => row.history.assets_delivered));
    const historicalComparableCurrent = nullableSum(comparableHistory.map((row) => row.summary.currentVolume));
    const planHistoryComparable = knownScope.filter((row) => row.history?.comparable_to_plan && hasValue(row.history.assets_delivered));
    const comparablePlanTotal = nullableSum(planHistoryComparable.map((row) => row.summary.planned));
    const comparablePlanHistory = nullableSum(planHistoryComparable.map((row) => row.history.assets_delivered));
    return {
      currentVolume, completed, onTrack, delayed, notStarted, statusMissing, creation, adaptation, other,
      planned, comparablePlanned, comparableCurrentVolume, comparableMarkets: comparable.length,
      knownPlanMarkets: knownScope.length, comparablePlanTotal, comparablePlanHistory, planComparisonMarkets: planHistoryComparable.length,
      planYoyChange: comparablePlanHistory > 0 ? ((comparablePlanTotal - comparablePlanHistory) / comparablePlanHistory) * 100 : null,
      utilization: filters.quarter === "all" && filters.typology === "all" && hasValue(comparablePlanned) ? percentage(comparableCurrentVolume, comparablePlanned) : null,
      monthlyAverage: months > 0 ? currentVolume / months : null,
      elapsedMonths: months,
      historical, comparableHistorical, historicalComparableCurrent,
      yoyChange: comparableHistorical > 0 ? ((historicalComparableCurrent - comparableHistorical) / comparableHistorical) * 100 : null
    };
  }

  function financeByMarket(data, filters) {
    const map = marketMap(data);
    const ids = selectedMarketIds(data, filters);
    return ids.map((id) => {
      const record = data.finance.find((item) => Number(item.fiscal_year) === Number(filters.year) && item.market_id === id) || {};
      const remaining = hasValue(record.nestle_budget_usd000) && hasValue(record.used_so_far_usd000) ? Number(record.nestle_budget_usd000) - Number(record.used_so_far_usd000) : null;
      return { market: map[id], ...record, remaining_budget_usd000: remaining };
    });
  }

  function financeSummary(rows) {
    const fields = ["nestle_budget_usd000", "approved_am_net_fee_usd000", "used_so_far_usd000", "remaining_budget_usd000", "studio_budget_usd000", "kol_budget_usd000", "studio_spend_usd000", "kol_spend_usd000"];
    const result = {};
    fields.forEach((field) => { result[field] = nullableSum(rows.map((row) => row[field])); });
    result.approvedComplete = rows.length > 0 && rows.every((row) => hasValue(row.approved_am_net_fee_usd000));
    result.usedComplete = rows.length > 0 && rows.every((row) => hasValue(row.used_so_far_usd000));
    result.completeMarkets = rows.filter((row) => hasValue(row.nestle_budget_usd000) && hasValue(row.approved_am_net_fee_usd000) && hasValue(row.used_so_far_usd000) && hasValue(row.studio_budget_usd000) && hasValue(row.kol_budget_usd000)).length;
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
    percentage, marketMap, selectedMarketIds, filterAssets, filterFinance, assetPlanRecord, historicalAssetRecord, elapsedMonths, assetSummary,
    aggregateBy, assetsByMarket, portfolioAssetSummary, financeByMarket, financeSummary, filterTat, average, median,
    tatMetric, tatSummary, tatByMarket
  };
})();
