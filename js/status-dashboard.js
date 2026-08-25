(function () {
  function selectedRows(data, filters) {
    return filters.market === "all" ? data.data_status : data.data_status.filter((row) => row.market_id === filters.market);
  }
  function marketMap(data) { return Object.fromEntries(data.markets.map((market) => [market.id, market])); }
  function initials(name) { return name === "Philippines" ? "PH" : name === "Thailand" ? "TH" : name === "Vietnam" ? "VN" : name === "Malaysia" ? "MY" : name.slice(0, 2).toUpperCase(); }

  function renderSummary(rows) {
    const counts = { Complete: 0, Partial: 0, "Data quality issue": 0, "Awaiting data": 0 };
    rows.forEach((row) => { counts[row.overall_status] = (counts[row.overall_status] || 0) + 1; });
    document.getElementById("status-complete-count").textContent = counts.Complete || 0;
    document.getElementById("status-partial-count").textContent = counts.Partial || 0;
    document.getElementById("status-issue-count").textContent = counts["Data quality issue"] || 0;
    document.getElementById("status-awaiting-count").textContent = counts["Awaiting data"] || 0;
    const percent = rows.length ? (counts.Complete / rows.length) * 100 : 0;
    document.getElementById("status-coverage-title").textContent = `${counts.Complete} of ${rows.length} markets complete`;
    document.getElementById("status-coverage-fill").style.width = `${percent}%`;
  }

  function renderTable(data, filters, rows) {
    const markets = marketMap(data);
    const fields = ["asset_data_status", "fy_scope_status", "status_breakdown_status", "typology_status", "asset_type_status", "budget_status", "approved_am_status", "used_so_far_status", "studio_kol_status"];
    document.getElementById("data-status-body").innerHTML = rows.map((row) => {
      const market = markets[row.market_id];
      return `<tr><td><span class="market-cell"><span class="market-initial">${initials(market.name)}</span>${window.DashboardApp.escapeHtml(market.name)}</span></td>${fields.map((field) => `<td>${window.DashboardApp.statusBadge(row[field])}</td>`).join("")}<td>${window.DashboardApp.formatDate(row.last_updated)}</td><td>${window.DashboardApp.escapeHtml(row.notes)}</td></tr>`;
    }).join("");
    document.getElementById("download-status").onclick = () => {
      const output = [["Studio", "Current volume", "FY scope", "Status breakdown", "Typology", "Asset type", "Nestlé Budget", "Approved in AM", "Used So Far", "Studio/KOL split", "Overall", "Last updated", "Notes"]];
      rows.forEach((row) => output.push([markets[row.market_id].name, row.asset_data_status, row.fy_scope_status, row.status_breakdown_status, row.typology_status, row.asset_type_status, row.budget_status, row.approved_am_status, row.used_so_far_status, row.studio_kol_status, row.overall_status, row.last_updated, row.notes]));
      window.DashboardApp.downloadCsv(`aoa-data-status-fy${String(filters.year).slice(-2)}.csv`, output);
    };
  }

  function render() {
    const { data, filters } = window.DashboardApp;
    const rows = selectedRows(data, filters);
    renderSummary(rows); renderTable(data, filters, rows);
  }
  window.addEventListener("dashboardDataReady", render);
  window.addEventListener("dashboardFiltersChanged", render);
})();
