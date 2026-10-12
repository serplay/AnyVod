# Docker

## Images

- **`backend/Dockerfile`**: a multi-stage build. It uses [cargo-chef](https://github.com/LukeMathWalker/cargo-chef), so dependency layers are cached, and produces a single static-ish binary. The binary runs on `gcr.io/distroless/cc-debian12:nonroot` as a non-root user.
  - The image has no shell or curl. The health check runs `anyvod-backend --healthcheck` instead, which calls `GET /health`.
- **`frontend/Dockerfile`**: builds the app with Node 22, then serves `dist/` from nginx (`frontend/nginx.conf`). nginx handles SPA routing, sends security headers including a CSP, and caches hashed `/assets/` files forever.
  - `VITE_API_BASE` is a build argument. Leave it empty to call the API on the same origin.

## Development

```bash
cp .env.example .env   # set TMDB_API_KEY
docker compose up --build
```

| Service | URL |
|---|---|
| frontend | http://localhost:5173 |
| backend | http://localhost:8000 |

The frontend waits until the backend reports healthy. For hot reload, run the services natively instead (`cargo run` / `npm run dev`); see the README.

## Production

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

| Service | Port |
|---|---|
| frontend | 80 |
| backend | 8000 |

Settings:
- Set `FRONTEND_ORIGIN` to your public frontend URL so CORS allows it.
- Set `VITE_API_BASE` to the public API URL. If a reverse proxy serves both on one origin, leave it empty.

## Useful commands

```bash
docker compose logs -f backend
docker compose ps                       # shows health status
docker compose down
docker compose build --no-cache backend
```

## Troubleshooting

- **Backend exits immediately:** `TMDB_API_KEY` is missing. Compose refuses to start without it.
- **CORS errors in the browser:** add the frontend's origin to `FRONTEND_ORIGIN`.
- **Player iframe blocked:** if you change `VIDSRC_EMBED_DOMAIN`, update `frame-src` in `frontend/nginx.conf` to match.
