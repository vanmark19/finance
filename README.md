# FinTrack — personal finance & ETF tracker (PWA)

React + TypeScript + Vite + Tailwind + Recharts + Dexie (IndexedDB). No backend: **all data stays on your device**.

## Install & run
```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for money, returns (Modified Dietz, XIRR), investment & stats logic (Node >= 22.6)
npm run build      # outputs dist/
```
Base path is configurable: `VITE_BASE=/your-repo/ npm run build` (default `/`).

## Deploy to GitHub Pages
> Lockfile: the workflow uses `npm install` because no `package-lock.json` is included. Recommended: run `npm install` locally once, commit the generated `package-lock.json`, then change the workflow to `npm ci` and add `cache: npm` under `setup-node` for reproducible builds.

1. Push this folder to a GitHub repository (source code only — never commit backups).
2. Repo → Settings → Pages → Source: **GitHub Actions**.
3. Push to `main`. `.github/workflows/deploy.yml` runs tests, builds with `VITE_BASE=/<repo-name>/` and publishes.

## Install on iPhone
Open the Pages URL in **Safari** → Share → **Add to Home Screen**. It opens full-screen and works offline after the first load.

## How data is stored
Everything lives in the browser's IndexedDB (database `fintrack`) on that device/browser. iOS may clear website data for sites unused for long periods in Safari tabs; the installed Home Screen app is more durable, and the app requests persistent storage. **Export a JSON backup regularly** (Settings → Date și backup); the app reminds you after 30 days.

## Backups
- **Export JSON**: full database (transactions, categories, budget %, snapshots, exchange-rate history, settings, initial setup).
- **Import JSON**: validated before anything changes; choose *Replace* (wipes current data) or *Merge* (by record id).
- **Export CSV**: transactions (UTF-8 with BOM, opens in Excel).

## Calculation notes
- Money is stored as integer minor units (bani/cents); each transaction keeps its original currency and the EUR/RON rate used.
- ETF contributions are *derived* from expenses in the chosen ETF subcategory (Settings → Investiții); nothing is stored twice.
- Investments are two independent portfolios (RON and EUR), each in its own currency: no exchange rate and no combined total. A RON ETF purchase only affects the RON portfolio, an EUR one only the EUR portfolio.
- Profit = portfolio value − cumulative contributions. Period returns use Modified Dietz (estimates); annualized return uses XIRR and is hidden without enough data.
- EUR/RON rates (Frankfurter, frankfurter.app) are used only to convert regular transactions into RON totals on the dashboard, budget and statistics — never for investments. Offline, the last cached rate is used and flagged; missing historical rates must be entered manually.
