(function () {
  const STORAGE_KEY = "aoa-content-studio-dashboard-filters";
  const page = document.body.dataset.page;
  const navItems = [
    { id: "assets", label: "Asset Dashboard", href: "./index.html", icon: '<svg viewBox="0 0 24 24"><path d="M4 19V9m6 10V5m6 14v-7m4 7H2"/></svg>' },
    { id: "budget", label: "Budget Dashboard", href: "./budget.html", icon: '<svg viewBox="0 0 24 24"><path d="M4 7h16v12H4zM7 7V5h10v2m-9 6h4m-4 3h7"/></svg>' },
    { id: "status", label: "Data Status", href: "./data-status.html", icon: '<svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 9h8M8 13h8m-8 4h5"/></svg>' }
  ];

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  }

  function headerMarkup() {
    return `<div class="header-inner">
      <div class="brand-row">
        <div class="brand-lockup">
          <img class="brand-logo" src="./assets/openstudio-logo.png" alt="OpenStudio">
          <span class="brand-divider" aria-hidden="true"></span>
          <span class="tracker-name">Content Studio Tracker</span>
        </div>
        <span class="header-meta">FY26 · AOA Studio Network</span>
      </div>
      <nav class="nav-bar" aria-label="Primary navigation">
        ${navItems.map((item) => `<a class="nav-link ${page === item.id ? "active" : ""}" data-nav-id="${item.id}" href="${item.href}"><span class="nav-icon">${item.icon}</span>${item.label}</a>`).join("")}
      </nav>
    </div>`;
  }

  function readStoredFilters() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
  }

  function initialFilters(data) {
    const stored = readStoredFilters();
    const params = new URLSearchParams(location.search);
    return {
      year: Number(params.get("year") || stored.year || data.settings.selected_fiscal_year),
      market: params.get("market") || stored.market || "all",
      quarter: params.get("quarter") || stored.quarter || "all",
      typology: params.get("typology") || stored.typology || "all"
    };
  }

  function filterMarkup(data, filters) {
    const years = [...new Set([...data.assets.map((record) => Number(record.fiscal_year)), ...data.finance.map((record) => Number(record.fiscal_year))])].sort((a, b) => b - a);
    const typologies = [...new Set(data.assets.map((record) => record.content_typology))].sort();
    return `<div class="filter-group"><label for="year-filter">Fiscal year</label><select id="year-filter" class="filter-select">${years.map((year) => `<option value="${year}" ${year === filters.year ? "selected" : ""}>FY${String(year).slice(-2)}</option>`).join("")}</select></div>
      <div class="filter-group"><label for="market-filter">Market</label><select id="market-filter" class="filter-select"><option value="all">All Studios</option>${data.markets.map((market) => `<option value="${escapeHtml(market.id)}" ${market.id === filters.market ? "selected" : ""}>${escapeHtml(market.name)}</option>`).join("")}</select></div>
      <div class="filter-group"><label for="quarter-filter">Quarter</label><select id="quarter-filter" class="filter-select"><option value="all">Full year</option>${["Q1", "Q2", "Q3", "Q4"].map((quarter) => `<option value="${quarter}" ${quarter === filters.quarter ? "selected" : ""}>${quarter}</option>`).join("")}</select></div>
      <div class="filter-group"><label for="typology-filter">Content typology</label><select id="typology-filter" class="filter-select"><option value="all">All typologies</option>${typologies.map((typology) => `<option value="${escapeHtml(typology)}" ${typology === filters.typology ? "selected" : ""}>${escapeHtml(typology)}</option>`).join("")}</select></div>
      <button id="reset-filters" class="reset-button" type="button">Reset filters</button>`;
  }

  function updateNavLinks(filters) {
    const params = new URLSearchParams({ year: filters.year, market: filters.market, quarter: filters.quarter, typology: filters.typology });
    document.querySelectorAll("[data-nav-id]").forEach((link) => {
      const item = navItems.find((nav) => nav.id === link.dataset.navId);
      link.href = `${item.href}?${params.toString()}`;
    });
  }

  function setFilters(filters, notify = true) {
    window.DashboardApp.filters = filters;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    updateNavLinks(filters);
    const params = new URLSearchParams({ year: filters.year, market: filters.market, quarter: filters.quarter, typology: filters.typology });
    history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
    if (notify) window.dispatchEvent(new CustomEvent("dashboardFiltersChanged", { detail: filters }));
  }

  function bindFilters(data) {
    const controls = {
      year: document.getElementById("year-filter"), market: document.getElementById("market-filter"),
      quarter: document.getElementById("quarter-filter"), typology: document.getElementById("typology-filter")
    };
    Object.entries(controls).forEach(([key, control]) => control.addEventListener("change", () => {
      const next = { ...window.DashboardApp.filters, [key]: key === "year" ? Number(control.value) : control.value };
      setFilters(next);
    }));
    document.getElementById("reset-filters").addEventListener("click", () => {
      const filters = { year: data.settings.selected_fiscal_year, market: "all", quarter: "all", typology: "all" };
      controls.year.value = filters.year; controls.market.value = filters.market; controls.quarter.value = filters.quarter; controls.typology.value = filters.typology;
      setFilters(filters);
    });
  }

  function formatDate(value) {
    if (!value) return "Awaiting data";
    return new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function statusBadge(status) {
    const className = String(status).toLowerCase().replace(/\s+/g, "-");
    return `<span class="status-badge badge-${className}">${escapeHtml(status)}</span>`;
  }

  function valueCell(value, decimals = 0) {
    if (!window.DashboardCalc.hasValue(value)) return '<span class="empty-cell">Awaiting data</span>';
    return escapeHtml(window.DashboardCalc.formatNumber(value, decimals));
  }

  function downloadCsv(filename, rows) {
    if (!rows.length) return;
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }

  function showError(error) {
    document.getElementById("loading-state").hidden = true;
    const target = document.getElementById("error-state");
    target.hidden = false;
    target.innerHTML = `<div><strong>We could not load the dashboard data.</strong><br>${escapeHtml(error.message)}<br><small>Run the site through a local HTTP server and check the configured data URL.</small></div>`;
  }

  async function init() {
    document.getElementById("app-header").innerHTML = headerMarkup();
    document.getElementById("app-footer").innerHTML = `<div class="footer-inner"><span><strong>Content Studio Tracker</strong> · AOA Studio Network</span><span>Missing values are excluded from totals, never treated as zero.</span></div>`;
    try {
      const result = await window.DashboardDataSource.load();
      const data = result.data;
      const filters = initialFilters(data);
      window.DashboardApp = { data, filters, source: result.source, usedFallback: result.usedFallback, setFilters, formatDate, escapeHtml, statusBadge, valueCell, downloadCsv };
      document.getElementById("global-filters").innerHTML = filterMarkup(data, filters);
      bindFilters(data); updateNavLinks(filters);
      const updated = document.getElementById("source-updated"); if (updated) updated.textContent = formatDate(data.meta.source_updated_at);
      if (result.usedFallback) document.getElementById("page-message").innerHTML = '<div class="data-alert"><span class="alert-mark">!</span><div><strong>Online source unavailable.</strong> Displaying the local fallback data.</div></div>';
      document.getElementById("loading-state").hidden = true;
      document.getElementById("dashboard-content").hidden = false;
      window.dispatchEvent(new CustomEvent("dashboardDataReady", { detail: window.DashboardApp }));
    } catch (error) { showError(error); }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
