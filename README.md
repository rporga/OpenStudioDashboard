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
- `budget.html`: Q2RF budget, approved AgencyMania fee, actual spend, Studio/KOL splits and financial completeness.
- `data-status.html`: market-by-market data completeness and quality issues.

## Data structure

The local source is `public/dashboard/data/dashboard-data.json`.

Top-level collections:

- `markets`: market names and stable IDs.
- `assets`: normalized asset rows by fiscal year, month, market, typology, asset type and delivery status.
- `finance`: one row per market and fiscal year.
- `data_status`: completeness status for each required data area.
- `quality_issues`: explicit warnings that should appear in the dashboard.
- `tat_settings`: the TAT definition, deduplication key and standard-scope threshold.
- `tat_records`: one normalized record per unique brief, including dates, classification, duration and scope class.

Unknown values must be stored as `null`. Use numeric zero only when the source confirms that the value is genuinely zero.

## Add a market

1. Add the market once to `markets` with a unique lowercase `id`.
2. Add its normalized records to `assets`.
3. Add one annual row to `finance`.
4. Add one row to `data_status`.
5. Add any known warning to `quality_issues`.

The navigation filters, charts and tables read market options from the data and do not require UI code changes.

## Update a market

- Asset records require: `fiscal_year`, `month`, `quarter`, `market_id`, `content_typology`, `asset_type`, `delivery_status`, and `asset_volume`.
- Financial records keep Q2RF budget, approved AM Net Fee and actual spend separate.
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

- Total FY Assets: assets with a valid delivery date in the selected fiscal year and filters.
- Completed / Used Assets: filtered assets marked `Completed`.
- Delivery Utilization: completed assets divided by filtered FY asset volume.
- Average Monthly Delivery: completed assets divided by elapsed months in the selected year; completed historical years use 12.
- Turnaround Time (TAT): calendar days from `Project Brief Date` to the latest completed `Project Delivery Date`, calculated once per unique brief.
- Median TAT: the middle duration across included briefs. This is the default because long project windows can distort an average.
- Average TAT: the arithmetic mean across included briefs. It is available through the TAT toggle but should be interpreted with the displayed scope note.
- Standard TAT scope: completed briefs with valid chronological dates and a duration of 90 calendar days or less.
- Long-running scope: a brief above 90 calendar days. These are excluded by default and can be included through the TAT scope toggle.
- Approved AM Net Fee: the `Approved AM Net Fee USD000 @1.237` measure. It is not actual spend.
- Remaining Budget: Q2RF budget minus actual spend. It remains unavailable while actual spend is missing.

## Known data-quality issues

- Thailand: 465 FY26 assets are currently unclassified by asset type.
- Thailand: valid overall brief durations are available, but FY26 creation/adaptation classification is not complete.
- TAT date issues: one Japan brief, one MENA brief and three Philippines briefs contain invalid date sequences and are excluded.
- TAT is an end-to-end recorded project window, not active working time; weekends, holds and client approval pauses are not removed.
- Assets without a delivery date are included in FY26 totals but are not assigned to a monthly or quarterly chart bucket.
- China and Malaysia: data is awaiting submission.
- Actual spend and Studio/KOL financial splits are not yet available.
- Approved AM Net Fee is available only for Thailand and Vietnam in the current source.

## Verification

Run `npm run build` for the production build. The dashboard also contains downloadable CSV summaries so filtered results can be checked outside the interface.
