# Incident Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page "time since last incident" web app with a live DD:HH:MM:SS counter, a confirmation-gated INCIDENT button, and cross-device persistence via SQLite backend.

**Architecture:** Node.js/Express serves both the REST API (2 endpoints) and the static `index.html` frontend. SQLite stores a single timestamp row. The frontend polls every 30s for cross-device sync; all timer math runs client-side.

**Tech Stack:** Node.js v24, Express ^4, better-sqlite3 ^11, supertest ^7 (dev), node:test (built-in)

---

## File Map

| File | Responsibility |
|------|---------------|
| `package.json` | Project metadata, dependencies, npm scripts |
| `server.js` | Express app: DB init, GET /api/status, POST /api/incident, serve index.html |
| `index.html` | Full frontend: layout, timer display, modal, JS logic |
| `tests/api.test.js` | API endpoint tests via supertest + node:test |
| `.gitignore` | Exclude node_modules, incident.db, test-incident.db, .superpowers/ |
| `incident.db` | Auto-created by SQLite on first run (not committed) |

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `.gitignore`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "incident-tracker",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "test": "node --test tests/api.test.js"
  },
  "dependencies": {
    "express": "^4.21.0",
    "better-sqlite3": "^11.0.0"
  },
  "devDependencies": {
    "supertest": "^7.0.0"
  }
}
```

- [ ] **Step 2: Create .gitignore**

```
node_modules/
incident.db
test-incident.db
.superpowers/
```

- [ ] **Step 3: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` created, no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: scaffold project with dependencies"
```

---

## Task 2: Backend — DB init + GET /api/status

**Files:**
- Create: `tests/api.test.js`
- Create: `server.js`

- [ ] **Step 1: Create tests/api.test.js with the GET test**

```bash
mkdir -p tests
```

```javascript
// tests/api.test.js
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { unlinkSync, existsSync } from 'node:fs';
import supertest from 'supertest';

const TEST_DB = './test-incident.db';
process.env.DB_PATH = TEST_DB;

const { default: app } = await import('../server.js');
const request = supertest(app);

test('GET /api/status returns null when DB is empty', async () => {
  const res = await request.get('/api/status');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { last_incident: null });
});

after(() => {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm test`
Expected: `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '../server.js'`

- [ ] **Step 3: Create server.js**

```javascript
// server.js
import express from 'express';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, 'incident.db');

const db = new Database(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY,
    last_incident TEXT NOT NULL
  )
`);

const app = express();
app.use(express.json());

app.get('/api/status', (req, res) => {
  const row = db.prepare('SELECT last_incident FROM incidents WHERE id = 1').get();
  res.json({ last_incident: row?.last_incident ?? null });
});

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));
}

export default app;
```

- [ ] **Step 4: Run test — verify it passes**

Run: `npm test`
Expected: `▶ GET /api/status returns null when DB is empty` ... `pass`

- [ ] **Step 5: Commit**

```bash
git add server.js tests/api.test.js
git commit -m "feat: add Express server with DB init and GET /api/status"
```

---

## Task 3: Backend — POST /api/incident

**Files:**
- Modify: `tests/api.test.js` (add 3 tests)
- Modify: `server.js` (add POST route)

- [ ] **Step 1: Add failing tests to tests/api.test.js**

Add these tests after the existing GET test (before the `after()` block):

```javascript
test('POST /api/incident records current timestamp', async () => {
  const before = new Date().toISOString();
  const res = await request.post('/api/incident');
  const after_ts = new Date().toISOString();

  assert.equal(res.status, 200);
  assert.ok(res.body.last_incident >= before, 'timestamp should be >= before');
  assert.ok(res.body.last_incident <= after_ts, 'timestamp should be <= after');
});

test('GET /api/status returns timestamp after incident recorded', async () => {
  const postRes = await request.post('/api/incident');
  const getRes = await request.get('/api/status');

  assert.equal(getRes.status, 200);
  assert.equal(getRes.body.last_incident, postRes.body.last_incident);
});

test('POST /api/incident overwrites previous timestamp', async () => {
  await request.post('/api/incident');
  await new Promise(r => setTimeout(r, 20));
  const second = await request.post('/api/incident');
  const status = await request.get('/api/status');

  assert.equal(status.body.last_incident, second.body.last_incident);
});
```

- [ ] **Step 2: Run tests — verify new ones fail**

Run: `npm test`
Expected: 1 passing, 3 failing with `404` or route not found errors.

- [ ] **Step 3: Add POST /api/incident to server.js**

Add this route after the GET /api/status route, before the GET / route:

```javascript
app.post('/api/incident', (req, res) => {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO incidents (id, last_incident) VALUES (1, ?)
    ON CONFLICT(id) DO UPDATE SET last_incident = excluded.last_incident
  `).run(now);
  res.json({ last_incident: now });
});
```

- [ ] **Step 4: Run tests — verify all pass**

Run: `npm test`
Expected: 4 tests passing, 0 failing.

- [ ] **Step 5: Commit**

```bash
git add server.js tests/api.test.js
git commit -m "feat: add POST /api/incident endpoint"
```

---

## Task 4: Frontend — HTML/CSS structure

**Files:**
- Create: `index.html`

- [ ] **Step 1: Create index.html with full layout and styles**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Incident Tracker</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #f8f9fa;
      font-family: system-ui, 'Segoe UI', sans-serif;
      gap: clamp(24px, 5vh, 48px);
      padding: 20px;
    }

    .label {
      font-size: clamp(10px, 1.5vw, 14px);
      color: #999;
      letter-spacing: 4px;
      text-transform: uppercase;
      font-weight: 600;
    }

    .timer {
      display: flex;
      align-items: flex-start;
      gap: clamp(4px, 1vw, 12px);
    }

    .unit {
      text-align: center;
      min-width: clamp(50px, 8vw, 90px);
    }

    .digit {
      font-size: clamp(36px, 7vw, 80px);
      font-weight: 900;
      color: #2d6a4f;
      line-height: 1;
      font-variant-numeric: tabular-nums;
      font-family: monospace;
    }

    .unit.seconds .digit {
      color: #d62828;
    }

    .unit-label {
      font-size: clamp(8px, 1vw, 11px);
      color: #aaa;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-top: 4px;
    }

    .sep {
      font-size: clamp(28px, 5vw, 60px);
      font-weight: 300;
      color: #ccc;
      padding-top: clamp(4px, 1vw, 10px);
      line-height: 1;
      user-select: none;
    }

    .timer.error .digit { color: #ccc; }

    #btn-incident {
      background: #d62828;
      color: #fff;
      font-weight: 900;
      font-size: clamp(16px, 2.5vw, 24px);
      letter-spacing: 6px;
      padding: clamp(16px, 3vh, 28px) clamp(32px, 6vw, 72px);
      border: none;
      border-radius: 8px;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(214, 40, 40, 0.35);
      text-transform: uppercase;
      min-width: min(280px, 90vw);
      transition: transform 0.1s, box-shadow 0.1s;
    }

    #btn-incident:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 24px rgba(214, 40, 40, 0.45);
    }

    #btn-incident:active { transform: translateY(0); }

    #modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      align-items: center;
      justify-content: center;
      z-index: 100;
    }

    #modal-overlay.visible { display: flex; }

    .modal {
      background: #fff;
      border-radius: 12px;
      padding: 32px;
      text-align: center;
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.15);
      max-width: 360px;
      width: 90vw;
    }

    .modal-subtitle {
      font-size: 11px;
      color: #999;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .modal-title {
      font-size: 18px;
      font-weight: 700;
      color: #222;
      margin-bottom: 24px;
    }

    .modal-actions { display: flex; gap: 12px; justify-content: center; }

    #btn-confirm {
      background: #d62828;
      color: #fff;
      font-weight: 700;
      font-size: 14px;
      letter-spacing: 1px;
      padding: 12px 32px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
    }

    #btn-cancel {
      background: #f0f0f0;
      color: #444;
      font-weight: 600;
      font-size: 14px;
      padding: 12px 32px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
    }
  </style>
</head>
<body>

  <span class="label">Sans incident depuis</span>

  <div class="timer" id="timer">
    <div class="unit">
      <div class="digit" id="days">--</div>
      <div class="unit-label">Jours</div>
    </div>
    <span class="sep">:</span>
    <div class="unit">
      <div class="digit" id="hours">--</div>
      <div class="unit-label">Heures</div>
    </div>
    <span class="sep">:</span>
    <div class="unit">
      <div class="digit" id="minutes">--</div>
      <div class="unit-label">Min</div>
    </div>
    <span class="sep">:</span>
    <div class="unit seconds">
      <div class="digit" id="seconds">--</div>
      <div class="unit-label">Sec</div>
    </div>
  </div>

  <button id="btn-incident">INCIDENT</button>

  <div id="modal-overlay">
    <div class="modal">
      <div class="modal-subtitle">Confirmer</div>
      <div class="modal-title">Un incident s'est produit&nbsp;?</div>
      <div class="modal-actions">
        <button id="btn-confirm">Confirmer</button>
        <button id="btn-cancel">Annuler</button>
      </div>
    </div>
  </div>

  <script>
    // Placeholder — JS added in Task 5
  </script>

</body>
</html>
```

- [ ] **Step 2: Start server and verify page loads**

Run: `npm start`
Open: `http://localhost:3000`
Expected: Page renders with "--" digits, label "SANS INCIDENT DEPUIS", red INCIDENT button. No console errors.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add frontend HTML/CSS structure"
```

---

## Task 5: Frontend — JS timer logic + API integration

**Files:**
- Modify: `index.html` (replace placeholder `<script>` block)

- [ ] **Step 1: Replace the placeholder script block in index.html**

Replace:
```html
  <script>
    // Placeholder — JS added in Task 5
  </script>
```

With:
```html
  <script>
    let lastIncident = null;
    let tickInterval = null;

    function pad(n) {
      return String(Math.floor(n)).padStart(2, '0');
    }

    function updateDisplay(ms) {
      const totalSec = Math.floor(ms / 1000);
      const days = Math.floor(totalSec / 86400);
      const hours = Math.floor((totalSec % 86400) / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      const seconds = totalSec % 60;

      document.getElementById('days').textContent = String(days);
      document.getElementById('hours').textContent = pad(hours);
      document.getElementById('minutes').textContent = pad(minutes);
      document.getElementById('seconds').textContent = pad(seconds);
    }

    function startTimer(isoTimestamp) {
      lastIncident = new Date(isoTimestamp).getTime();
      document.getElementById('timer').classList.remove('error');
      if (tickInterval) clearInterval(tickInterval);
      tickInterval = setInterval(() => updateDisplay(Date.now() - lastIncident), 1000);
      updateDisplay(Date.now() - lastIncident);
    }

    function showError() {
      if (tickInterval) clearInterval(tickInterval);
      document.getElementById('timer').classList.add('error');
      ['days', 'hours', 'minutes', 'seconds'].forEach(id => {
        document.getElementById(id).textContent = '--';
      });
    }

    async function fetchStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        if (data.last_incident) {
          startTimer(data.last_incident);
        } else {
          await recordIncident();
        }
      } catch {
        showError();
        setTimeout(fetchStatus, 10000);
      }
    }

    async function recordIncident() {
      try {
        const res = await fetch('/api/incident', { method: 'POST' });
        const data = await res.json();
        startTimer(data.last_incident);
      } catch {
        showError();
      }
    }

    // Cross-device sync: re-fetch every 30s, reset if server timestamp differs
    setInterval(async () => {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        if (data.last_incident && lastIncident) {
          const serverTs = new Date(data.last_incident).getTime();
          if (serverTs !== lastIncident) startTimer(data.last_incident);
        }
      } catch { /* ignore polling errors */ }
    }, 30000);

    // Modal
    document.getElementById('btn-incident').addEventListener('click', () => {
      document.getElementById('modal-overlay').classList.add('visible');
    });

    document.getElementById('btn-cancel').addEventListener('click', () => {
      document.getElementById('modal-overlay').classList.remove('visible');
    });

    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target === document.getElementById('modal-overlay')) {
        document.getElementById('modal-overlay').classList.remove('visible');
      }
    });

    document.getElementById('btn-confirm').addEventListener('click', async () => {
      document.getElementById('modal-overlay').classList.remove('visible');
      await recordIncident();
    });

    fetchStatus();
  </script>
```

- [ ] **Step 2: Restart server and verify timer counts up**

Run: `npm start`
Open: `http://localhost:3000`
Expected:
- Timer shows `0 : 00 : 00 : 00` then starts ticking (seconds increment each second)
- Days/hours/minutes in dark green, seconds in red

- [ ] **Step 3: Verify INCIDENT flow**

1. Click INCIDENT button → modal appears
2. Click Annuler → modal closes, timer continues
3. Click INCIDENT again → modal appears
4. Click Confirmer → modal closes, timer resets to `0 : 00 : 00 : 00` and restarts

- [ ] **Step 4: Verify persistence**

1. Let timer run for ~10 seconds
2. Refresh page
3. Expected: timer continues from where it left off (e.g., shows ~10s), not reset to 0

- [ ] **Step 5: Verify cross-device sync (optional manual test)**

1. Open `http://<server-ip>:3000` on a second device on same network
2. Press INCIDENT on one device
3. Within 30 seconds, other device timer should reset

- [ ] **Step 6: Run API tests to confirm backend still passes**

Run: `npm test`
Expected: 4 tests passing.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: add frontend timer logic and API integration"
```

---

## Task 6: Final wiring — .gitignore check + smoke test

**Files:**
- No new files

- [ ] **Step 1: Confirm .gitignore excludes DB and node_modules**

Run: `git status`
Expected: `incident.db`, `node_modules/`, `test-incident.db` do NOT appear as untracked files.

- [ ] **Step 2: Run full test suite one last time**

Run: `npm test`
Expected: 4 tests passing, 0 failing.

- [ ] **Step 3: Verify server starts cleanly from scratch**

```bash
node server.js
```
Expected: `Listening on http://localhost:3000` (no errors, DB created automatically if absent).

- [ ] **Step 4: Final commit if any loose files**

```bash
git status
# If clean, nothing to do. If any untracked file needs committing:
git add <file>
git commit -m "chore: finalize project"
```
