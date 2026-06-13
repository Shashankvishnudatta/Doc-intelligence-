from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.chat import router as chat_router
from app.api.documents import router as documents_router
from app.api.health import router as health_router
from app.api.uploads import router as uploads_router
from app.core.config import get_settings
from app.core.database import init_db

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="Document Intelligence + Agentic RAG backend for BFAI AI Engineer Assessment",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, tags=["Health"])
app.include_router(documents_router)
app.include_router(uploads_router)
app.include_router(chat_router)


@app.get("/")
def root():
    return {
        "message": "BFAI Document Intelligence RAG API",
        "docs": "/docs",
        "health": "/health",
        "documents": "/documents",
        "bulk_upload": "/uploads/bulk",
        "chat": "/chat",
    }