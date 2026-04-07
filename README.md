# TokenPulse

[English](./README.md) | [简体中文](./README.zh-CN.md)

A personal token cost analytics dashboard that aggregates local Codex / OpenClaw / Claude session data, then visualizes token usage and USD cost by model and date.

![TokenPulse Dashboard](./public/site-preview.png)

## Features

- Overview cards for lifetime, last 30 days, last 7 days, and today
- Token unit switch in sidebar (`M` / `亿`)
- Token trend chart with `Bar` / `Line` mode and 7/30/90/180-day ranges
- Top Token Days table sorted by total tokens
- Model Cost Share pie chart
- One-click data sync via `/api/sync-data` with backup and refresh

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- Recharts
- Python (data sync scripts)

## Project Structure

```text
.
├─ src/
│  ├─ app/
│  │  ├─ api/sync-data/route.ts      # Sync API endpoint (triggers Python scripts)
│  │  ├─ page.tsx                    # Main dashboard page
│  │  └─ layout.tsx
│  ├─ components/
│  │  ├─ dashboard/                  # Chart and panel components
│  │  ├─ sync-data-button.tsx
│  │  ├─ theme-mode-select.tsx
│  │  └─ token-unit-toggle.tsx
│  └─ lib/
│     ├─ dashboard-data.ts           # Data types and aggregation helpers
│     └─ formatters.ts               # Display formatters
├─ data/
│  ├─ dashboard-data.json            # Dashboard data source
│  └─ backups/                       # Auto backups on sync
├─ scripts/
│  └─ sync_dashboard_data.py         # Generate dashboard-data.json
├─ model_cost.json                   # Model pricing config
└─ sync_codex_token_usage_excel.py   # Export Excel usage report
```

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Start development server

```bash
npm run dev
```

Default URL: `http://localhost:3001` (port may change if occupied).

### 3. Production build

```bash
npm run build
npm run start
```

## Data Sync

### Option A: Sync from UI (recommended)

Click **Sync Data** in the top-right corner. It calls `POST /api/sync-data` and:

1. Backs up `dashboard-data.json` and Excel files into `data/backups/`
2. Runs Python scripts to rebuild data
3. Refreshes the dashboard

### Option B: Sync from CLI

```bash
npm run sync:data
```

This runs `scripts/sync_dashboard_data.py`.

## Available Scripts

- `npm run dev`: start dev server
- `npm run build`: build for production
- `npm run start`: run production server
- `npm run lint`: run ESLint
- `npm run sync:data`: generate dashboard data from local session sources

## Data Sources & Requirements

By default, data is collected from:

- `~/.codex`
- `~/.openclaw`
- `~/.claude`

Cost calculation uses `model_cost.json`. If your local paths differ, adjust script arguments or the API implementation.

## Notes

- The repository currently has existing ESLint issues unrelated to README changes.
- `site-preview.png` is a local deployment screenshot and can be updated anytime.

## License

MIT
