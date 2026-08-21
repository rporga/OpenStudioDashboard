(function () {
  const charts = {};
  const C = window.DASHBOARD_COLORS;
  const Calc = window.DashboardCalc;
  const TAT_STORAGE_KEY = "aoa-content-studio-dashboard-tat-view";
  const tatState = { view: "assets", metric: "median", includeLongRunning: false };

  function destroyChart(id) {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  }

  function baseOptions(stacked = false) {
    return {
      responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "bottom", labels: { color: "#627285", boxWidth: 10, boxHeight: 10, padding: 18, usePointStyle: true, font: { family: "WPP", size: 11 } } },
        tooltip: { backgroundColor: "#061a2e", titleFont: { family: "WPP", weight: "bold" }, bodyFont: { family: "WPP" }, padding: 12, cornerRadius: 8 }
      },
      scales: {
        x: { stacked, grid: { display: false }, ticks: { color: "#718094", font: { family: "WPP", size: 11 } }, border: { display: false } },
        y: { stacked, beginAtZero: true, grid: { color: "#edf0f3" }, ticks: { color: "#718094", precision: 0, font: { family: "WPP", size: 11 } }, border: { display: false } }
      }
    };
  }

  function makeChart(id, config) {
    destroyChart(id);
    const canvas = document.getElementById(id);
    charts[id] = new Chart(canvas, config);
    requestAnimationFrame(() => {
      if (!charts[id]) return;
      charts[id].resize();
      charts[id].update("none");
    });
  }

  function hasMarketAssetData(data, marketId) {
    const status = data.data_status.find((row) => row.market_id === marketId);
    return status && status.asset_data_status !== "Awaiting data";
  }

  function renderAlerts(data, filters) {
    const issues = data.quality_issues.filter((issue) => filters.market === "all" || issue.market_id === filters.market);
    const target = document.getElementById("quality-alerts");
    target.innerHTML = issues.map((issue) => `<div class="data-alert"><span class="alert-mark">!</span><div><strong>${window.DashboardApp.escapeHtml(issue.type)}:</strong> ${window.DashboardApp.escapeHtml(issue.message)}</div></div>`).join("");
  }

  function renderKpis(data, filters, records) {
    const summary = Calc.assetSummary(records, data, filters.year);
    const selectedIsMissing = filters.market !== "all" && !hasMarketAssetData(data, filters.market);
    const knownMarketCount = data.data_status.filter((row) => row.asset_data_status !== "Awaiting data").length;
    const context = filters.market === "all" ? `${knownMarketCount} of ${data.markets.length} studios reporting` : (data.markets.find((market) => market.id === filters.market)?.name || "Selected market");
    const setNumber = (id, value, decimals = 0) => {
      const element = document.getElementById(id);
      element.textContent = selectedIsMissing ? "Awaiting data" : Calc.formatNumber(value, decimals);
      element.classList.toggle("is-missing", selectedIsMissing);
    };
    setNumber("kpi-total-assets", summary.total);
    setNumber("kpi-completed", summary.completed);
    const utilization = document.getElementById("kpi-utilization");
    utilization.textContent = selectedIsMissing ? "Awaiting data" : Calc.formatPercent(summary.utilization);
    utilization.classList.toggle("is-missing", selectedIsMissing);
    document.getElementById("utilization-bar").style.width = selectedIsMissing ? "0" : `${Math.min(summary.utilization || 0, 100)}%`;
    setNumber("kpi-monthly-average", summary.monthlyAverage, 1);
    setNumber("kpi-creation", summary.creation);
    setNumber("kpi-adaptation", summary.adaptation);
    document.getElementById("kpi-total-context").textContent = context;
    document.getElementById("kpi-completed-context").textContent = selectedIsMissing ? "No submitted asset data" : `${Calc.formatPercent(summary.utilization)} of filtered FY volume`;
    document.getElementById("kpi-month-context").textContent = `${summary.elapsedMonths} elapsed month${summary.elapsedMonths === 1 ? "" : "s"}`;
    document.getElementById("kpi-creation-share").textContent = selectedIsMissing ? "Classification pending" : `${Calc.formatPercent(Calc.percentage(summary.creation, summary.total))} of filtered output`;
    document.getElementById("kpi-adaptation-share").textContent = selectedIsMissing ? "Classification pending" : `${Calc.formatPercent(Calc.percentage(summary.adaptation, summary.total))} of filtered output`;
  }

  function renderProgressChart(data, filters, byMarket) {
    const labels = byMarket.map((row) => row.market.name);
    const totals = byMarket.map((row) => hasMarketAssetData(data, row.market.id) ? row.summary.total : null);
    const completed = byMarket.map((row) => hasMarketAssetData(data, row.market.id) ? row.summary.completed : null);
    makeChart("assets-completed-chart", { type: "bar", data: { labels, datasets: [
      { label: "FY assets", data: totals, backgroundColor: C.navy, borderRadius: 7, maxBarThickness: 44 },
      { label: "Completed", data: completed, backgroundColor: C.coral, borderRadius: 7, maxBarThickness: 44 }
    ] }, options: baseOptions(false) });
  }

  function renderMonthlyChart(records) {
    const monthData = Array(12).fill(0);
    records.filter((record) => Number(record.month) >= 1 && Number(record.month) <= 12).forEach((record) => { monthData[Number(record.month) - 1] += Number(record.asset_volume); });
    const completedData = Array(12).fill(0);
    records.filter((record) => record.delivery_status === "Completed" && Number(record.month) >= 1 && Number(record.month) <= 12).forEach((record) => { completedData[Number(record.month) - 1] += Number(record.asset_volume); });
    const options = baseOptions(false);
    options.plugins.legend.position = "bottom";
    makeChart("monthly-chart", { type: "line", data: { labels: Calc.MONTHS, datasets: [
      { label: "All assets", data: monthData, borderColor: C.navy, backgroundColor: "rgba(11,41,70,.10)", tension: .32, fill: true, pointRadius: 3, pointBackgroundColor: C.navy },
      { label: "Completed", data: completedData, borderColor: C.coral, backgroundColor: "transparent", tension: .32, pointRadius: 3, pointBackgroundColor: C.coral }
    ] }, options });
  }

  function renderStatusChart(records) {
    const status = Calc.aggregateBy(records, "delivery_status");
    const values = Calc.STATUSES.map((name) => status[name] || 0);
    makeChart("status-chart", { type: "doughnut", data: { labels: Calc.STATUSES, datasets: [{ data: values, backgroundColor: [C.green, C.blue, C.gold, C.grey, "#d3d9df"], borderColor: "#fff", borderWidth: 3, hoverOffset: 4 }] }, options: {
      responsive: true, maintainAspectRatio: false, cutout: "65%",
      plugins: { legend: { position: "bottom", labels: { color: "#627285", boxWidth: 9, boxHeight: 9, padding: 15, usePointStyle: true, font: { family: "WPP", size: 10 } } }, tooltip: { backgroundColor: C.navy, padding: 12, bodyFont: { family: "WPP" }, titleFont: { family: "WPP" } } }
    } });
  }

  function renderTypologyChart(data, byMarket) {
    const colors = [C.coral, C.navy, C.teal, C.gold, C.grey];
    const datasets = Calc.TYPOLOGIES.map((typology, index) => ({
      label: typology,
      data: byMarket.map((row) => hasMarketAssetData(data, row.market.id) ? (Calc.aggregateBy(row.records, "content_typology")[typology] || 0) : null),
      backgroundColor: colors[index], borderRadius: 3, maxBarThickness: 58
    }));
    makeChart("typology-chart", { type: "bar", data: { labels: byMarket.map((row) => row.market.name), datasets }, options: baseOptions(true) });
  }

  function renderAssetTypeChart(data, byMarket) {
    const colors = [C.coral, C.navy, C.teal, C.purple, C.gold, C.grey];
    const datasets = Calc.ASSET_TYPES.map((type, index) => ({
      label: type,
      data: byMarket.map((row) => hasMarketAssetData(data, row.market.id) ? (Calc.aggregateBy(row.records, "asset_type")[type] || 0) : null),
      backgroundColor: colors[index], borderRadius: 3, maxBarThickness: 58
    }));
    makeChart("asset-type-chart", { type: "bar", data: { labels: byMarket.map((row) => row.market.name), datasets }, options: baseOptions(true) });
  }

  function marketInitial(name) { return name === "Philippines" ? "PH" : name === "Thailand" ? "TH" : name === "Vietnam" ? "VN" : name === "Malaysia" ? "MY" : name.slice(0, 2).toUpperCase(); }

  function renderTable(data, filters, byMarket) {
    const tbody = document.getElementById("market-comparison-body");
    tbody.innerHTML = byMarket.map((row) => {
      const missing = !hasMarketAssetData(data, row.market.id);
      const s = row.summary;
      const val = (value, decimals = 0) => missing ? '<span class="empty-cell">Awaiting data</span>' : Calc.formatNumber(value, decimals);
      const percent = missing ? '<span class="empty-cell">Awaiting data</span>' : Calc.formatPercent(s.utilization);
      return `<tr><td><span class="market-cell"><span class="market-initial">${marketInitial(row.market.name)}</span>${window.DashboardApp.escapeHtml(row.market.name)}</span></td><td class="numeric">${val(s.total)}</td><td class="numeric">${val(s.completed)}</td><td class="numeric">${percent}</td><td class="numeric">${val(s.monthlyAverage, 1)}</td><td class="numeric">${val(s.creation)}</td><td class="numeric">${val(s.adaptation)}</td><td class="numeric">${val(s.other)}</td></tr>`;
    }).join("");

    document.getElementById("download-assets").onclick = () => {
      const rows = [["Studio", "FY assets", "Completed", "Utilization %", "Monthly average", "Creation", "Adaptation", "Other / unclassified"]];
      byMarket.forEach((row) => {
        const missing = !hasMarketAssetData(data, row.market.id); const s = row.summary;
        rows.push([row.market.name, missing ? "" : s.total, missing ? "" : s.completed, missing ? "" : s.utilization?.toFixed(1), missing ? "" : s.monthlyAverage?.toFixed(1), missing ? "" : s.creation, missing ? "" : s.adaptation, missing ? "" : s.other]);
      });
      window.DashboardApp.downloadCsv(`aoa-assets-fy${String(filters.year).slice(-2)}.csv`, rows);
    };
  }

  function formatDays(value) {
    return Calc.hasValue(value) ? `${Calc.formatNumber(value, 1)} days` : "Awaiting data";
  }

  function matchingTatRecords(data, filters) {
    const marketIds = new Set(Calc.selectedMarketIds(data, filters));
    return (data.tat_records || []).filter((record) =>
      Number(record.fiscal_year) === Number(filters.year) &&
      marketIds.has(record.market_id) &&
      (filters.quarter === "all" || record.delivery_quarter === filters.quarter) &&
      (filters.typology === "all" || (record.content_typologies || []).includes(filters.typology))
    );
  }

  function setTatValue(id, value, formatter = formatDays) {
    const element = document.getElementById(id);
    element.textContent = Calc.hasValue(value) ? formatter(value) : "Awaiting data";
    element.classList.toggle("is-missing", !Calc.hasValue(value));
  }

  function renderTatExplanation(data, filters, allMatching) {
    const metricName = tatState.metric === "median" ? "Median" : "Average";
    const longCount = allMatching.filter((record) => record.scope_class === "long_running").length;
    const invalidCount = allMatching.filter((record) => record.scope_class === "invalid").length;
    const title = document.getElementById("tat-explainer-title");
    const copy = document.getElementById("tat-explainer-copy");
    if (tatState.includeLongRunning) {
      title.textContent = `${metricName} TAT including long-running scopes`;
      copy.textContent = `This view includes ${longCount} matching brief${longCount === 1 ? "" : "s"} above 90 calendar days. It represents the full recorded project window and may not equal active production time. ${invalidCount} invalid-date brief${invalidCount === 1 ? " is" : "s are"} still excluded.`;
    } else if (tatState.metric === "average") {
      title.textContent = "Average TAT is useful, but sensitive to longer briefs";
      copy.textContent = `The average uses every matching standard brief once. ${longCount} long-running scope${longCount === 1 ? " is" : "s are"} excluded by default so annual retainers do not distort the result; ${invalidCount} invalid-date brief${invalidCount === 1 ? " is" : "s are"} also excluded.`;
    } else {
      title.textContent = "Median TAT shows the typical completed brief";
      copy.textContent = `The median is the default because it is less distorted by unusually long projects. Excluded from this selection: ${longCount} long-running scope${longCount === 1 ? "" : "s"} and ${invalidCount} invalid-date brief${invalidCount === 1 ? "" : "s"}.`;
    }
  }

  function renderTatKpis(records) {
    const summary = Calc.tatSummary(records, tatState.metric);
    const metricName = tatState.metric === "median" ? "Median" : "Average";
    document.getElementById("kpi-tat-label").textContent = `${metricName} TAT`;
    setTatValue("kpi-tat", summary.metric);
    setTatValue("kpi-tat-briefs", summary.count || null, (value) => Calc.formatNumber(value));
    setTatValue("kpi-within-14", summary.within14, (value) => Calc.formatPercent(value));
    setTatValue("kpi-within-30", summary.within30, (value) => Calc.formatPercent(value));
    setTatValue("kpi-creation-tat", summary.creation);
    setTatValue("kpi-adaptation-tat", summary.adaptation);
    document.getElementById("kpi-tat-context").textContent = tatState.includeLongRunning ? "Standard + long-running scopes" : "Standard completed briefs";
    document.getElementById("kpi-tat-coverage").textContent = summary.count ? `${summary.count} unique brief${summary.count === 1 ? "" : "s"}` : "No valid briefs in selection";
    document.getElementById("kpi-creation-tat-context").textContent = `${summary.creationCount} creation-only brief${summary.creationCount === 1 ? "" : "s"}`;
    document.getElementById("kpi-adaptation-tat-context").textContent = `${summary.adaptationCount} adaptation-only brief${summary.adaptationCount === 1 ? "" : "s"}`;
  }

  function renderTatMarketChart(byMarket) {
    const metricName = tatState.metric === "median" ? "Median" : "Average";
    const values = byMarket.map((row) => row.summary.count ? row.summary.metric : null);
    const empty = values.every((value) => value === null);
    document.getElementById("tat-market-empty").hidden = !empty;
    document.getElementById("tat-market-chart-title").textContent = `${metricName} TAT by studio`;
    document.getElementById("tat-scope-note").textContent = `${tatState.includeLongRunning ? "Including long-running" : "Standard briefs"} · calendar days`;
    const options = baseOptions(false);
    options.plugins.legend.display = false;
    options.plugins.tooltip.callbacks = { label: (context) => `${context.parsed.y.toFixed(1)} calendar days` };
    makeChart("tat-market-chart", { type: "bar", data: { labels: byMarket.map((row) => row.market.name), datasets: [{ label: `${metricName} TAT`, data: values, backgroundColor: C.coral, borderRadius: 7, maxBarThickness: 52 }] }, options });
  }

  function renderTatTypeChart(byMarket) {
    const values = byMarket.flatMap((row) => [row.summary.creation, row.summary.adaptation, row.summary.mixed]).filter(Calc.hasValue);
    document.getElementById("tat-type-empty").hidden = values.length > 0;
    const options = baseOptions(false);
    options.plugins.tooltip.callbacks = { label: (context) => `${context.dataset.label}: ${context.parsed.y.toFixed(1)} calendar days` };
    makeChart("tat-type-chart", { type: "bar", data: { labels: byMarket.map((row) => row.market.name), datasets: [
      { label: "Creation", data: byMarket.map((row) => row.summary.creation), backgroundColor: C.coral, borderRadius: 6, maxBarThickness: 34 },
      { label: "Adaptation", data: byMarket.map((row) => row.summary.adaptation), backgroundColor: C.navy, borderRadius: 6, maxBarThickness: 34 },
      { label: "Mixed", data: byMarket.map((row) => row.summary.mixed), backgroundColor: C.gold, borderRadius: 6, maxBarThickness: 34 }
    ] }, options });
  }

  function renderTatBandChart(records) {
    const bands = [
      { label: "0–14 days", count: records.filter((record) => Number(record.turnaround_days) <= 14).length },
      { label: "15–30 days", count: records.filter((record) => Number(record.turnaround_days) > 14 && Number(record.turnaround_days) <= 30).length },
      { label: "31–60 days", count: records.filter((record) => Number(record.turnaround_days) > 30 && Number(record.turnaround_days) <= 60).length },
      { label: "61–90 days", count: records.filter((record) => Number(record.turnaround_days) > 60 && Number(record.turnaround_days) <= 90).length },
      { label: "91+ days", count: records.filter((record) => Number(record.turnaround_days) > 90).length }
    ];
    document.getElementById("tat-band-empty").hidden = records.length > 0;
    makeChart("tat-band-chart", { type: "doughnut", data: { labels: bands.map((band) => band.label), datasets: [{ data: bands.map((band) => band.count), backgroundColor: [C.green, C.teal, C.blue, C.gold, C.coral], borderColor: "#fff", borderWidth: 3 }] }, options: {
      responsive: true, maintainAspectRatio: false, cutout: "62%",
      plugins: { legend: { position: "bottom", labels: { color: "#627285", boxWidth: 9, boxHeight: 9, padding: 14, usePointStyle: true, font: { family: "WPP", size: 10 } } }, tooltip: { backgroundColor: C.navy, padding: 12, callbacks: { label: (context) => `${context.label}: ${context.raw} unique briefs` } } }
    } });
  }

  function renderTatTable(data, filters, byMarket) {
    const metricName = tatState.metric === "median" ? "Median" : "Average";
    document.getElementById("tat-table-metric").textContent = `${metricName} TAT`;
    document.getElementById("tat-long-running-column").textContent = tatState.includeLongRunning ? "Long-running included" : "Long-running excluded";
    const days = (value) => Calc.hasValue(value) ? `${Calc.formatNumber(value, 1)} days` : '<span class="empty-cell">Awaiting data</span>';
    const percent = (value) => Calc.hasValue(value) ? Calc.formatPercent(value) : '<span class="empty-cell">Awaiting data</span>';
    document.getElementById("tat-comparison-body").innerHTML = byMarket.map((row) => {
      const s = row.summary;
      return `<tr><td><span class="market-cell"><span class="market-initial">${marketInitial(row.market.name)}</span>${window.DashboardApp.escapeHtml(row.market.name)}</span></td><td class="numeric">${days(s.metric)}</td><td class="numeric">${s.count || '<span class="empty-cell">Awaiting data</span>'}</td><td class="numeric">${percent(s.within14)}</td><td class="numeric">${percent(s.within30)}</td><td class="numeric">${days(s.creation)}</td><td class="numeric">${days(s.adaptation)}</td><td class="numeric">${row.longRunningExcluded}</td></tr>`;
    }).join("");

    document.getElementById("download-tat").onclick = () => {
      const rows = [["Studio", `${metricName} TAT days`, "Valid unique briefs", "Within 14 days %", "Within 30 days %", "Creation TAT days", "Adaptation TAT days", tatState.includeLongRunning ? "Long-running included" : "Long-running excluded"]];
      byMarket.forEach((row) => { const s = row.summary; rows.push([row.market.name, s.metric ?? "", s.count || "", s.within14?.toFixed(1) ?? "", s.within30?.toFixed(1) ?? "", s.creation ?? "", s.adaptation ?? "", row.longRunningExcluded]); });
      window.DashboardApp.downloadCsv(`aoa-tat-fy${String(filters.year).slice(-2)}-${tatState.metric}.csv`, rows);
    };
  }

  function renderTat(data, filters) {
    const records = Calc.filterTat(data, filters, tatState.includeLongRunning);
    const byMarket = Calc.tatByMarket(data, filters, tatState.metric, tatState.includeLongRunning);
    const allMatching = matchingTatRecords(data, filters);
    renderTatExplanation(data, filters, allMatching);
    renderTatKpis(records);
    renderTatMarketChart(byMarket);
    renderTatTypeChart(byMarket);
    renderTatBandChart(records);
    renderTatTable(data, filters, byMarket);
  }

  function persistTatState() {
    localStorage.setItem(TAT_STORAGE_KEY, JSON.stringify(tatState));
  }

  function applyView() {
    const isTat = tatState.view === "tat";
    document.getElementById("asset-view").hidden = isTat;
    document.getElementById("tat-view").hidden = !isTat;
    document.getElementById("view-switch-title").textContent = isTat ? "Turnaround time (TAT)" : "Asset output";
    document.querySelectorAll("[data-dashboard-view]").forEach((button) => {
      const active = button.dataset.dashboardView === tatState.view;
      button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active));
    });
    document.querySelectorAll("[data-tat-metric]").forEach((button) => {
      const active = button.dataset.tatMetric === tatState.metric;
      button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active));
    });
    document.getElementById("include-long-running").checked = tatState.includeLongRunning;
  }

  function bindTatControls() {
    try { Object.assign(tatState, JSON.parse(localStorage.getItem(TAT_STORAGE_KEY) || "{}")); } catch (_) {}
    if (!["assets", "tat"].includes(tatState.view)) tatState.view = "assets";
    if (!["median", "average"].includes(tatState.metric)) tatState.metric = "median";
    tatState.includeLongRunning = Boolean(tatState.includeLongRunning);
    document.querySelectorAll("[data-dashboard-view]").forEach((button) => button.addEventListener("click", () => {
      tatState.view = button.dataset.dashboardView; persistTatState(); applyView(); render();
    }));
    document.querySelectorAll("[data-tat-metric]").forEach((button) => button.addEventListener("click", () => {
      tatState.metric = button.dataset.tatMetric; persistTatState(); applyView(); renderTat(window.DashboardApp.data, window.DashboardApp.filters);
    }));
    document.getElementById("include-long-running").addEventListener("change", (event) => {
      tatState.includeLongRunning = event.target.checked; persistTatState(); renderTat(window.DashboardApp.data, window.DashboardApp.filters);
    });
    applyView();
  }

  function render() {
    const { data, filters } = window.DashboardApp;
    renderAlerts(data, filters);
    if (tatState.view === "tat") {
      renderTat(data, filters);
    } else {
      const records = Calc.filterAssets(data, filters);
      const byMarket = Calc.assetsByMarket(data, filters);
      renderKpis(data, filters, records); renderProgressChart(data, filters, byMarket);
      renderMonthlyChart(records); renderStatusChart(records); renderTypologyChart(data, byMarket); renderAssetTypeChart(data, byMarket); renderTable(data, filters, byMarket);
    }
  }

  window.addEventListener("dashboardDataReady", () => { bindTatControls(); render(); });
  window.addEventListener("dashboardFiltersChanged", render);
})();
