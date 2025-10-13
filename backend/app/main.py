from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.tmdb import Tmdb
from routers import vidsrc
import os

app = FastAPI(title="AnyVod API")

origins = [os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(Tmdb.router, prefix="/tmdb")
app.include_router(vidsrc.router, prefix="/vidsrc")

