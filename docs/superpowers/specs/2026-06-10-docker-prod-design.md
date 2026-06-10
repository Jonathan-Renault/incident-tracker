# Docker Production Deployment — Design Spec

**Date:** 2026-06-10  
**Status:** Approved

## Overview

Add Docker Compose support to deploy the incident-tracker to production. Nginx Proxy Manager routes a domain to the container on port 3001. Managed via Docker CLI or Portainer Community.

---

## Files

| File | Responsibility |
|------|---------------|
| `Dockerfile` | Build production Node.js image |
| `docker-compose.yml` | Define service, port mapping, named volume |
| `.dockerignore` | Exclude dev/build artifacts from image context |

---

## Dockerfile

- **Base image:** `node:24-alpine` — matches dev Node version, minimal footprint (~50MB)
- Copy `package.json` + `package-lock.json` first (layer cache for dependencies)
- Run `npm ci --omit=dev` — installs only production deps (no supertest)
- Copy remaining source files
- Run as non-root user `node` (built into node:alpine images)
- Expose port 3000
- CMD: `node server.js`

---

## docker-compose.yml

- **Service:** `incident-tracker`
- **Build:** `.` (builds from local Dockerfile)
- **Ports:** `3001:3000` — external 3001 → internal 3000
- **Restart:** `unless-stopped` — auto-restart on crash/reboot, respects manual `docker compose down`
- **Volume:** named volume `incident_data` mounted at `/app/incident.db`
- **Environment:** `NODE_ENV=production`

---

## .dockerignore

Excludes from build context:
- `node_modules/`
- `.git/`
- `incident.db`
- `test-incident.db`
- `tests/`
- `docs/`
- `.superpowers/`
- `*.md`

---

## Data Persistence

SQLite database persists in Docker named volume `incident_data`.

Volume survives:
- Container restarts
- Image rebuilds (`docker compose up --build`)
- `docker compose down` (volume not deleted unless `--volumes` flag used)

**Backup command:**
```bash
docker run --rm -v incident_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/incident-backup.tar.gz /data
```

---

## Deployment Workflow

```bash
# First deploy
docker compose up -d --build

# Update after code change
git pull
docker compose up -d --build

# View logs
docker compose logs -f

# Stop
docker compose down
```

**Nginx Proxy Manager:** Add proxy host pointing to `<server-ip>:3001`. SSL via Let's Encrypt in NPM.

---

## Out of Scope

- Multi-container setup (no separate DB container needed — SQLite is embedded)
- CI/CD pipeline
- Health check endpoint
- Docker Swarm / Kubernetes
