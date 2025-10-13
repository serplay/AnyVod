# AnyVod

This is a small full-stack scaffold for a streaming app using React (Vite) frontend and a Python FastAPI backend. The backend proxies The Movie Database (TMDB) for metadata and an external vidsrc-like API for stream sources.

WARNING: This is a starter scaffold. You need valid API keys for TMDB and your vidsrc provider and you must comply with their terms of service when using content.

## Structure

- `backend/`: FastAPI backend
- `frontend/`: Vite + React frontend

## Setup

1. Backend

 Create a Python virtual environment and install dependencies:

    ```bash
    cd backend
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    cp .env.example .env
    # edit .env and add TMDB_API_KEY and VIDSRC_API_KEY
    ./run.sh
    ```

2. Frontend

 Install node deps and run:

    ```bash
    cd frontend
    npm install
    cp .env.example .env
    # edit .env if needed
    npm run dev
    ```

The frontend expects the backend at the URL defined by `VITE_API_BASE` (defaults to `http://localhost:8000`) and the backend allows CORS from `FRONTEND_ORIGIN` in `.env`.

## Notes

- TMDB image URLs use `https://image.tmdb.org/t/p/w342{poster_path}` — you can change size in the components.
- The vidsrc endpoints are proxied in `backend/app/routers/vidsrc.py`. Replace `VIDSRC_BASE_URL` and keys accordingly.
