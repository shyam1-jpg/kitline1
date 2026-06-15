# Kiteline — The Command Line for Professional Kitchens

A self-contained kitchen-management platform combining **every feature** of a modern
food-safety SaaS: HACCP, temperature monitoring, allergen menus, food labels, recipes,
suppliers, training, incidents and waste tracking — in one app, with a marketing site,
a real backend, and offline/PWA support.

> Original implementation. It does **not** contain any third-party proprietary source
> code — it's a fresh build of the same capabilities.

---

## How to run

Requires **Node.js v16+** (no `npm install` needed — the backend is zero-dependency).

### Quick start

From the `kitchen-os` folder:

```bash
npm start
```

You'll see a banner; then open:

- **App:** http://localhost:4000/app
- **Marketing site:** http://localhost:4000/
- **API / health:** http://localhost:4000/api  ·  http://localhost:4000/health

The server also listens on **4001** and **4002** so any of those URLs work.

### Useful commands

| Command | What it does |
|---|---|
| `npm start` | Run the app + API server |
| `npm run dev` | Same as start (handy alias) |
| `npm run reset` | Wipe `server/data/db.json` so demo data re-seeds |

### Configuration

- Single port: `PORT=5000 npm start`
- Custom port list: `PORTS=8080,8081 npm start`

### Offline / no backend

You can also just open **`index.html`** directly — the app detects there's no backend
and falls back to **localStorage** mode (data stays in that browser).

**Demo login:** any email/password works (pre-filled `sarah@kiteline.uk`). In backend
mode, the first login for an email auto-creates the account.

---

## Features implemented (from BOTH sites)

| Module | What it does |
|---|---|
| **Auth / Login** | Branded sign-in, session via localStorage, one account → all products |
| **Dashboard** | Live KPIs (compliance %, sensors, alerts, tasks, waste), live temps, recent alerts, checklist progress |
| **Temperature Monitoring** | Simulated **LoRaWAN** sensors streaming live readings every 5s, per-sensor Chart.js graphs with min/max limit lines, battery/signal, sparklines, add sensor, manual reading |
| **Alerts & Notifications** | Auto-generated breach alerts, severity levels, acknowledge/resolve, SMS/email/push channel toggles |
| **HACCP & Checklists** | Digital checklists (opening/closing/deep-clean), recurrence, assignee, tick-off tasks, add tasks/lists, activity logging |
| **Digital Records** | Delivery, Cooking, Cooling, Reheating, Sanitization logs with tailored forms + CSV export |
| **Multi-Site Management** | Unified dashboard, per-site stats, site switcher (top bar + sites page), add site |
| **Audit-Ready Reports** | Auto-generated compliance report, CCP table, record summary, print + CSV export |
| **Team & Accountability** | Members, roles, sites, live activity log (who did what, when) |
| **Suppliers** | Approved-supplier due-diligence register: status, ratings, audits, certificate expiry tracking |
| **Training & Certificates** | Staff qualification matrix with automatic renewal/expiry tracking |
| **Incidents & Corrective Actions** | Accidents, complaints, pests, equipment faults logged with actions & status |
| **Recipes** | Standardised recipe cards (photo, ingredients, method, allergens, cost) → one-click label |
| **AI Insights** | Predictive dashboard panel: temperature-breach prediction, expiring certs, waste drivers |
| **Multi-language** | Full UI + user manual in English, Spanish, French, German |
| **Command palette** | Ctrl/⌘ K to jump to any page or action |
| **PWA** | Installable to desktop/home screen, offline app-shell caching |
| **AllerQ** | Allergen menus, 14 statutory allergens, multi-language tags, **QR code** generation per menu, add dishes/menus |
| **Food Label System** | Auto expiry calculation, allergen declaration, **QR + barcode**, printable label preview |
| **F\*\*\* Waste** | Waste log, doughnut/bar analytics (by reason & stage), cost & ROI, log entries |
| **Settings** | Organisation, currency, product toggles, notification channels, reset demo data |

---

## Tech stack

- **Vanilla JS** SPA (classic scripts — works over `file://`, no module/CORS issues)
- **Tailwind CSS** (Play CDN) + custom design layer (`css/styles.css`)
- **Chart.js** for temperature & waste analytics
- **qrcodejs** for AllerQ / label QR codes
- Simulated IoT layer mimicking LoRaWAN sensor streams + automatic alerting

**Backend (zero dependencies)**
- **Node.js** built-in `http`, `fs`, `crypto` only — no `npm install` needed
- **scrypt** password hashing + random bearer tokens
- JSON file persistence (`server/data/db.json`)
- Serves the REST API, the app, and the marketing site

**Persistence model**
- Backend present → server-side shared state (cross-device, multi-user)
- No backend → `localStorage` (per-browser), seeded on first load

---

## Project structure

```
kitchen-os/
├── index.html          # The app entry point (loads CDNs + scripts below)
├── css/
│   └── styles.css      # Design system (cards, buttons, tables, badges, animations)
├── js/
│   ├── api.js          # API client (talks to backend; offline fallback)
│   ├── store.js        # Data model, seed, localStorage + server sync
│   ├── ui.js           # Icons (inline SVG), toasts, modals, formatters, CSV
│   ├── views.js        # One render function per route (all 12 modules)
│   └── app.js          # Auth, app shell/sidebar, hash router, IoT simulation
├── server/
│   ├── server.js       # Zero-dep Node backend: REST API + auth + static hosting
│   └── data/db.json    # Auto-created: users, tokens, shared kitchen state
└── site/               # Public marketing website
    ├── index.html      # Homepage (hero, products, testimonial, newsletter)
    ├── pricing.html    # Pricing tiers, bundles, discounts, FAQ
    └── product-haccp.html  # Food Safe System product page
```

### REST API

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/login` | Authenticate (auto-creates account in demo mode) → token |
| POST | `/api/register` | Create account → token |
| GET | `/api/me` | Validate token / current user |
| POST | `/api/logout` | Invalidate token |
| GET | `/api/state` | Fetch shared kitchen state |
| PUT | `/api/state` | Save shared kitchen state |

### Data flow
1. `store.js` loads/seeds the DB into `localStorage` and exposes `window.Store`.
2. `app.js` boots: checks session → renders login or the app shell, starts the sensor simulation loop.
3. The hash router (`#dashboard`, `#temps`, …) picks a function from `views.js`.
4. Each view returns `{ title, html, mount() }`; `mount()` wires events and charts.
5. Mutations go through `Store`, call `Store.persist()`, then `App.render()`.

---

## How the real product is built (architecture notes)

The live Kitchen OS / Food Safe System is a SaaS. A production version of this clone would map as:

- **Frontend:** React/Next.js SPA (same component structure used here).
- **Backend:** REST/GraphQL API (Node or Python) with role-based auth (JWT/sessions).
- **Database:** Postgres — tables for orgs, sites, users, sensors, readings, alerts, checklists, records, menus, labels, waste.
- **IoT ingestion:** LoRaWAN gateways → network server (e.g. The Things Stack) → webhook/MQTT → readings table; a rules engine compares each reading to CCP limits and fires alerts.
- **Notifications:** SMS (Twilio), email (SES/SendGrid), push — exactly the channel toggles modelled in Settings/Alerts.
- **Reporting:** scheduled jobs generate twice-weekly compliance summaries (modelled in Reports).
- **Mobile:** iOS/Android apps hitting the same API (the marketing sites advertise both).

The client-side `startSimulation()` here stands in for the IoT ingestion + rules engine so the app is fully interactive offline.

---

## Reset

- In-app: **Settings → Reset demo data**
- Backend: `npm run reset` (deletes `server/data/db.json`, re-seeds on next start)
- Browser-only: clear the `kiteline.db.v4` key in localStorage
