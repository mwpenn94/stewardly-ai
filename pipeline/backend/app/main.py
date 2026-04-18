"""Stewardly Command Center — FastAPI backend."""
import os, sys
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "pipeline"))
from app.db import init_db, table_counts
from app.routers import sources, pipeline, prospects, scores, contacts, crm, analytics, config

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    print(f"[app] ready: {table_counts()}")
    yield

app = FastAPI(title="Stewardly Command Center API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:5173"), "http://localhost:3000"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

for r in [sources, pipeline, prospects, scores, contacts, crm, analytics, config]:
    app.include_router(r.router)

@app.exception_handler(Exception)
async def exc_handler(req: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"error": str(exc), "type": type(exc).__name__})

@app.get("/health")
async def health():
    return {"status": "ok", "db": table_counts()}

@app.get("/")
async def root():
    return {"app": "Stewardly Command Center", "version": "1.0.0", "docs": "/docs"}
