# AOA Content Studio Dashboard

A responsive, multipage Content Studio Tracker for AOA studio asset delivery, output mix, financial coverage, data quality, and Studio Scorecards.

The user-facing dashboard is a vanilla HTML/CSS/JavaScript application. All website files in this package are at the ZIP root and can be served directly as a static site.

## Run locally

### Quickest option

1. Extract the complete website ZIP and open a terminal in the extracted folder.
2. Run `python3 -m http.server 8000`.
3. Open `http://localhost:8000/index.html`.

Do not open the HTML by double-clicking it. Browsers can block the dashboard from loading its JSON file through a `file://` address.

## Pages

- `index.html`: toggles between asset output and turnaround-time views, including market, creation/adaptation and delivery-band comparisons. The asset summary also shows a filter-aware Total Studio Score sourced from completed comparable scorecards.
- `budget.html`: Nestlé Budget, Approved in AM, Used So Far, Studio/KOL splits, financial completeness and a USD/CHF display toggle.
- `scorecards.html`: Nestlé Enablement and WPP Readiness scores, four equal-weight pillar diagnoses, dependency-gated fulfilment pathways, source-backed market actions, production/brand context, rule-based takeaways, readiness matrix, source-question drill-downs, fulfilment register and CSV downloads.
- `score-validation-report.html`: source-to-score audit showing every criterion, normalized value, exclusion and category/overall calculation.
- `data-status.html`: market-by-market data completeness.

## Data structure

The existing reporting source is `data/dashboard-data.json`.

Top-level collections:

- `markets`: market names and stable IDs.
- `assets`: normalized asset rows by fiscal year, month, market, typology, asset type and delivery status.
- `asset_dimensions`: source-traceable asset rows for Brand, Procurement Sub-Category and Complexity analysis. Blank and placeholder taxonomy values are normalized to `Unclassified`.
- `asset_plans`: full-year scope, current tracker volume and utilization percentages. A missing scope is `null`.
- `historical_assets`: FY2025 or other prior reported output, including a comparability flag.
- `finance`: one row per market and fiscal year.
- `data_status`: completeness status for each required data area.
- `quality_issues`: internal audit notes retained in the data source; they are not rendered as stacked public notices.
- `tat_settings`: the TAT definition, deduplication key and standard-scope threshold.
- `tat_records`: one normalized record per unique brief, including dates, classification, duration and scope class.

Unknown values must be stored as `null`. Use numeric zero only when the source confirms that the value is genuinely zero.

The Studio Scorecards source is `data/scorecards.json`. It contains the four category definitions, six comparable completed assessments, two special-status studios, original questions, source-cell traces, normalized values, score calculations, status-workbook evidence, production footprints, dependency rules and action pathways. Static all-studio exports are available in `data/score-validation.csv`, `data/fulfilment-register.csv` and `data/pillar-action-plan.csv`.

## Studio Scorecards method

- Completed assessments: Philippines, Thailand, Japan, MENA, India and Vietnam. These are sourced from the six supplied `WIP_AOA Studio Grading System_*.xlsx` workbooks.
- Special statuses: China is a New Studio and Malaysia is a Pilot. These studios are never scored, averaged or plotted in the readiness matrix.
- Categories: Operational Excellence & Hygiene, Strategic Thinking, Category Expertise and Production Excellence. Each assessed category has equal weight in its respective overall score.
- Fulfilled = 1; Partially fulfilled or In progress = 0.5; Not fulfilled = 0. Blank or not assessed criteria are excluded from the denominator.
- Nestlé Enablement and WPP Readiness are calculated separately. The combined score is secondary and exists only when both overall scores are available.
- Key Takeaways are deterministic and rule-based. They use pillar ranking, the Nestlé/WPP imbalance, fulfilled strengths, open/unassessed requirements, missing or past-due dates, unassigned actions and explicit dependencies or blockers.
- Every open requirement remains under its original pillar and is grouped by responsibility and control theme. Its pathway follows `Unlock` when a dependency exists, then `Build`, then `Prove` against source evidence or the original criterion.
- Source-stated dependencies are preserved. Additional prerequisite or build-after-scope links are labelled `Rule-based`; they never change a score.
- Brands and tracked production categories come from FY2026 asset records. They indicate production exposure only and are never treated as automatic proof of category-expertise fulfilment.
- Unavailable evidence, action, owner, dependency or date information is displayed as `Not provided`.

The Vietnam grading file is treated as a completed assessment because both its file name and worksheet identify Vietnam and all assessment inputs are populated. Its title cell still says `India`; that source ambiguity is retained in the validation report and no value is altered.

## Add a market

1. Add the market once to `markets` with a unique lowercase `id`.
2. Add its normalized records to `assets`.
3. Add its annual plan to `asset_plans`, even when the plan value is `null`.
4. Add its prior-period reference to `historical_assets`.
5. Add one annual row to `finance`.
6. Add one row to `data_status`.
7. Add any internal reconciliation note to `quality_issues` when needed.

The navigation filters, charts and tables read market options from the data and do not require UI code changes.

## Dynamic key takeaways

The Asset Dashboard generates four ranked takeaways directly from the active JSON and filters. Use **Regenerate takeaways** to cycle through other valid observations for the same selection. The rule-based engine surfaces data coverage, utilization, project-status mix, delivery pace, Creation versus Adaptation + Others, leading brands and complexity-classification patterns. An All Studios increase or decrease is shown only when every studio has comparable FY2025 and FY2026 scope data; while coverage is incomplete, it displays a neutral coverage statement instead. Market-level comparisons remain available when that individual market has valid like-for-like data. The dashboard does not use fixed market copy, extrapolate incomplete totals or invent missing values.

## Update a market

- Asset records require: `fiscal_year`, `month`, `quarter`, `market_id`, `content_typology`, `asset_type`, `delivery_status`, and `asset_volume`.
- Financial records keep Nestlé Budget, Approved in AM and Used So Far separate.
- Store finance calculations in the canonical `*_usd000` fields. The Budget Dashboard converts the display to CHF using `settings.usd_to_chf_conversion`; it does not overwrite or recalculate the source data.
- Update `meta.source_updated_at`, each relevant row's `last_updated`, and the market's status fields.

## Switch to an online source

Edit `js/config.js`:

```javascript
window.DATA_CONFIG = {
  mode: "online",
  localUrl: "./data/dashboard-data.json",
  onlineUrl: "YOUR_GOOGLE_APPS_SCRIPT_JSON_ENDPOINT",
  fallbackToLocal: true
};
```

The online endpoint must return the same normalized JSON structure. When the online request fails and `fallbackToLocal` is true, the dashboard displays a warning and loads the local file.

## Metric definitions

- FY2026 Full-Year Scope: the confirmed full-year planned asset quantity stored in `asset_plans`. Missing scope remains `null`.
- Current Tracker Volume: all Procurement `Quantity of Deliverables` currently recorded, across Completed, On-Track, Delayed, Not Started and unclassified project statuses.
- Completed: the subset of current tracker volume whose Project Status is `Completed`.
- On-Track: the subset whose Project Status is `On-Track`; it is never merged into Completed.
- Utilization Percentage: current tracker volume divided by FY scope. It appears only when both values are available and full-year filters are selected.
- Total Studio Score: the selected market’s secondary combined score, or for All Studios the average secondary combined score across the six completed comparable assessments. The card also shows the separate Nestlé and WPP averages; China and Malaysia are excluded, and asset quarter/typology filters do not alter assessment scores.
- Average Monthly Volume: current tracker volume divided by elapsed reporting months. It is a pace indicator, not a full-year forecast.
- Creation and Adaptation: only quantities explicitly classified into those two categories. Localization, transcreation, compositioning, versioning and unclassified work remain separate in the source and are not shown as a headline KPI.
- Brand volume: asset quantity grouped by `Master Brand`. Blank source values remain visible as `Unclassified`.
- Category volume: asset quantity grouped by the tracker `Sub-Category` field. Placeholder selections remain visible as `Unclassified`.
- Complexity: asset quantity grouped as High, Middle, Low or Unclassified. Both blank values and placeholder selections are included in Unclassified.
- Turnaround Time (TAT): calendar days from `Project Brief Date` to the latest completed `Project Delivery Date`, calculated once per unique brief.
- Median TAT: the middle duration across included briefs. This is the default because long project windows can distort an average.
- Average TAT: the arithmetic mean across included briefs. It is available through the TAT toggle but should be interpreted with the displayed scope note.
- Standard TAT scope: completed briefs with valid chronological dates and a duration of 90 calendar days or less.
- Long-running scope: a brief above 90 calendar days. These are excluded by default and can be included through the TAT scope toggle.
- Approved AM Net Fee: the `Approved AM Net Fee USD000 @1.237` measure. It is not actual spend.
- Nestlé Budget: the confirmed annual Nestlé budget in USD000.
- Approved in AM: Approved AgencyMania Net Fee. It is secured scope, not utilised spend.
- Used So Far: the actual amount utilised to date. Missing values remain `null`.
- Currency toggle: USD is the calculation base. CHF display values are calculated as USD divided by 1.237. Approved AgencyMania CHF source lines are normalized to USD by multiplying by 1.237.
- Approved AM year-on-year: the Budget table shows increase/decrease only when the same market has both FY2025 and FY2026 Approved AM values. The All Studios KPI compares matched markets only; it never compares two different market sets.

## Known data-quality issues

- Thailand: 656 of 884 tracker deliverables are currently unclassified by asset type.
- Philippines: 27 of 943 current tracker assets have no selected project status. A repeated quantity-2 source row is retained because 943 is the market-confirmed total.
- Thailand: a repeated quantity-2 source row is retained because 884 is the market-confirmed total.
- Thailand: valid overall brief durations are available, but creation/adaptation classification is not complete.
- Vietnam: one quantity with malformed text dates is excluded to reconcile the confirmed current volume of 186.
- Japan: one exact duplicate and one invalid-brief-date quantity are excluded to reconcile the confirmed current volume of 470.
- TAT date issues: one Japan brief, one MENA brief and three Philippines briefs contain invalid date sequences and are excluded.
- TAT is an end-to-end recorded project window, not active working time; weekends, holds and client approval pauses are not removed.
- Tracker rows without a usable month are included in current volume but not assigned to the monthly trend.
- China: FY2026 full-year scope is 3,634 assets; current tracker volume is awaiting data.
- Malaysia: 31 is the FY2026 full-year pilot scope; current tracker volume is awaiting data.
- India: current tracker volume is 223. FY2025 output of 449 came from a late-start pilot, so no year-on-year percentage is calculated.
- Used So Far is not yet available. Studio/KOL budget splits are available only for Thailand and China.
- Philippines: FY2026 Nestlé Budget is USD 773,310.96.
- Approved AM Net Fee is currently available for Thailand, Vietnam, Japan and Malaysia. China and South Africa were deliberately excluded from the latest AgencyMania screenshot update.
- Full FY2025 Approved AM values are available for Philippines, Thailand/Indochina, Vietnam and MENA. Indochina is mapped to Thailand. FY2025 China is missing rather than zero.

## Verification

Serve the folder locally, then open each page through `http://localhost`; JSON loading is not reliable through a `file://` address. The dashboard contains downloadable CSV summaries so filtered results can be checked outside the interface. Use `score-validation-report.html` and `data/score-validation.csv` for the criterion-level scoring audit, and `data/pillar-action-plan.csv` for the sourced operating sequence and dependency controls.
