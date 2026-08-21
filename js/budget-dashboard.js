(function () {
  const charts = {};
  const C = window.DASHBOARD_COLORS;
  const Calc = window.DashboardCalc;

  function destroy(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }
  function options(stacked = false) {
    return {
      responsive: true, maintainAspectRatio: false, animation: { duration: 300 }, interaction: { mode: "index", intersect: false },
      plugins: { legend: { position: "bottom", labels: { color: "#627285", boxWidth: 10, boxHeight: 10, padding: 18, usePointStyle: true, font: { family: "WPP", size: 11 } } }, tooltip: { backgroundColor: C.navy, padding: 12, bodyFont: { family: "WPP" }, titleFont: { family: "WPP", weight: "bold" }, callbacks: { label: (context) => `${context.dataset.label}: ${context.raw === null ? "Awaiting data" : Calc.formatNumber(context.raw, 1)} USD000` } } },
      scales: { x: { stacked, grid: { display: false }, ticks: { color: "#718094", font: { family: "WPP", size: 11 } }, border: { display: false } }, y: { stacked, beginAtZero: true, grid: { color: "#edf0f3" }, ticks: { color: "#718094", font: { family: "WPP", size: 11 } }, border: { display: false } } }
    };
  }
  function chart(id, config) { destroy(id); charts[id] = new Chart(document.getElementById(id), config); }
  function toggleEmpty(id, show) { document.getElementById(id).hidden = !show; }

  function renderAlerts(data, rows) {
    const missingApproved = rows.filter((row) => !Calc.hasValue(row.approved_am_net_fee_usd000)).map((row) => row.market.name);
    const missingActual = rows.filter((row) => !Calc.hasValue(row.actual_spend_usd000)).map((row) => row.market.name);
    const alerts = [];
    if (missingApproved.length) alerts.push(`<div class="data-alert"><span class="alert-mark">!</span><div><strong>Approved AM incomplete:</strong> Awaiting ${window.DashboardApp.escapeHtml(missingApproved.join(", "))}. The known total excludes these studios.</div></div>`);
    if (missingActual.length) alerts.push(`<div class="data-alert"><span class="alert-mark">!</span><div><strong>Actual spend pending:</strong> Remaining budget cannot be calculated until actual spend is supplied.</div></div>`);
    document.getElementById("quality-alerts").innerHTML = alerts.join("");
  }

  function setKpi(id, value, decimals = 1) {
    const element = document.getElementById(id);
    const missing = !Calc.hasValue(value);
    element.textContent = missing ? "Awaiting data" : Calc.formatNumber(value, decimals);
    element.classList.toggle("is-missing", missing);
  }

  function renderKpis(rows, summary) {
    setKpi("kpi-budget", summary.q2rf_budget_usd000);
    setKpi("kpi-approved", summary.approved_am_net_fee_usd000);
    setKpi("kpi-spend", summary.actual_spend_usd000);
    setKpi("kpi-remaining", summary.remaining_budget_usd000);
    setKpi("kpi-studio-budget", summary.studio_budget_usd000);
    setKpi("kpi-kol-budget", summary.kol_budget_usd000);
    const approvedKnown = rows.filter((row) => Calc.hasValue(row.approved_am_net_fee_usd000)).length;
    document.getElementById("approved-kpi-label").textContent = summary.approvedComplete ? "Approved AM Net Fee" : "Known Approved AM Total";
    document.getElementById("kpi-approved-context").textContent = `${approvedKnown} of ${rows.length} studio${rows.length === 1 ? "" : "s"} reporting · USD000`;
    document.getElementById("kpi-budget-context").textContent = `${rows.filter((row) => Calc.hasValue(row.q2rf_budget_usd000)).length} of ${rows.length} studios reporting · USD000`;
  }

  function renderCoverage(rows, summary) {
    const approvedKnown = rows.filter((row) => Calc.hasValue(row.approved_am_net_fee_usd000)).length;
    const percent = rows.length ? (summary.completeMarkets / rows.length) * 100 : 0;
    document.getElementById("coverage-title").textContent = `${summary.completeMarkets} of ${rows.length} markets fully complete`;
    document.getElementById("coverage-copy").textContent = `${approvedKnown} market${approvedKnown === 1 ? " has" : "s have"} an approved AM figure; actual spend and Studio/KOL splits are still pending.`;
    document.getElementById("coverage-meter-fill").style.width = `${percent}%`;
    document.querySelector(".coverage-meter").setAttribute("aria-label", `${Math.round(percent)} percent of selected markets have complete financial data`);
  }

  function renderCharts(rows) {
    const labels = rows.map((row) => row.market.name);
    const budget = rows.map((row) => Calc.hasValue(row.q2rf_budget_usd000) ? row.q2rf_budget_usd000 : null);
    const approved = rows.map((row) => Calc.hasValue(row.approved_am_net_fee_usd000) ? row.approved_am_net_fee_usd000 : null);
    const spend = rows.map((row) => Calc.hasValue(row.actual_spend_usd000) ? row.actual_spend_usd000 : null);
    const studioBudget = rows.map((row) => Calc.hasValue(row.studio_budget_usd000) ? row.studio_budget_usd000 : null);
    const kolBudget = rows.map((row) => Calc.hasValue(row.kol_budget_usd000) ? row.kol_budget_usd000 : null);
    const studioSpend = rows.map((row) => Calc.hasValue(row.studio_spend_usd000) ? row.studio_spend_usd000 : null);
    const kolSpend = rows.map((row) => Calc.hasValue(row.kol_spend_usd000) ? row.kol_spend_usd000 : null);
    const remaining = rows.map((row) => Calc.hasValue(row.remaining_budget_usd000) ? row.remaining_budget_usd000 : null);

    chart("budget-approved-chart", { type: "bar", data: { labels, datasets: [{ label: "Q2RF budget", data: budget, backgroundColor: C.navy, borderRadius: 7, maxBarThickness: 42 }, { label: "Approved AM fee", data: approved, backgroundColor: C.coral, borderRadius: 7, maxBarThickness: 42 }] }, options: options() });
    toggleEmpty("budget-approved-empty", !budget.some(Calc.hasValue) && !approved.some(Calc.hasValue));
    const missing = rows.filter((row) => !Calc.hasValue(row.approved_am_net_fee_usd000)).map((row) => row.market.name);
    document.getElementById("budget-approved-note").textContent = missing.length ? `No approved fee yet: ${missing.join(", ")}. Missing bars are not zero.` : "Approved AM coverage is complete for this view.";

    chart("budget-spend-chart", { type: "bar", data: { labels, datasets: [{ label: "Q2RF budget", data: budget, backgroundColor: C.navy, borderRadius: 7, maxBarThickness: 42 }, { label: "Actual spend", data: spend, backgroundColor: C.teal, borderRadius: 7, maxBarThickness: 42 }] }, options: options() });
    toggleEmpty("budget-spend-empty", !spend.some(Calc.hasValue));
    chart("budget-split-chart", { type: "bar", data: { labels, datasets: [{ label: "Studio budget", data: studioBudget, backgroundColor: C.navy, borderRadius: 4 }, { label: "KOL budget", data: kolBudget, backgroundColor: C.purple, borderRadius: 4 }] }, options: options(true) });
    toggleEmpty("budget-split-empty", !studioBudget.some(Calc.hasValue) && !kolBudget.some(Calc.hasValue));
    chart("spend-split-chart", { type: "bar", data: { labels, datasets: [{ label: "Studio spend", data: studioSpend, backgroundColor: C.teal, borderRadius: 4 }, { label: "KOL spend", data: kolSpend, backgroundColor: C.gold, borderRadius: 4 }] }, options: options(true) });
    toggleEmpty("spend-split-empty", !studioSpend.some(Calc.hasValue) && !kolSpend.some(Calc.hasValue));
    chart("remaining-chart", { type: "bar", data: { labels, datasets: [{ label: "Remaining budget", data: remaining, backgroundColor: C.blue, borderRadius: 7, maxBarThickness: 50 }] }, options: options() });
    toggleEmpty("remaining-empty", !remaining.some(Calc.hasValue));
  }

  function initials(name) { return name === "Philippines" ? "PH" : name === "Thailand" ? "TH" : name === "Vietnam" ? "VN" : name === "Malaysia" ? "MY" : name.slice(0, 2).toUpperCase(); }

  function renderTable(data, filters, rows) {
    const statuses = Object.fromEntries(data.data_status.map((row) => [row.market_id, row.overall_status]));
    document.getElementById("finance-comparison-body").innerHTML = rows.map((row) => `<tr>
      <td><span class="market-cell"><span class="market-initial">${initials(row.market.name)}</span>${window.DashboardApp.escapeHtml(row.market.name)}</span></td>
      <td class="numeric">${window.DashboardApp.valueCell(row.q2rf_budget_usd000, 1)}</td><td class="numeric">${window.DashboardApp.valueCell(row.approved_am_net_fee_usd000, 1)}</td><td class="numeric">${window.DashboardApp.valueCell(row.actual_spend_usd000, 1)}</td><td class="numeric">${window.DashboardApp.valueCell(row.remaining_budget_usd000, 1)}</td><td class="numeric">${window.DashboardApp.valueCell(row.studio_budget_usd000, 1)}</td><td class="numeric">${window.DashboardApp.valueCell(row.kol_budget_usd000, 1)}</td><td>${window.DashboardApp.statusBadge(statuses[row.market.id] || "Awaiting data")}</td></tr>`).join("");
    document.getElementById("download-finance").onclick = () => {
      const output = [["Studio", "Q2RF budget USD000", "Approved AM Net Fee USD000", "Actual spend USD000", "Remaining budget USD000", "Studio budget USD000", "KOL budget USD000", "Status"]];
      rows.forEach((row) => output.push([row.market.name, row.q2rf_budget_usd000, row.approved_am_net_fee_usd000, row.actual_spend_usd000, row.remaining_budget_usd000, row.studio_budget_usd000, row.kol_budget_usd000, statuses[row.market.id]]));
      window.DashboardApp.downloadCsv(`aoa-finance-fy${String(filters.year).slice(-2)}.csv`, output);
    };
  }

  function render() {
    const { data, filters } = window.DashboardApp;
    const rows = Calc.financeByMarket(data, filters);
    const summary = Calc.financeSummary(rows);
    renderAlerts(data, rows); renderKpis(rows, summary); renderCoverage(rows, summary); renderCharts(rows); renderTable(data, filters, rows);
  }

  window.addEventListener("dashboardDataReady", render);
  window.addEventListener("dashboardFiltersChanged", render);
})();
