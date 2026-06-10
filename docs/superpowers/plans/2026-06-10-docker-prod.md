# Docker Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Dockerfile, docker-compose.yml, and .dockerignore so the app runs in production behind Nginx Proxy Manager on port 3001.

**Architecture:** Node.js app builds into a `node:24-alpine` image. SQLite persists in a Docker named volume mounted at `/app/data/`. The `DB_PATH` env var overrides the default DB path — already supported by server.js. Port mapping: external 3001 → internal 3000.

**Tech Stack:** Docker, Docker Compose v2, node:24-alpine

---

## File Map

| File | Responsibility |
|------|---------------|
| `.dockerignore` | Exclude dev artifacts from build context |
| `Dockerfile` | Build production image (non-root user, prod deps only) |
| `docker-compose.yml` | Service definition: port 3001, named volume, restart policy |

---

## Task 1: Create .dockerignore

**Files:**
- Create: `.dockerignore`

- [ ] **Step 1: Create .dockerignore**

```
node_modules/
.git/
incident.db
test-incident.db
tests/
docs/
.superpowers/
*.md
.claude/
```

- [ ] **Step 2: Verify file exists**

Run: `cat /home/incident/.dockerignore`
Expected: file content printed, no error.

- [ ] **Step 3: Commit**

```bash
git add .dockerignore
git commit -m "chore: add .dockerignore for Docker build"
```

---

## Task 2: Create Dockerfile

**Files:**
- Create: `Dockerfile`

**Important:** The SQLite DB is stored in `/app/data/incident.db` (a subdirectory). Docker named volumes cannot reliably mount to a single file path — they must mount to a directory. The `DB_PATH` env var already exists in server.js to override the default path.

- [ ] **Step 1: Create Dockerfile**

```dockerfile
FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js index.html ./

RUN mkdir -p /app/data && chown -R node:node /app

USER node

ENV PORT=3000
ENV DB_PATH=/app/data/incident.db

EXPOSE 3000

CMD ["node", "server.js"]
```

- [ ] **Step 2: Verify build succeeds**

Run: `docker build -t incident-tracker-test .`
Expected: `Successfully built <sha>` or `naming to docker.io/library/incident-tracker-test`

- [ ] **Step 3: Verify image runs and API responds**

Run:
```bash
docker run --rm -p 3002:3000 incident-tracker-test &
sleep 2
curl -s http://localhost:3002/api/status
kill %1 2>/dev/null
```
Expected: `{"last_incident":null}` or a timestamp JSON.

- [ ] **Step 4: Clean up test image**

Run: `docker rmi incident-tracker-test`

- [ ] **Step 5: Commit**

```bash
git add Dockerfile
git commit -m "feat: add Dockerfile for production build"
```

---

## Task 3: Create docker-compose.yml

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Create docker-compose.yml**

```yaml
services:
  incident-tracker:
    build: .
    ports:
      - "3001:3000"
    volumes:
      - incident_data:/app/data
    environment:
      - NODE_ENV=production
      - DB_PATH=/app/data/incident.db
    restart: unless-stopped

volumes:
  incident_data:
```

- [ ] **Step 2: Build and start with compose**

Run:
```bash
docker compose up -d --build
```
Expected: `Container incident-tracker  Started`

- [ ] **Step 3: Verify API responds on port 3001**

Run:
```bash
curl -s http://localhost:3001/api/status
curl -s -X POST http://localhost:3001/api/incident
curl -s http://localhost:3001/api/status
```
Expected:
- First call: `{"last_incident":null}` or existing timestamp
- POST: `{"last_incident":"<ISO timestamp>"}`
- Third call: same timestamp as POST returned

- [ ] **Step 4: Verify persistence across container restart**

Run:
```bash
BEFORE=$(curl -s -X POST http://localhost:3001/api/incident | grep -o '"last_incident":"[^"]*"')
docker compose down
docker compose up -d
sleep 2
AFTER=$(curl -s http://localhost:3001/api/status | grep -o '"last_incident":"[^"]*"')
echo "Before: $BEFORE"
echo "After:  $AFTER"
```
Expected: `Before` and `After` show the same timestamp — data persisted in volume.

- [ ] **Step 5: Verify existing Node.js tests still pass**

Run: `npm test`
Expected: 4 tests passing, 0 failing. (Tests use the local test DB, not Docker — no conflict.)

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add docker-compose for production deployment"
```

---

## Task 4: Push to GitHub

**Files:**
- No new files

- [ ] **Step 1: Push all new commits**

Run:
```bash
git push
```
Expected: 3 new commits pushed to `origin/master`.

- [ ] **Step 2: Verify remote is up to date**

Run: `git log --oneline origin/master..HEAD`
Expected: no output (local and remote in sync).
