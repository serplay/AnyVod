# AnyVod

A streaming front end for movies and TV. It has two parts:

- **`backend/`**: a Rust ([axum](https://github.com/tokio-rs/axum)) API. It proxies [TMDB](https://www.themoviedb.org/) for metadata, caching responses in memory, and builds vidsrc embed URLs.
- **`frontend/`**: a React 19 + TypeScript + Vite single-page app. It uses TanStack Query for data and React Router for routing.

The API contract is documented in [`docs/API.md`](docs/API.md).

> You need a TMDB API key. You are responsible for complying with the terms of service of TMDB and of any embed provider you configure.

## Quick start (Docker)

```bash
cp .env.example .env          # add your TMDB_API_KEY
docker compose up --build
```

- Frontend: http://localhost:5173
- API: http://localhost:8000 (health check at `/health`)

## Manual setup

**Backend** (requires Rust stable):

```bash
cd backend
TMDB_API_KEY=... cargo run          # listens on :8000
cargo test                          # unit + integration tests (TMDB mocked with wiremock)
```

**Frontend** (requires Node 20.19 or newer; Node 22 recommended):

```bash
cd frontend
npm install
npm run dev                         # http://localhost:5173, calls http://localhost:8000 by default
npm run typecheck && npm run lint && npm test
```

## Configuration

| Variable | Used by | Default | Notes |
|---|---|---|---|
| `TMDB_API_KEY` | backend | – | Required. The backend refuses to start without it. |
| `PORT` | backend | `8000` | Render sets this automatically. |
| `ENVIRONMENT` | backend | `development` | `development` also allows CORS from localhost:5173 and localhost:3000. |
| `FRONTEND_ORIGIN` | backend | – | Comma-separated list of extra allowed CORS origins. `*.vercel.app` is always allowed. |
| `VIDSRC_EMBED_DOMAIN` | backend | `vidsrc.sh` | Domain used to build embed URLs. |
| `RUST_LOG` | backend | `info` | Log filter, e.g. `anyvod_backend=debug`. |
| `VITE_API_BASE` | frontend (build time) | dev: `http://localhost:8000`; prod: same origin | Base URL of the backend. |

## Deployment

- **Render:** `render.yaml` defines the backend (Docker, health check on `/health`) and the frontend (static site).
- **Docker:** `docker compose -f docker-compose.prod.yml up -d --build` serves the frontend on port 80 and the API on port 8000. See [DOCKER.md](DOCKER.md).
- **Vercel** (frontend only): `frontend/vercel.json` rewrites every route to the SPA.

CI (`.github/workflows/ci.yml`) runs the following on each push and pull request:
- backend: `cargo fmt`, `clippy` and tests
- frontend: lint, typecheck, tests and build
