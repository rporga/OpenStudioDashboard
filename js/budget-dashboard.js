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

  function setKpi(id, value, decimals = 1) {
    const element = document.getElementById(id);
    const missing = !Calc.hasValue(value);
    element.textContent = missing ? "Awaiting data" : Calc.formatNumber(value, decimals);
    element.classList.toggle("is-missing", missing);
  }

  function comparisonCopy(priorValue, change) {
    if (!Calc.hasValue(priorValue)) return "FY2025: Awaiting data · change pending";
    if (!Calc.hasValue(change)) return `FY2025: ${Calc.formatNumber(priorValue, 1)} · change pending`;
    const direction = Number(change) >= 0 ? "increase" : "decrease";
    return `FY2025: ${Calc.formatNumber(priorValue, 1)} · ${Calc.formatPercent(Math.abs(change), 1)} ${direction}`;
  }

  function percentChange(currentValue, priorValue) {
    return Calc.hasValue(currentValue) && Number(priorValue) > 0 ? ((Number(currentValue) - Number(priorValue)) / Number(priorValue)) * 100 : null;
  }

  function renderKpis(rows, summary) {
    setKpi("kpi-budget", summary.nestle_budget_usd000);
    setKpi("kpi-approved", summary.approved_am_net_fee_usd000);
    setKpi("kpi-used", summary.used_so_far_usd000);

    const split = document.getElementById("kpi-split");
    const hasSplit = Calc.hasValue(summary.studio_budget_usd000) && Calc.hasValue(summary.kol_budget_usd000);
    split.textContent = hasSplit ? `${Calc.formatNumber(summary.studio_budget_usd000, 1)} / ${Calc.formatNumber(summary.kol_budget_usd000, 1)}` : "Awaiting data";
    split.classList.toggle("is-missing", !hasSplit);

    const approvedKnown = rows.filter((row) => Calc.hasValue(row.approved_am_net_fee_usd000)).length;
    const usedKnown = rows.filter((row) => Calc.hasValue(row.used_so_far_usd000)).length;
    const splitKnown = rows.filter((row) => Calc.hasValue(row.studio_budget_usd000) && Calc.hasValue(row.kol_budget_usd000)).length;
    const priorBudget = Calc.nullableSum(rows.map((row) => row.prior_year_nestle_budget_usd000));
    const priorApproved = Calc.nullableSum(rows.map((row) => row.prior_year_approved_am_net_fee_usd000));
    const priorUsed = Calc.nullableSum(rows.map((row) => row.prior_year_used_so_far_usd000));
    const priorStudio = Calc.nullableSum(rows.map((row) => row.prior_year_studio_budget_usd000));
    const priorKol = Calc.nullableSum(rows.map((row) => row.prior_year_kol_budget_usd000));
    const priorSplitTotal = Calc.hasValue(priorStudio) && Calc.hasValue(priorKol) ? priorStudio + priorKol : null;
    const currentSplitTotal = hasSplit ? summary.studio_budget_usd000 + summary.kol_budget_usd000 : null;
    document.getElementById("approved-kpi-label").textContent = summary.approvedComplete ? "Approved in AM" : "Known Approved in AM";
    document.getElementById("kpi-budget-context").textContent = comparisonCopy(priorBudget, percentChange(summary.nestle_budget_usd000, priorBudget));
    document.getElementById("kpi-approved-context").textContent = Calc.hasValue(priorApproved) ? comparisonCopy(priorApproved, percentChange(summary.approved_am_net_fee_usd000, priorApproved)) : `${approvedKnown} of ${rows.length} reporting · FY2025 comparison awaiting data`;
    document.getElementById("kpi-used-context").textContent = Calc.hasValue(priorUsed) ? comparisonCopy(priorUsed, percentChange(summary.used_so_far_usd000, priorUsed)) : `${usedKnown} of ${rows.length} reporting · FY2025 comparison awaiting data`;
    document.getElementById("kpi-split-context").textContent = Calc.hasValue(priorSplitTotal) ? `FY2025 Studio/KOL: ${Calc.formatNumber(priorStudio, 1)} / ${Calc.formatNumber(priorKol, 1)} · ${comparisonCopy(priorSplitTotal, percentChange(currentSplitTotal, priorSplitTotal)).replace(/^FY2025: [^·]+ · /, "")}` : `${splitKnown} of ${rows.length} reporting · FY2025 comparison awaiting data`;
  }

  function renderCoverage(rows) {
    const budgetKnown = rows.filter((row) => Calc.hasValue(row.nestle_budget_usd000)).length;
    const approvedKnown = rows.filter((row) => Calc.hasValue(row.approved_am_net_fee_usd000)).length;
    const usedKnown = rows.filter((row) => Calc.hasValue(row.used_so_far_usd000)).length;
    const splitKnown = rows.filter((row) => Calc.hasValue(row.studio_budget_usd000) && Calc.hasValue(row.kol_budget_usd000)).length;
    const supplied = budgetKnown + approvedKnown + usedKnown + splitKnown;
    const possible = rows.length * 4;
    const percent = possible ? (supplied / possible) * 100 : 0;
    document.getElementById("coverage-title").textContent = `${Math.round(percent)}% of selected financial fields available`;
    document.getElementById("coverage-copy").textContent = `${budgetKnown} Nestlé Budget · ${approvedKnown} Approved in AM · ${usedKnown} Used So Far · ${splitKnown} Studio/KOL split.`;
    document.getElementById("coverage-meter-fill").style.width = `${percent}%`;
    document.querySelector(".coverage-meter").setAttribute("aria-label", `${Math.round(percent)} percent of selected financial fields are available`);
  }

  function renderCharts(rows) {
    const labels = rows.map((row) => row.market.name);
    const budget = rows.map((row) => Calc.hasValue(row.nestle_budget_usd000) ? row.nestle_budget_usd000 : null);
    const approved = rows.map((row) => Calc.hasValue(row.approved_am_net_fee_usd000) ? row.approved_am_net_fee_usd000 : null);
    const used = rows.map((row) => Calc.hasValue(row.used_so_far_usd000) ? row.used_so_far_usd000 : null);
    const studioBudget = rows.map((row) => Calc.hasValue(row.studio_budget_usd000) ? row.studio_budget_usd000 : null);
    const kolBudget = rows.map((row) => Calc.hasValue(row.kol_budget_usd000) ? row.kol_budget_usd000 : null);

    chart("budget-approved-chart", { type: "bar", data: { labels, datasets: [{ label: "Nestlé Budget", data: budget, backgroundColor: C.navy, borderRadius: 7, maxBarThickness: 42 }, { label: "Approved in AM", data: approved, backgroundColor: C.coral, borderRadius: 7, maxBarThickness: 42 }] }, options: options() });
    toggleEmpty("budget-approved-empty", !budget.some(Calc.hasValue) && !approved.some(Calc.hasValue));
    const missing = rows.filter((row) => !Calc.hasValue(row.approved_am_net_fee_usd000)).map((row) => row.market.name);
    document.getElementById("budget-approved-note").textContent = missing.length ? `Approved AM awaiting: ${missing.join(", ")}. Missing bars are not zero.` : "Approved AM coverage is complete for this view.";

    chart("budget-spend-chart", { type: "bar", data: { labels, datasets: [{ label: "Nestlé Budget", data: budget, backgroundColor: C.navy, borderRadius: 7, maxBarThickness: 42 }, { label: "Used So Far", data: used, backgroundColor: C.teal, borderRadius: 7, maxBarThickness: 42 }] }, options: options() });
    toggleEmpty("budget-spend-empty", !used.some(Calc.hasValue));

    chart("budget-split-chart", { type: "bar", data: { labels, datasets: [{ label: "Studio budget", data: studioBudget, backgroundColor: C.navy, borderRadius: 4 }, { label: "KOL budget", data: kolBudget, backgroundColor: C.purple, borderRadius: 4 }] }, options: options(true) });
    toggleEmpty("budget-split-empty", !studioBudget.some(Calc.hasValue) && !kolBudget.some(Calc.hasValue));
  }

  function initials(name) { return name === "Philippines" ? "PH" : name === "Thailand" ? "TH" : name === "Vietnam" ? "VN" : name === "Malaysia" ? "MY" : name === "India" ? "IN" : name.slice(0, 2).toUpperCase(); }

  function renderTable(data, filters, rows) {
    const statuses = Object.fromEntries(data.data_status.map((row) => [row.market_id, row.overall_status]));
    document.getElementById("finance-comparison-body").innerHTML = rows.map((row) => `<tr>
      <td><span class="market-cell"><span class="market-initial">${initials(row.market.name)}</span>${window.DashboardApp.escapeHtml(row.market.name)}</span></td>
      <td class="numeric">${window.DashboardApp.valueCell(row.nestle_budget_usd000, 1)}</td>
      <td class="numeric">${window.DashboardApp.valueCell(row.approved_am_net_fee_usd000, 1)}</td>
      <td class="numeric">${window.DashboardApp.valueCell(row.used_so_far_usd000, 1)}</td>
      <td class="numeric">${window.DashboardApp.valueCell(row.studio_budget_usd000, 1)}</td>
      <td class="numeric">${window.DashboardApp.valueCell(row.kol_budget_usd000, 1)}</td>
      <td>${window.DashboardApp.statusBadge(statuses[row.market.id] || "Awaiting data")}</td></tr>`).join("");
    document.getElementById("download-finance").onclick = () => {
      const output = [["Studio", "Nestlé Budget USD000", "Approved in AM USD000", "Used So Far USD000", "Studio budget USD000", "KOL budget USD000", "FY2025 Nestlé Budget USD000", "Status"]];
      rows.forEach((row) => output.push([row.market.name, row.nestle_budget_usd000, row.approved_am_net_fee_usd000, row.used_so_far_usd000, row.studio_budget_usd000, row.kol_budget_usd000, row.prior_year_nestle_budget_usd000, statuses[row.market.id]]));
      window.DashboardApp.downloadCsv(`aoa-finance-fy${String(filters.year).slice(-2)}.csv`, output);
    };
  }

  function render() {
    const { data, filters } = window.DashboardApp;
    const rows = Calc.financeByMarket(data, filters);
    const summary = Calc.financeSummary(rows);
    renderKpis(rows, summary); renderCoverage(rows); renderCharts(rows); renderTable(data, filters, rows);
  }

  window.addEventListener("dashboardDataReady", render);
  window.addEventListener("dashboardFiltersChanged", render);
})();
