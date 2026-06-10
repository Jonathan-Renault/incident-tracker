# Incident Tracker — Design Spec

**Date:** 2026-06-10  
**Status:** Approved

## Overview

Single-page web app showing a live "time since last incident" counter. A large INCIDENT button resets the timer (with confirmation). Data persists server-side via SQLite enabling cross-device sync.

---

## Architecture

**Stack:** Node.js (v24) + Express + better-sqlite3  
**Deployment:** Single process, serves static frontend + REST API

```
/home/incident/
  server.js        ← Express server: API routes + serves index.html
  index.html       ← Frontend: pure HTML/CSS/JS, no framework
  incident.db      ← SQLite database (auto-created on first run)
  package.json
```

---

## Frontend (index.html)

### Layout
- Full-viewport, vertically and horizontally centered (flexbox)
- Label: "SANS INCIDENT DEPUIS" (small, uppercase, letter-spaced)
- Timer: `DD : HH : MM : SS` — large monospace digits
- INCIDENT button: large red, below the timer
- Confirmation modal: inline HTML dialog (no native `window.confirm`)

### Visual Style
- Background: `#f8f9fa` (light gray)
- Days/hours/minutes: `#2d6a4f` (dark green)
- Seconds: `#d62828` (red)
- Separators: `#ccc` (light gray)
- INCIDENT button: `#d62828` background, white text, subtle box-shadow
- Font: system-ui / Segoe UI

### Responsive
- `clamp()` on all font-sizes — readable from mobile to large display
- INCIDENT button: `min-width: 280px`, full-width on small screens

### Timer Display
- All units: always 2 digits minimum (`padStart(2, '0')`)
- Days: no upper limit (can show 100+ days)
- Seconds displayed in red to distinguish the live tick visually

---

## Backend (server.js)

### API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Returns `{ last_incident: ISO8601_string \| null }` |
| POST | `/api/incident` | Sets `last_incident = now`, returns `{ last_incident: ISO8601_string }` |

### Database

Table `incidents`:
```sql
CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY,
  last_incident TEXT NOT NULL
);
```

Single row (`id = 1`). Upsert on each reset:
```sql
INSERT INTO incidents (id, last_incident) VALUES (1, ?)
ON CONFLICT(id) DO UPDATE SET last_incident = excluded.last_incident;
```

---

## Behavior

### First Launch (empty DB)
1. Frontend calls `GET /api/status` → receives `null`
2. Frontend immediately calls `POST /api/incident` to initialize timestamp
3. Timer starts from 0

### Normal Load
1. Frontend calls `GET /api/status` → receives ISO timestamp
2. Timer starts from `Date.now() - new Date(last_incident).getTime()`

### INCIDENT Button Flow
1. User clicks INCIDENT → confirmation modal appears
2. User clicks "Confirmer" → `POST /api/incident` → timer resets to 0
3. User clicks "Annuler" → modal closes, timer continues unchanged

### Cross-Device Sync
- Frontend polls `GET /api/status` every 30 seconds
- If returned timestamp differs from local → silently reset timer to match server

### Timer Tick
- `setInterval` at 1000ms
- Computes elapsed = `Date.now() - last_incident_ms`
- Derives days, hours, minutes, seconds from elapsed milliseconds

---

## Data Persistence

- `incident.db` lives on the server filesystem
- Survives server restarts (SQLite file persists)
- All devices read/write the same timestamp via API
- No authentication — assumes trusted network / internal use

---

## Error Handling

- API unreachable on load → display "--" in timer units, retry after 10s
- POST fails → show brief error state on button, do not reset local timer
- These are boundary cases; no special handling needed for normal operation

---

## Out of Scope

- Incident history / log
- Authentication / access control
- Push notifications
- Multiple named incident counters
