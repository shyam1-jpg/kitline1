# Kiteline — User Manual

**The Command System for Professional Kitchens**
Food safety, allergens, labelling, recipes and waste tracking — one platform.

Version: Demo build (storage `kiteline.db.v3`)
Last updated: 2026

---

## Table of contents

1. [What Kiteline is](#1-what-kiteline-is)
2. [How to run it](#2-how-to-run-it)
3. [Logging in](#3-logging-in)
4. [The interface explained](#4-the-interface-explained)
5. [Modules — how each one works](#5-modules--how-each-one-works)
6. [Power features](#6-power-features)
7. [How the system works (technical)](#7-how-the-system-works-technical)
8. [Data & where it is stored](#8-data--where-it-is-stored)
9. [Languages](#9-languages)
10. [Install as an app (PWA)](#10-install-as-an-app-pwa)
11. [Troubleshooting](#11-troubleshooting)
12. [Glossary](#12-glossary)

---

## 1. What Kiteline is

Kiteline is an all‑in‑one kitchen management platform that replaces paper diaries and
multiple separate apps. It combines four products into one login:

| Product | What it does |
|---|---|
| **SafeServe** | HACCP checklists, digital records & live temperature monitoring |
| **MenuGuard** | Allergen menus with shareable QR codes |
| **LabelSmart** | Food prep labels with automatic use‑by dates, allergens, QR & barcodes |
| **WasteWise** | Food‑waste tracking and cost analysis |

Everything is organised **per site (kitchen)**, so a business with several locations
manages them all from one dashboard.

---

## 2. How to run it

The app has two parts: a **backend server** (Node.js) and the **web app** it serves.

### Start the server
From the `kitchen-os` folder:

```bash
node server/server.js
```

You'll see:

```
Kiteline server running. Open any of:
  App: http://localhost:4000/app   |   Site: http://localhost:4000/
  App: http://localhost:4001/app   |   Site: http://localhost:4001/
  App: http://localhost:4002/app   |   Site: http://localhost:4002/
```

### Open it in a browser

- **Marketing site:** `http://localhost:4000/`
- **The app:** `http://localhost:4000/app`

The server listens on ports **4000, 4001 and 4002** so any of those URLs work.

> No backend? The app still runs **offline** from your browser's storage with the
> demo data — see section 7.

---

## 3. Logging in

This is a **demo build, so any credentials work**. You have three options:

1. **One‑click:** the email is pre‑filled with `sarah@kiteline.uk`. Just press
   **Sign in** (you can leave the password blank).
2. **Any email/password:** type anything, e.g. `you@kitchen.com` / `test`. On first
   login the backend **creates that account automatically** and signs you in.
3. **Returning user:** once an email has a password, that same password is required
   next time (it is securely hashed on the server).

After login the server gives your browser a **session token**, kept in
`localStorage` under `kiteline.token`. You stay signed in until you log out.

---

## 4. The interface explained

```
┌───────────┬─────────────────────────────────────────────┐
│  SIDEBAR  │  TOP BAR: site ▾ | 🔍 Search (Ctrl K) | 🌐 | 🔔 │
│           ├─────────────────────────────────────────────┤
│ Dashboard │                                             │
│ Temps     │                                             │
│ Alerts ❷  │            MAIN CONTENT AREA                 │
│ HACCP     │      (changes with the page you pick)        │
│ ...       │                                             │
│ Settings  │                                             │
└───────────┴─────────────────────────────────────────────┘
```

- **Sidebar** — navigation between all modules. A red badge shows open alerts.
- **Site selector** (top left) — switch the active kitchen. Every page then shows
  data for that site only.
- **Search / Command palette** — click it or press **Ctrl K** (⌘ K on Mac) to jump
  to any page or run an action.
- **Language selector** (🌐) — switch the whole interface language.
- **Bell** (🔔) — jumps to Alerts.
- **User card** (bottom left) — shows who is signed in.

---

## 5. Modules — how each one works

### Dashboard
Your morning overview for the selected site: compliance %, active sensors, open
alerts, tasks completed today and waste this week. It also shows the **AI Insights**
panel (see Power features), live temperatures, recent alerts and today's checklists.

### Temperatures (SafeServe)
- Wireless **LoRaWAN sensors** report fridge, freezer and hot‑hold temperatures
  continuously (simulated live in this demo).
- Each card shows the current reading, a **trend graph** with the safe range, plus
  battery and signal.
- **Manual reading** — log a handheld probe check.
- **Add sensor** — register a new piece of equipment.
- A reading outside its safe band turns the card red and raises an alert.

### Alerts
- Created automatically for temperature breaches and overdue tasks.
- **Acknowledge** = "I've seen it." **Resolve** = "It's fixed."
- Notification channels (SMS, email, push) are set in Settings.

### HACCP & Checklists (SafeServe)
- Daily opening/closing, cleaning and weekly deep‑clean lists per site.
- Tick items as you complete them; each tick is recorded against the signed‑in user
  for a full **audit trail**.
- Create new recurring checklists with an assignee and due time.

### Records (SafeServe)
- Log **delivery, cooking, cooling, reheating and sanitization** events.
- Every entry is timestamped and attributed to a team member.
- **Export to CSV** for an inspector.

### Recipes
- Standardised recipe cards with **photo, ingredients, method, allergens and food
  cost**.
- **Add recipe** lets you upload a photo (it is automatically resized and stored).
- **Label** on any recipe instantly creates a matching date label in LabelSmart.

### MenuGuard — Allergen menus
- Build menus and add dishes tagged with the **14 statutory allergens**.
- Generate a **QR code** customers scan to read allergens (multi‑language).

### LabelSmart — Food labels
- Enter product, prep date and shelf life — the **use‑by date is calculated for
  you**.
- Each label carries allergens, a **QR code** and a **barcode**, ready to print.

### WasteWise — Waste tracking
- Log waste by item, weight, reason and stage (prep, spoilage, plate, etc.).
- Charts break waste down by reason and stage so you can cut the biggest losses.

### Sites
- Add and manage each kitchen. The active site is chosen from the top bar.

### Reports
- Generate an **audit‑ready compliance report** and export or print it for your EHO
  (Environmental Health Officer).

### Team
- Manage staff, roles and who is assigned to which tasks.

### Settings
- Organisation name, currency, which products are active, and notification channels.
- **Reset demo data** restores the original sample content.

---

## 6. Power features

### AI Insights (Dashboard)
A predictive panel that reads your live data and flags what matters: a fridge
**warming toward a breach within the hour**, low sensor batteries, your **biggest
waste driver** with projected savings, open checklists, and **labels expiring within
24 h** (first‑in, first‑out reminder). If all is well, it tells you you're
inspection‑ready.

### Command palette (Ctrl K / ⌘ K)
Press it anywhere to instantly search and jump to any page, switch site, reset data
or sign out — no clicking through menus.

### Installable app + offline
Kiteline can be installed to your desktop or phone home screen and keeps working
without internet (see section 10).

---

## 7. How the system works (technical)

```
   Browser (the app)                         Node.js backend
 ┌────────────────────┐   HTTPS/JSON      ┌─────────────────────┐
 │ index.html         │  ───────────────▶ │ server/server.js     │
 │ js/app.js  (shell) │   /api/login      │  • auth (scrypt)     │
 │ js/views.js (pages)│   /api/state      │  • bearer tokens     │
 │ js/store.js (data) │ ◀───────────────  │  • REST API          │
 │ js/api.js  (client)│   tokens + state  │  • static hosting    │
 │ js/i18n.js (langs) │                   └──────────┬──────────┘
 └─────────┬──────────┘                              │
           │ localStorage (offline cache)            ▼
           │ kiteline.db.v3 / kiteline.token    server/data/db.json
```

**Frontend** — a single‑page app written in plain JavaScript (no build step):
- `app.js` — login, routing (URL `#hash`), the sidebar/top‑bar shell, command
  palette, and the live sensor simulation.
- `views.js` — renders each page (Dashboard, Temperatures, Labels, etc.).
- `store.js` — the data layer: seed data, reads/writes, and sync.
- `api.js` — talks to the backend.
- `i18n.js` — language dictionaries and the user manual text.
- Styling via Tailwind CSS; charts via Chart.js; QR codes via QRCode.js.

**Backend** — `server/server.js`, a **zero‑dependency** Node.js server using only
built‑in modules:
- **Authentication** — passwords hashed with `scrypt`; login returns a random
  **bearer token** sent on every later request.
- **Persistence** — all data saved to a single JSON file, `server/data/db.json`.
- **REST API** — `/api/login`, `/api/register`, `/api/me`, `/api/logout`, and
  `/api/state` (GET to load, PUT to save shared org data).
- **Static hosting** — serves the app at `/app` and the marketing site at `/`.

**Offline‑first** — if the backend can't be reached, the app automatically falls
back to the browser's `localStorage` (key `kiteline.db.v3`) and keeps working with
demo data. When the backend is available, state syncs to it (last write wins).

---

## 8. Data & where it is stored

| Where | What | Notes |
|---|---|---|
| `server/data/db.json` | Users, tokens, shared org state | The backend "database" |
| Browser `localStorage` → `kiteline.db.v3` | Offline copy of all app data | Per browser |
| Browser `localStorage` → `kiteline.token` | Your login session token | Cleared on logout |
| Browser `localStorage` → `kiteline.lang` | Your chosen language | en / es / fr / de |

**To reset everything:** stop the server, delete `server/data/db.json`, restart the
server. The seed data (sites, sensors, checklists, menus, labels, recipes) is
recreated automatically. (You can also use **Settings → Reset demo data** in the app.)

---

## 9. Languages

The interface and this manual are available in **English, Español, Français and
Deutsch**. Switch with the 🌐 selector in the top bar — the whole app (navigation,
search, the User Manual page) updates instantly. Your choice is remembered.

---

## 10. Install as an app (PWA)

Kiteline is a Progressive Web App, so you can install it like a native program:

1. Open `http://localhost:4000/app` in Chrome or Edge.
2. Click the **install icon** in the address bar (or menu → *Install Kiteline*).
3. It opens in its own window and appears in your Start menu / dock.

Because a **service worker** caches the app shell, it still loads if you go offline.

---

## 11. Troubleshooting

**"ERR_CONNECTION_REFUSED" / page won't open**
The server isn't listening (it's stopped or mid‑restart).
- Reload the tab (Ctrl R). Restarts take only a couple of seconds.
- Check it's up: `Invoke-WebRequest http://localhost:4000/app -UseBasicParsing`
  (a `200` means OK).
- If down, restart: `node server/server.js` from the `kitchen-os` folder.

**Wrong port**
The app runs on **4000, 4001 and 4002**. Other ports won't respond.

**Login won't go through**
Any credentials work in demo mode; just press Sign in. If you set a password for an
email earlier, you must use that same password.

**I changed code but don't see it**
Hard refresh (Ctrl F5). The service worker caches files; a hard refresh fetches the
latest.

**Data looks stale / want a clean start**
Delete `server/data/db.json` and restart, or use Settings → Reset demo data.

---

## 12. Glossary

- **HACCP** — Hazard Analysis & Critical Control Points: the food‑safety system of
  identifying and controlling risks.
- **EHO** — Environmental Health Officer (the food‑safety inspector).
- **LoRaWAN** — a long‑range, low‑power wireless network used by the temperature
  sensors.
- **Use‑by date** — the last day a prepared item is safe to use; LabelSmart
  calculates it from prep date + shelf life.
- **PWA** — Progressive Web App: a website that can be installed and used offline.
- **Bearer token** — a secret string proving you're logged in, sent with each
  request.
- **Seed data** — the sample sites, sensors, menus and labels the app starts with.

---

*Kiteline Kitchen Systems — demo build. This manual is also available inside the app
under **User Manual** in four languages.*
