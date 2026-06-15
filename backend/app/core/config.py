from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    RAG_PROVIDER: str = "fallback"

    HF_TOKEN: str | None = None
    HF_MODEL: str = "Qwen/Qwen2.5-7B-Instruct:fastest"
    HF_TIMEOUT_SECONDS: int = 5
    APP_NAME: str = "BFAI Document Intelligence RAG"
    APP_ENV: str = "development"
    BACKEND_CORS_ORIGINS: str = "http://localhost:3000"

    GEMINI_API_KEY: str | None = None
    RAG_USE_GEMINI: bool = False
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_VISION_OCR_ENABLED: bool = True
    GEMINI_VISION_MODEL: str = "gemini-2.5-flash"
    RAG_USE_GEMINI_VISION: bool = False
    GEMINI_TIMEOUT_SECONDS: int = 30

    MAX_UPLOAD_SIZE_MB: int = 25
    ALLOWED_FILE_TYPES: str = "application/pdf,text/plain,image/png,image/jpeg"

    UPLOAD_DIR: str = "data/uploads"
    PAGE_IMAGE_DIR: str = "data/pages"
    CHROMA_DIR: str = "data/chroma"
    SQLITE_DB_PATH: str = "data/sqlite/app.db"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.BACKEND_CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def allowed_file_types(self) -> List[str]:
        return [file_type.strip() for file_type in self.ALLOWED_FILE_TYPES.split(",") if file_type.strip()]

    @property
    def max_upload_size_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
