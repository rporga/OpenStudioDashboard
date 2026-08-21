(function () {
  const charts = {};
  const C = window.DASHBOARD_COLORS;
  const Calc = window.DashboardCalc;

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
    records.forEach((record) => { monthData[Number(record.month) - 1] += Number(record.asset_volume); });
    const completedData = Array(12).fill(0);
    records.filter((record) => record.delivery_status === "Completed").forEach((record) => { completedData[Number(record.month) - 1] += Number(record.asset_volume); });
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

  function render() {
    const { data, filters } = window.DashboardApp;
    const records = Calc.filterAssets(data, filters);
    const byMarket = Calc.assetsByMarket(data, filters);
    renderAlerts(data, filters); renderKpis(data, filters, records); renderProgressChart(data, filters, byMarket);
    renderMonthlyChart(records); renderStatusChart(records); renderTypologyChart(data, byMarket); renderAssetTypeChart(data, byMarket); renderTable(data, filters, byMarket);
  }

  window.addEventListener("dashboardDataReady", render);
  window.addEventListener("dashboardFiltersChanged", render);
})();
