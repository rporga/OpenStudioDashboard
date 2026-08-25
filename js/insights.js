(function () {
  const Calc = window.DashboardCalc;

  function item(title, copy, tone = "neutral") {
    return { title, copy, tone };
  }

  function absoluteChange(current, prior) {
    return prior > 0 ? ((current - prior) / prior) * 100 : null;
  }

  function statusInsight(summary) {
    if (!summary.currentVolume) return null;
    const delayedShare = Calc.percentage(summary.delayed, summary.currentVolume);
    const onTrackShare = Calc.percentage(summary.onTrack, summary.currentVolume);
    const completedShare = Calc.percentage(summary.completed, summary.currentVolume);
    if (delayedShare >= 5) return item(
      `${Calc.formatNumber(summary.delayed)} assets are delayed`,
      `${Calc.formatPercent(delayedShare, 1)} of the selected current volume is marked Delayed.`,
      "attention"
    );
    if (onTrackShare >= 30) return item(
      `${Calc.formatPercent(onTrackShare, 1)} of volume remains On-Track`,
      `${Calc.formatNumber(summary.onTrack)} assets are progressing and remain separate from Completed.`,
      "progress"
    );
    return item(
      `${Calc.formatPercent(completedShare, 1)} of volume is Completed`,
      `${Calc.formatNumber(summary.completed)} of ${Calc.formatNumber(summary.currentVolume)} current assets are marked Completed.`,
      completedShare >= 80 ? "positive" : "neutral"
    );
  }

  function mixInsight(summary) {
    if (!summary.currentVolume) return null;
    const adaptationAndOthers = summary.adaptation + summary.other;
    const creationShare = Calc.percentage(summary.creation, summary.currentVolume);
    const adaptationShare = Calc.percentage(adaptationAndOthers, summary.currentVolume);
    if (creationShare >= 65) return item(
      `Creation represents ${Calc.formatPercent(creationShare, 1)} of output`,
      `${Calc.formatNumber(summary.creation)} Creation versus ${Calc.formatNumber(adaptationAndOthers)} Adaptation + Others.`,
      "neutral"
    );
    if (adaptationShare >= 65) return item(
      `Adaptation + Others represents ${Calc.formatPercent(adaptationShare, 1)} of output`,
      `${Calc.formatNumber(adaptationAndOthers)} Adaptation + Others versus ${Calc.formatNumber(summary.creation)} Creation.`,
      "neutral"
    );
    return item(
      "Creation and Adaptation + Others are relatively balanced",
      `${Calc.formatNumber(summary.creation)} Creation and ${Calc.formatNumber(adaptationAndOthers)} Adaptation + Others are recorded.`,
      "neutral"
    );
  }

  function marketInsights(filters, row) {
    const { summary, history, plan, market } = row;
    const fullView = filters.quarter === "all" && filters.typology === "all";
    if (!row.hasCurrentVolume && Calc.hasValue(summary.planned)) return [item(
      `${Calc.formatNumber(summary.planned)} assets in FY2026 scope`,
      `${market.name}'s ${plan?.plan_scope || "full-year scope"} is confirmed.`,
      "scope"
    )];
    if (!row.hasCurrentVolume) return [item(
      "No current volume for this selection",
      "The dashboard will calculate takeaways automatically when matching data is available.",
      "neutral"
    )];

    const insights = [];
    if (fullView && Calc.hasValue(summary.planYoyChange)) {
      const change = summary.planYoyChange;
      const lower = change < 0;
      const flat = change === 0;
      insights.push(item(
        flat ? "FY2026 scope is unchanged from FY2025" : `FY2026 scope is ${Calc.formatPercent(Math.abs(change), 1)} ${lower ? "lower" : "higher"} than FY2025`,
        `${Calc.formatNumber(summary.planned)} planned assets versus ${Calc.formatNumber(history.assets_delivered)} in FY2025.`,
        flat ? "neutral" : lower ? "decrease" : "increase"
      ));
    } else if (fullView && Calc.hasValue(summary.planned)) {
      insights.push(item(
        `${Calc.formatNumber(summary.planned)} assets in FY2026 scope`,
        "A comparable FY2025 full-year output is awaiting data.",
        "scope"
      ));
    }
    if (fullView && Calc.hasValue(summary.utilization)) {
      const utilization = summary.utilization;
      const label = utilization >= 100 ? "has reached" : utilization >= 75 ? "is approaching" : utilization >= 50 ? "has passed halfway through" : "has started against";
      insights.push(item(
        `${market.name} ${label} its FY2026 scope`,
        `${Calc.formatNumber(summary.currentVolume)} current assets represent ${Calc.formatPercent(utilization, 1)} of the ${Calc.formatNumber(summary.planned)} full-year scope.`,
        utilization >= 75 ? "positive" : "progress"
      ));
    } else {
      insights.push(item(
        `${Calc.formatNumber(summary.currentVolume)} assets in the selected view`,
        fullView ? `${market.name}'s current tracker volume is available; FY scope is still required for utilization.` : "This takeaway reflects the active quarter and typology filters.",
        "neutral"
      ));
    }

    if (fullView && !Calc.hasValue(summary.planned) && Calc.hasValue(history?.assets_delivered)) {
      const pilot = /pilot/i.test(`${history.period_label || ""} ${history.comparison_note || ""}`);
      insights.push(item(
        pilot ? `${Calc.formatNumber(summary.currentVolume)} current assets vs ${Calc.formatNumber(history.assets_delivered)} in the FY2025 pilot` : `FY2025 output was ${Calc.formatNumber(history.assets_delivered)} assets`,
        pilot ? "The pilot started late, so no year-on-year percentage is applied." : "FY2026 full-year scope is still required before calculating a comparable increase or decrease.",
        "neutral"
      ));
    }

    const status = statusInsight(summary);
    if (status) insights.push(status);
    const mix = mixInsight(summary);
    if (mix) insights.push(mix);
    return insights.slice(0, 4);
  }

  function portfolioInsights(data, filters, rows) {
    const summary = Calc.portfolioAssetSummary(rows, data, filters);
    const fullView = filters.quarter === "all" && filters.typology === "all";
    const insights = [];
    if (!summary.currentVolume) return [item("No current volume for this selection", "Adjust the filters or add matching market data.")];

    if (fullView && Calc.hasValue(summary.planYoyChange)) {
      const change = summary.planYoyChange;
      const lower = change < 0;
      const flat = change === 0;
      insights.push(item(
        flat ? "Comparable FY2026 scope is unchanged from FY2025" : `Comparable FY2026 scope is ${Calc.formatPercent(Math.abs(change), 1)} ${lower ? "lower" : "higher"} than FY2025`,
        `${Calc.formatNumber(summary.comparablePlanTotal)} planned assets versus ${Calc.formatNumber(summary.comparablePlanHistory)} across ${summary.planComparisonMarkets} comparable studio${summary.planComparisonMarkets === 1 ? "" : "s"}. ${Calc.formatNumber(summary.planned)} total FY2026 scope is currently known across ${summary.knownPlanMarkets} studios.`,
        flat ? "neutral" : lower ? "decrease" : "increase"
      ));
    } else {
      insights.push(item(
        `${Calc.formatNumber(summary.currentVolume)} assets match the selected filters`,
        "Portfolio takeaways update with the active quarter and content typology.",
        "neutral"
      ));
    }

    const status = statusInsight(summary);
    if (status) insights.push(status);

    if (fullView && Calc.hasValue(summary.utilization)) {
      insights.push(item(
        `${Calc.formatPercent(summary.utilization, 1)} of matched FY2026 scope is represented`,
        `${Calc.formatNumber(summary.comparableCurrentVolume)} delivered assets against ${Calc.formatNumber(summary.comparablePlanned)} scope across ${summary.comparableMarkets} comparable studio${summary.comparableMarkets === 1 ? "" : "s"}.`,
        "progress"
      ));
    } else if (fullView && Calc.hasValue(summary.planned)) {
      const scopedRows = rows.filter((row) => Calc.hasValue(row.summary.planned));
      const largest = scopedRows.sort((a, b) => b.summary.planned - a.summary.planned)[0];
      const concentration = largest ? Calc.percentage(largest.summary.planned, summary.planned) : null;
      insights.push(item(
        `${Calc.formatNumber(summary.planned)} assets in known FY2026 scope`,
        largest ? `${largest.market.name} represents ${Calc.formatPercent(concentration, 1)} of scope currently supplied across ${scopedRows.length} studios.` : `${scopedRows.length} studios currently have confirmed scope.`,
        "scope"
      ));
    }

    const mix = mixInsight(summary);
    if (mix) insights.push(mix);
    return insights.slice(0, 4);
  }

  function generate(data, filters, rows) {
    return filters.market === "all" ? portfolioInsights(data, filters, rows) : marketInsights(filters, rows[0]);
  }

  window.DashboardInsights = { generate, absoluteChange, statusInsight, mixInsight };
})();
