from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.tmdb import Tmdb
from app.routers import vidsrc
import os

app = FastAPI(title="AnyVod API")

# Allow multiple origins for development and production
origins_env = os.getenv("FRONTEND_ORIGIN", "")
origins = [origin.strip() for origin in origins_env.split(",") if origin.strip()]

# Add common development origins if in development
environment = os.getenv("ENVIRONMENT", "development")
if environment == "development":
    origins.extend([
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ])

# Always allow vod.losingsanity.com
origins.append("https://vod.losingsanity.com")
origins.append("https://vod.losingsanity.xyz")
origins.append("https://image.tmdb.org")

# If no specific origins set, allow all in production (for Render deployment)
# You can later set FRONTEND_ORIGIN env var to specific domain for security
if not origins:
    origins = ["*"]

allow_origin_regex = None
if origins != ["*"] and any("vercel.com" in o for o in origins):
    allow_origin_regex = r"https://.*\.vercel\.app"

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(Tmdb.router, prefix="/tmdb")
app.include_router(vidsrc.router, prefix="/vidsrc")

@app.get("/")
def read_root():
    return {"message": "Welcome to the AnyVod API"}
