(function () {
  const DATA_URL = "./data/scorecards.json";
  const FILTER_STORAGE_KEY = "aoa-content-studio-scorecard-filters";
  let data;
  let matrixChart;
  let filters = { studio: "philippines", category: "all" };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  }

  function hasValue(value) { return value !== null && value !== undefined && value !== ""; }
  function round(value, decimals = 4) { const factor = 10 ** decimals; return Math.round((Number(value) + Number.EPSILON) * factor) / factor; }
  function average(values) { return values.length ? values.reduce((sum, value) => sum + Number(value), 0) / values.length : null; }
  function formatScore(value) { return hasValue(value) ? `${Number(value).toFixed(1)}%` : "Not available"; }
  function formatValue(value) { return hasValue(value) ? Number(value).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1") : "—"; }
  function formatDate(value) {
    if (!value) return "Not provided";
    return new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function statusClass(status) {
    return String(status || "not-assessed").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function statusBadge(status) {
    return `<span class="score-status score-status-${statusClass(status)}">${escapeHtml(status)}</span>`;
  }

  function buildCsv(rows) {
    return `\ufeff${rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n")}`;
  }

  function downloadCsv(filename, rows) {
    const blob = new Blob([buildCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function sideCalculation(studio, responsibility) {
    const categories = {};
    const rawCategoryScores = [];
    data.categories.forEach((category) => {
      const items = studio.criteria.filter((item) => item.responsibility === responsibility && item.category_id === category.id && hasValue(item.normalized_value));
      const numerator = items.reduce((sum, item) => sum + Number(item.normalized_value), 0);
      const denominator = items.length;
      const rawScore = denominator ? (numerator / denominator) * 100 : null;
      if (hasValue(rawScore)) rawCategoryScores.push(rawScore);
      categories[category.id] = { numerator: round(numerator), denominator, score: hasValue(rawScore) ? round(rawScore) : null };
    });
    const rawOverall = rawCategoryScores.length ? average(rawCategoryScores) : null;
    return { categories, overall: hasValue(rawOverall) ? round(rawOverall) : null, rawOverall };
  }

  function assertClose(actual, expected, label) {
    if (actual === null && expected === null) return;
    if (!hasValue(actual) || !hasValue(expected) || Math.abs(Number(actual) - Number(expected)) > 0.01) {
      throw new Error(`Score validation failed for ${label}.`);
    }
  }

  function validateScorecardData(payload) {
    if (!payload || !Array.isArray(payload.categories) || payload.categories.length !== 4 || !Array.isArray(payload.studios)) throw new Error("Scorecard data structure is incomplete.");
    data = payload;
    const comparable = data.studios.filter((studio) => studio.comparable);
    if (comparable.length !== 5) throw new Error("Exactly five completed comparable assessments are required.");
    comparable.forEach((studio) => {
      const calculatedSides = {};
      ["Nestlé", "WPP"].forEach((responsibility) => {
        const key = responsibility === "Nestlé" ? "nestle" : "wpp";
        const calculated = sideCalculation(studio, responsibility);
        calculatedSides[key] = calculated;
        data.categories.forEach((category) => {
          const saved = studio.scores[key].categories[category.id];
          const current = calculated.categories[category.id];
          assertClose(saved.numerator, current.numerator, `${studio.name} ${responsibility} ${category.name} numerator`);
          if (saved.denominator !== current.denominator) throw new Error(`Score validation failed for ${studio.name} ${responsibility} ${category.name} denominator.`);
          assertClose(saved.score, current.score, `${studio.name} ${responsibility} ${category.name}`);
        });
        assertClose(studio.scores[key].overall, calculated.overall, `${studio.name} ${responsibility} overall`);
      });
      assertClose(studio.combined_score, round((calculatedSides.nestle.rawOverall + calculatedSides.wpp.rawOverall) / 2), `${studio.name} combined`);
      if (!studio.matrix_eligible) throw new Error(`${studio.name} must be eligible for the readiness matrix.`);
    });
    data.studios.filter((studio) => !studio.comparable).forEach((studio) => {
      if (studio.matrix_eligible || studio.combined_score !== null || studio.criteria.length) throw new Error(`${studio.name} special status entered comparable scoring.`);
    });
    return payload;
  }

  function currentStudio() { return data.studios.find((studio) => studio.id === filters.studio) || data.studios[0]; }
  function criteriaForView(studio) { return studio.criteria.filter((item) => filters.category === "all" || item.category_id === filters.category); }
  function excludedForView(studio) { return studio.excluded_source_items.filter((item) => filters.category === "all" || item.category_id === filters.category); }

  function readInitialFilters() {
    const params = new URLSearchParams(location.search);
    let stored = {};
    try { stored = JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) || "{}"); } catch { stored = {}; }
    const requestedStudio = params.get("market") || stored.studio || "philippines";
    const requestedCategory = params.get("category") || stored.category || "all";
    filters = {
      studio: data.studios.some((studio) => studio.id === requestedStudio) ? requestedStudio : "philippines",
      category: requestedCategory === "all" || data.categories.some((category) => category.id === requestedCategory) ? requestedCategory : "all"
    };
  }

  function updateUrlAndNav() {
    const params = new URLSearchParams({ market: filters.studio, category: filters.category });
    history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    let global = {};
    try { global = JSON.parse(localStorage.getItem("aoa-content-studio-dashboard-filters") || "{}"); } catch { global = {}; }
    const shared = new URLSearchParams({
      year: global.year || 2026,
      market: filters.studio,
      quarter: global.quarter || "all",
      typology: global.typology || "all"
    });
    document.querySelector('[data-scorecard-nav="assets"]').href = `./index.html?${shared.toString()}`;
    document.querySelector('[data-scorecard-nav="budget"]').href = `./budget.html?${shared.toString()}`;
    document.querySelector('[data-scorecard-nav="status"]').href = `./data-status.html?${shared.toString()}`;
    document.querySelector('[data-scorecard-nav="scorecards"]').href = `./scorecards.html?${params.toString()}`;
  }

  function populateFilters() {
    const studioSelect = document.getElementById("scorecard-studio-filter");
    const categorySelect = document.getElementById("scorecard-category-filter");
    studioSelect.innerHTML = data.studios.map((studio) => `<option value="${escapeHtml(studio.id)}">${escapeHtml(studio.name)}${studio.comparable ? "" : " — " + escapeHtml(studio.assessment_status.split(" — ")[0])}</option>`).join("");
    categorySelect.innerHTML = `<option value="all">All four categories</option>${data.categories.map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`).join("")}`;
    studioSelect.value = filters.studio;
    categorySelect.value = filters.category;
    studioSelect.addEventListener("change", () => { filters.studio = studioSelect.value; updateUrlAndNav(); render(); });
    categorySelect.addEventListener("change", () => { filters.category = categorySelect.value; updateUrlAndNav(); render(); });
    document.getElementById("reset-scorecard-filters").addEventListener("click", () => {
      filters = { studio: "philippines", category: "all" };
      studioSelect.value = filters.studio;
      categorySelect.value = filters.category;
      updateUrlAndNav();
      render();
    });
  }

  function renderSpecialStatus(studio) {
    const banner = document.getElementById("special-status-banner");
    if (studio.comparable) {
      banner.hidden = true;
      banner.innerHTML = "";
      return;
    }
    banner.hidden = false;
    banner.className = `special-status-banner special-status-${escapeHtml(studio.status_type)}`;
    banner.innerHTML = `<div class="special-status-icon" aria-hidden="true">${studio.status_type === "not-applicable" ? "N/A" : studio.status_type === "pilot" ? "P" : "NEW"}</div><div><p class="panel-kicker">Assessment status</p><h2>${escapeHtml(studio.assessment_status)}</h2><p>No score, denominator, average or matrix point is generated for this studio.</p></div>`;
  }

  function renderKpis(studio) {
    const nestle = studio.comparable ? studio.scores.nestle.overall : null;
    const wpp = studio.comparable ? studio.scores.wpp.overall : null;
    document.getElementById("kpi-nestle-score").textContent = formatScore(nestle);
    document.getElementById("kpi-wpp-score").textContent = formatScore(wpp);
    document.getElementById("kpi-combined-score").textContent = formatScore(studio.combined_score);
    document.getElementById("kpi-nestle-score").classList.toggle("is-missing", !hasValue(nestle));
    document.getElementById("kpi-wpp-score").classList.toggle("is-missing", !hasValue(wpp));
    document.getElementById("kpi-combined-score").classList.toggle("is-missing", !hasValue(studio.combined_score));
    const assessed = studio.criteria.filter((item) => item.assessed).length;
    const excluded = studio.excluded_source_items.length + studio.criteria.filter((item) => !item.assessed).length;
    document.getElementById("kpi-assessment-coverage").textContent = studio.comparable ? assessed.toLocaleString("en-GB") : "Not available";
    document.getElementById("kpi-assessment-coverage").classList.toggle("is-missing", !studio.comparable);
    document.getElementById("kpi-coverage-context").textContent = studio.comparable ? `${excluded} excluded source item${excluded === 1 ? "" : "s"}` : studio.assessment_status;
    document.getElementById("kpi-nestle-context").textContent = studio.comparable ? `${studio.scores.nestle.assessed_categories} assessed categories · equal weight` : studio.assessment_status;
    document.getElementById("kpi-wpp-context").textContent = studio.comparable ? `${studio.scores.wpp.assessed_categories} assessed categories · equal weight` : studio.assessment_status;
  }

  function insightCard(rank, tone, title, copy) {
    return `<article class="insight-item insight-${tone}"><span class="insight-rank">${String(rank).padStart(2, "0")}</span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(copy)}</p></div></article>`;
  }

  function buildTakeaways(studio) {
    if (!studio.comparable) {
      return [
        { tone: "scope", title: "Special status applied", copy: studio.assessment_status },
        { tone: "progress", title: "No inferred score", copy: "All score fields remain unavailable because a completed assessment was not provided." },
        { tone: "positive", title: "Comparison control", copy: "This studio is excluded from category averages, overall averages and the readiness matrix." }
      ];
    }
    const categoryPairs = data.categories.map((category) => {
      const nestle = studio.scores.nestle.categories[category.id].score;
      const wpp = studio.scores.wpp.categories[category.id].score;
      return { category, nestle, wpp, combined: hasValue(nestle) && hasValue(wpp) ? (nestle + wpp) / 2 : null };
    }).filter((item) => hasValue(item.combined));
    const ranked = [...categoryPairs].sort((a, b) => b.combined - a.combined || a.category.order - b.category.order);
    const strongest = ranked[0];
    const weakest = ranked[ranked.length - 1];
    const diff = studio.scores.wpp.overall - studio.scores.nestle.overall;
    const scoped = criteriaForView(studio);
    const fulfilled = scoped.filter((item) => item.normalized_value === 1).length;
    const partial = scoped.filter((item) => item.normalized_value > 0 && item.normalized_value < 1).length;
    const unfulfilled = scoped.filter((item) => item.normalized_value === 0).length;
    const open = scoped.filter((item) => hasValue(item.normalized_value) && item.normalized_value < 1);
    const overdue = open.filter((item) => item.target_date_overdue).length;
    const missingDates = open.filter((item) => item.target_date === "Not provided").length;
    const unassigned = open.filter((item) => item.owner === "Not provided").length;
    const dependencies = open.filter((item) => item.dependency !== "Not provided").length;
    const imbalanceCopy = Math.abs(diff) < 5
      ? `The two overall scores are within ${Math.abs(diff).toFixed(1)} percentage points.`
      : `${diff > 0 ? "WPP Readiness" : "Nestlé Enablement"} leads by ${Math.abs(diff).toFixed(1)} percentage points.`;
    const scopeCopy = filters.category === "all" ? "Across all four categories" : `Within ${data.categories.find((item) => item.id === filters.category).name}`;
    return [
      { tone: "positive", title: `Strongest: ${strongest.category.name}`, copy: `${formatScore(strongest.combined)} secondary category average; Nestlé ${formatScore(strongest.nestle)}, WPP ${formatScore(strongest.wpp)}.` },
      { tone: "attention", title: `Lowest: ${weakest.category.name}`, copy: `${formatScore(weakest.combined)} secondary category average; Nestlé ${formatScore(weakest.nestle)}, WPP ${formatScore(weakest.wpp)}.` },
      { tone: "progress", title: "Enablement-readiness balance", copy: imbalanceCopy },
      { tone: "scope", title: "Requirements and action controls", copy: `${scopeCopy}: ${fulfilled} fulfilled, ${partial} partial, ${unfulfilled} not fulfilled. Open items include ${overdue} overdue target date${overdue === 1 ? "" : "s"}, ${missingDates} missing target date${missingDates === 1 ? "" : "s"}, ${unassigned} unassigned and ${dependencies} with explicit dependencies or blockers.` }
    ];
  }

  function renderTakeaways(studio) {
    document.getElementById("scorecard-insights").innerHTML = buildTakeaways(studio).map((item, index) => insightCard(index + 1, item.tone, item.title, item.copy)).join("");
  }

  function scoreBar(label, score, calculation, colorClass) {
    const width = hasValue(score) ? Math.max(0, Math.min(100, Number(score))) : 0;
    return `<div class="category-score-row"><div class="category-score-label"><span>${escapeHtml(label)}</span><strong>${formatScore(score)}</strong></div><div class="category-score-track"><span class="${colorClass}" style="width:${width}%"></span></div><small>${formatValue(calculation.numerator)} ÷ ${calculation.denominator} assessed · ${calculation.excluded_items} excluded</small></div>`;
  }

  function renderCategories(studio) {
    const categories = data.categories.filter((category) => filters.category === "all" || category.id === filters.category);
    const container = document.getElementById("scorecard-category-grid");
    if (!studio.comparable) {
      container.innerHTML = `<article class="panel empty-scorecard-panel"><p class="panel-kicker">Category scores</p><h2>Not available</h2><p>${escapeHtml(studio.assessment_status)}</p></article>`;
      return;
    }
    container.innerHTML = categories.map((category) => {
      const nestle = studio.scores.nestle.categories[category.id];
      const wpp = studio.scores.wpp.categories[category.id];
      return `<article class="panel category-score-card"><div class="category-card-heading"><span>${String(category.order).padStart(2, "0")}</span><div><p class="panel-kicker">Equal-weight category</p><h2>${escapeHtml(category.name)}</h2></div></div>${scoreBar("Nestlé Enablement", nestle.score, nestle, "score-fill-nestle")}${scoreBar("WPP Readiness", wpp.score, wpp, "score-fill-wpp")}</article>`;
    }).join("");
  }

  function requirementItem(item) {
    const meta = [item.responsibility, item.category];
    if (item.owner && item.owner !== "Not provided") meta.push(`Owner: ${item.owner}`);
    if (item.target_date && item.target_date !== "Not provided") meta.push(`Target: ${item.target_date}`);
    return `<article class="requirement-item"><div>${statusBadge(item.current_status)}<span class="requirement-meta">${escapeHtml(meta.join(" · "))}</span></div><strong>${escapeHtml(item.simplified_requirement)}</strong><p>${escapeHtml(item.original_criterion)}</p></article>`;
  }

  function renderRequirements(studio) {
    const criteria = criteriaForView(studio);
    const strengths = criteria.filter((item) => item.normalized_value === 1);
    const missing = criteria.filter((item) => hasValue(item.normalized_value) && item.normalized_value < 1).sort((a, b) => a.normalized_value - b.normalized_value || a.category.localeCompare(b.category));
    document.getElementById("strength-count").textContent = studio.comparable ? `${strengths.length} fulfilled` : "Not assessed";
    document.getElementById("missing-count").textContent = studio.comparable ? `${missing.length} open` : "Not assessed";
    document.getElementById("strength-list").innerHTML = strengths.length ? strengths.map(requirementItem).join("") : `<div class="empty-list-state">${studio.comparable ? "No fulfilled criteria in this selection." : escapeHtml(studio.assessment_status)}</div>`;
    document.getElementById("missing-list").innerHTML = missing.length ? missing.map(requirementItem).join("") : `<div class="empty-list-state">${studio.comparable ? "No partially or unfulfilled criteria in this selection." : escapeHtml(studio.assessment_status)}</div>`;
  }

  const matrixLabelsPlugin = {
    id: "scorecardPointLabels",
    afterDatasetsDraw(chart) {
      const context = chart.ctx;
      context.save();
      context.font = "600 11px WPP, Arial, sans-serif";
      context.textAlign = "center";
      context.fillStyle = "#142235";
      chart.getDatasetMeta(0).data.forEach((point, index) => {
        const label = chart.data.datasets[0].data[index].studio;
        context.fillText(label, point.x, point.y - 12);
      });
      context.restore();
    }
  };

  const matrixMidlinesPlugin = {
    id: "scorecardMidlines",
    beforeDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea) return;
      ctx.save();
      ctx.strokeStyle = "rgba(20,34,53,.22)";
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(scales.x.getPixelForValue(50), chartArea.top);
      ctx.lineTo(scales.x.getPixelForValue(50), chartArea.bottom);
      ctx.moveTo(chartArea.left, scales.y.getPixelForValue(50));
      ctx.lineTo(chartArea.right, scales.y.getPixelForValue(50));
      ctx.stroke();
      ctx.restore();
    }
  };

  function renderMatrix(studio) {
    const points = data.studios.filter((item) => item.comparable && item.matrix_eligible).map((item) => ({
      x: item.scores.wpp.overall,
      y: item.scores.nestle.overall,
      studio: item.name,
      id: item.id
    }));
    if (matrixChart) matrixChart.destroy();
    matrixChart = new Chart(document.getElementById("readiness-matrix"), {
      type: "scatter",
      data: {
        datasets: [{
          label: "Completed assessments",
          data: points,
          parsing: false,
          pointRadius: points.map((point) => point.id === studio.id ? 8 : 6),
          pointHoverRadius: 9,
          pointBackgroundColor: points.map((point) => point.id === studio.id ? "#f15a4a" : "#0b2946"),
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        layout: { padding: { top: 20, right: 18 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#061a2e",
            padding: 12,
            titleFont: { family: "WPP", weight: "bold" },
            bodyFont: { family: "WPP" },
            callbacks: {
              title: (items) => items[0].raw.studio,
              label: (context) => [`WPP Readiness: ${formatScore(context.raw.x)}`, `Nestlé Enablement: ${formatScore(context.raw.y)}`]
            }
          }
        },
        scales: {
          x: { min: 0, max: 100, title: { display: true, text: "WPP Readiness", color: "#0b2946", font: { family: "WPP", weight: "bold" } }, grid: { color: "#e9edf1" }, ticks: { stepSize: 20, callback: (value) => `${value}%`, color: "#68778a", font: { family: "WPP" } }, border: { display: false } },
          y: { min: 0, max: 100, title: { display: true, text: "Nestlé Enablement", color: "#0b2946", font: { family: "WPP", weight: "bold" } }, grid: { color: "#e9edf1" }, ticks: { stepSize: 20, callback: (value) => `${value}%`, color: "#68778a", font: { family: "WPP" } }, border: { display: false } }
        }
      },
      plugins: [matrixMidlinesPlugin, matrixLabelsPlugin]
    });
  }

  function sourceCellNumber(value) { const match = String(value).match(/\d+/); return match ? Number(match[0]) : 0; }

  function renderDrilldowns(studio) {
    const container = document.getElementById("scorecard-drilldowns");
    if (!studio.comparable) {
      container.innerHTML = `<div class="empty-list-state">${escapeHtml(studio.assessment_status)} Original questions are unavailable until a completed assessment is provided.</div>`;
      return;
    }
    const categories = data.categories.filter((category) => filters.category === "all" || category.id === filters.category);
    container.innerHTML = categories.map((category, index) => {
      const items = studio.criteria.filter((item) => item.category_id === category.id).sort((a, b) => a.responsibility.localeCompare(b.responsibility) || sourceCellNumber(a.source_question_cell) - sourceCellNumber(b.source_question_cell));
      const excluded = studio.excluded_source_items.filter((item) => item.category_id === category.id);
      const rows = items.map((item) => `<tr><td>${escapeHtml(item.responsibility)}</td><td>${escapeHtml(item.original_criterion)}</td><td>${statusBadge(item.current_status)}</td><td class="numeric">${formatValue(item.normalized_value)}</td><td>${escapeHtml(item.source_answer_cells.join(", "))}</td><td>${escapeHtml(item.source_values.map((value) => value === null ? "blank" : String(value)).join(" · "))}</td></tr>`).join("");
      const excludedRows = excluded.map((item) => `<tr class="excluded-row"><td>${escapeHtml(item.responsibility)}</td><td>Blank source criterion</td><td>${statusBadge("Excluded")}</td><td class="numeric">—</td><td>${escapeHtml(item.source_answer_cells.join(", "))}</td><td>${escapeHtml(item.source_values.join(" · "))}</td></tr>`).join("");
      return `<details class="scorecard-category-details" ${filters.category !== "all" || index === 0 ? "open" : ""}><summary><span>${escapeHtml(category.name)}</span><small>${items.length} original questions · ${excluded.length} excluded source item${excluded.length === 1 ? "" : "s"}</small></summary><div class="table-scroll"><table class="criteria-table"><thead><tr><th>Responsibility</th><th>Original criterion</th><th>Status</th><th>Value</th><th>Source answer cell(s)</th><th>Source value(s)</th></tr></thead><tbody>${rows}${excludedRows}</tbody></table></div></details>`;
    }).join("");
  }

  function registerRow(item) {
    const target = item.target_date_overdue ? `${escapeHtml(item.target_date)} <span class="overdue-flag">Overdue</span>` : escapeHtml(item.target_date);
    return `<tr><td>${escapeHtml(item.category)}</td><td>${escapeHtml(item.original_criterion)}</td><td>${escapeHtml(item.simplified_requirement)}</td><td>${escapeHtml(item.responsibility)}</td><td>${statusBadge(item.current_status)}</td><td>${escapeHtml(item.evidence)}</td><td>${escapeHtml(item.missing_requirement)}</td><td>${escapeHtml(item.next_action)}</td><td>${escapeHtml(item.owner)}</td><td>${escapeHtml(item.dependency)}</td><td>${target}</td></tr>`;
  }

  function renderRegister(studio) {
    const tbody = document.getElementById("fulfilment-register-body");
    if (!studio.comparable) {
      tbody.innerHTML = `<tr><td>Not assessed</td><td>${escapeHtml(studio.assessment_status)}</td><td colspan="9"><span class="empty-cell">Not provided</span></td></tr>`;
      return;
    }
    tbody.innerHTML = criteriaForView(studio).map(registerRow).join("");
  }

  function bindDownloads(studio) {
    document.getElementById("download-score-summary").onclick = () => {
      const headers = ["Studio", "Assessment status", "Comparable", "Nestlé Enablement", "WPP Readiness", "Secondary combined"];
      data.categories.forEach((category) => headers.push(`Nestlé ${category.name}`, `WPP ${category.name}`));
      const rows = [headers];
      data.studios.forEach((item) => {
        const row = [item.name, item.assessment_status, item.comparable ? "Yes" : "No", item.comparable ? item.scores.nestle.overall : "", item.comparable ? item.scores.wpp.overall : "", item.combined_score ?? ""];
        data.categories.forEach((category) => row.push(item.comparable ? item.scores.nestle.categories[category.id].score : "", item.comparable ? item.scores.wpp.categories[category.id].score : ""));
        rows.push(row);
      });
      downloadCsv("aoa-studio-scorecard-summary.csv", rows);
    };
    document.getElementById("download-criteria").onclick = () => {
      const rows = [["Studio", "Responsibility", "Category", "Source category", "Original criterion", "Source question cell", "Source answer cells", "Source values", "Normalized value", "Assessed", "Exclusion reason"]];
      if (studio.comparable) {
        criteriaForView(studio).forEach((item) => rows.push([studio.name, item.responsibility, item.category, item.source_category, item.original_criterion, item.source_question_cell, item.source_answer_cells.join(" | "), item.source_values.join(" | "), item.normalized_value, item.assessed ? "Yes" : "No", item.exclusion_reason]));
        excludedForView(studio).forEach((item) => rows.push([studio.name, item.responsibility, item.category, item.source_category, item.original_criterion, item.source_question_cell, item.source_answer_cells.join(" | "), item.source_values.join(" | "), "", "No", item.exclusion_reason]));
      } else rows.push([studio.name, "", "", "", studio.assessment_status, "", "", "", "", "No", "Special status excluded from scoring"]);
      downloadCsv(`aoa-scorecard-criteria-${studio.id}.csv`, rows);
    };
    document.getElementById("download-fulfilment").onclick = () => {
      const rows = [["Studio", "Category", "Original criterion", "Simplified requirement", "Nestlé/WPP responsibility", "Current status", "Evidence", "Missing requirement", "Next action", "Owner", "Dependency", "Target date"]];
      if (studio.comparable) criteriaForView(studio).forEach((item) => rows.push([studio.name, item.category, item.original_criterion, item.simplified_requirement, item.responsibility, item.current_status, item.evidence, item.missing_requirement, item.next_action, item.owner, item.dependency, item.target_date]));
      else rows.push([studio.name, "Not assessed", studio.assessment_status, "Not provided", "Not provided", studio.assessment_status, "Not provided", "Not provided", "Not provided", "Not provided", "Not provided", "Not provided"]);
      downloadCsv(`aoa-fulfilment-register-${studio.id}.csv`, rows);
    };
  }

  function render() {
    const studio = currentStudio();
    renderSpecialStatus(studio);
    renderKpis(studio);
    renderTakeaways(studio);
    renderCategories(studio);
    renderRequirements(studio);
    renderMatrix(studio);
    renderDrilldowns(studio);
    renderRegister(studio);
    bindDownloads(studio);
  }

  function bindRegenerate() {
    document.getElementById("regenerate-scorecard-takeaways").addEventListener("click", (event) => {
      const button = event.currentTarget;
      button.classList.remove("is-spinning");
      void button.offsetWidth;
      button.classList.add("is-spinning");
      renderTakeaways(currentStudio());
      window.setTimeout(() => button.classList.remove("is-spinning"), 500);
    });
  }

  async function init() {
    try {
      const response = await fetch(DATA_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`Scorecard request failed with status ${response.status}.`);
      validateScorecardData(await response.json());
      readInitialFilters();
      populateFilters();
      updateUrlAndNav();
      bindRegenerate();
      document.getElementById("scorecard-updated").textContent = formatDate(data.meta.assessment_date);
      document.getElementById("scorecard-loading").hidden = true;
      document.getElementById("scorecard-content").hidden = false;
      render();
    } catch (error) {
      document.getElementById("scorecard-loading").hidden = true;
      const target = document.getElementById("scorecard-error");
      target.hidden = false;
      target.innerHTML = `<div><strong>We could not load the Studio Scorecards.</strong><br>${escapeHtml(error.message)}<br><small>Run the site through a local HTTP server and confirm data/scorecards.json is present.</small></div>`;
    }
  }

  window.ScorecardTestHooks = { buildCsv, validateScorecardData, sideCalculation, buildTakeaways };
  document.addEventListener("DOMContentLoaded", init);
})();
