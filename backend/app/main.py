from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.tmdb import Tmdb
from app.routers import vidsrc
import os

app = FastAPI(title="AnyVod API")

# Allow multiple origins for development and production
origins_env = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
origins = [origin.strip() for origin in origins_env.split(",")]

# Add common development origins if in development
if os.getenv("ENVIRONMENT", "development") == "development":
    origins.extend([
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ])

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(Tmdb.router, prefix="/tmdb")
app.include_router(vidsrc.router, prefix="/vidsrc")

