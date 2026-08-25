# AOA Content Studio Dashboard

A responsive, multipage Content Studio Tracker for AOA studio asset delivery, output mix, financial coverage, and data quality.

The user-facing dashboard is a vanilla HTML/CSS/JavaScript application in `public/dashboard/`. The project shell redirects its root route to the static dashboard.

## Run locally

### Quickest option

1. Open a terminal in `public/dashboard/`.
2. Run `python3 -m http.server 8000`.
3. Open `http://localhost:8000/index.html`.

Do not open the HTML by double-clicking it. Browsers can block the dashboard from loading its JSON file through a `file://` address.

### Full project option

1. Run `npm install` if dependencies are not already present.
2. Run `npm run dev`.
3. Open the local address shown in the terminal. The root route redirects to the dashboard.

## Pages

- `index.html`: toggles between asset output and turnaround-time views, including market, creation/adaptation and delivery-band comparisons.
- `budget.html`: Nestlé Budget, Approved in AM, Used So Far, Studio/KOL splits and financial completeness.
- `data-status.html`: market-by-market data completeness.

## Data structure

The local source is `public/dashboard/data/dashboard-data.json`.

Top-level collections:

- `markets`: market names and stable IDs.
- `assets`: normalized asset rows by fiscal year, month, market, typology, asset type and delivery status.
- `asset_plans`: full-year scope, current tracker volume and utilization percentages. A missing scope is `null`.
- `historical_assets`: FY2025 or other prior reported output, including a comparability flag.
- `finance`: one row per market and fiscal year.
- `data_status`: completeness status for each required data area.
- `quality_issues`: internal audit notes retained in the data source; they are not rendered as stacked public notices.
- `tat_settings`: the TAT definition, deduplication key and standard-scope threshold.
- `tat_records`: one normalized record per unique brief, including dates, classification, duration and scope class.

Unknown values must be stored as `null`. Use numeric zero only when the source confirms that the value is genuinely zero.

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

The Asset Dashboard generates up to four ranked takeaways directly from the active JSON and filters. The rule-based engine compares confirmed FY2026 full-year scope with comparable FY2025 full-year output, then surfaces utilization, project-status mix and Creation versus Adaptation + Others. Increases are green, decreases are coral, and the wording describes direction without automatically treating lower volume as underperformance. It does not use fixed market copy or invent missing values. Pilot or non-comparable periods are labelled without calculating a misleading year-on-year percentage.

## Update a market

- Asset records require: `fiscal_year`, `month`, `quarter`, `market_id`, `content_typology`, `asset_type`, `delivery_status`, and `asset_volume`.
- Financial records keep Nestlé Budget, Approved in AM and Used So Far separate.
- Update `meta.source_updated_at`, each relevant row's `last_updated`, and the market's status fields.

## Switch to an online source

Edit `public/dashboard/js/config.js`:

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
- Average Monthly Volume: current tracker volume divided by elapsed reporting months. It is a pace indicator, not a full-year forecast.
- Creation and Adaptation: only quantities explicitly classified into those two categories. Localization, transcreation, compositioning, versioning and unclassified work remain separate in the source and are not shown as a headline KPI.
- Turnaround Time (TAT): calendar days from `Project Brief Date` to the latest completed `Project Delivery Date`, calculated once per unique brief.
- Median TAT: the middle duration across included briefs. This is the default because long project windows can distort an average.
- Average TAT: the arithmetic mean across included briefs. It is available through the TAT toggle but should be interpreted with the displayed scope note.
- Standard TAT scope: completed briefs with valid chronological dates and a duration of 90 calendar days or less.
- Long-running scope: a brief above 90 calendar days. These are excluded by default and can be included through the TAT scope toggle.
- Approved AM Net Fee: the `Approved AM Net Fee USD000 @1.237` measure. It is not actual spend.
- Nestlé Budget: the confirmed annual Nestlé budget in USD000.
- Approved in AM: Approved AgencyMania Net Fee. It is secured scope, not utilised spend.
- Used So Far: the actual amount utilised to date. Missing values remain `null`.

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
- Approved AM Net Fee is available only for Thailand and Vietnam in the current source.

## Verification

Run `npm run build` for the production build. The dashboard also contains downloadable CSV summaries so filtered results can be checked outside the interface.
