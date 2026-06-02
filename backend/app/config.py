"""Application configuration loaded from environment variables / backend/.env.

All settings have safe defaults so the service can boot for a demo even when
only some env vars are provided. The Finnhub key is the only secret; it is read
from the environment and never logged in plaintext.
"""

from __future__ import annotations

import logging
from urllib.parse import urlsplit, urlunsplit

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("backend.config")


def _mask_dsn_password(dsn: str) -> str:
    """Return a DSN with the password replaced by ``***`` for safe logging.

    ``postgresql+asyncpg://user:secret@host:5432/db`` ->
    ``postgresql+asyncpg://user:***@host:5432/db``. Falls back to the scheme
    only if the DSN cannot be parsed, so a secret never leaks into logs.
    """
    try:
        parts = urlsplit(dsn)
        if parts.password is None:
            return dsn
        userinfo = parts.username or ""
        masked_netloc = f"{userinfo}:***@{parts.hostname or ''}"
        if parts.port:
            masked_netloc += f":{parts.port}"
        return urlunsplit((parts.scheme, masked_netloc, parts.path, parts.query, parts.fragment))
    except ValueError:
        scheme = dsn.split("://", 1)[0] if "://" in dsn else "?"
        return f"{scheme}://***"


class Settings(BaseSettings):
    """Typed settings. Field names map to UPPER_CASE env vars case-insensitively.

    Example: ``finnhub_api_key`` <- ``FINNHUB_API_KEY``.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Secrets / connections -------------------------------------------------
    finnhub_api_key: str = ""
    redis_url: str = "redis://localhost:6379"

    # --- Database (Блок A) -----------------------------------------------------
    # asyncpg DSN. Host is ``localhost`` for a host-run uvicorn/alembic; inside
    # Docker Compose the backend service overrides host to ``postgres`` via env.
    database_url: str = "postgresql+asyncpg://fintrack:fintrack_pass@localhost:5432/fintrack"

    # --- Auth / JWT (Блок A: значения по умолчанию, использование — позже) ------
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 дней

    # --- Uploads ---------------------------------------------------------------
    uploads_dir: str = "uploads"

    # --- Google OAuth / service URLs (Блок B) ----------------------------------
    # Empty client id => the /auth/google endpoints return 501 (not configured).
    google_client_id: str = ""
    google_client_secret: str = ""
    backend_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:5173"

    # --- CORS ------------------------------------------------------------------
    # Comma-separated origins; the frontend Vite dev server by default.
    cors_origins: str = "http://localhost:5173"

    # --- Cache TTLs (seconds) --------------------------------------------------
    stock_ttl: int = 60
    crypto_ttl: int = 30
    forex_ttl: int = 300

    # --- External API timeout (seconds) ---------------------------------------
    http_timeout: float = 5.0

    @property
    def cors_origin_list(self) -> list[str]:
        """Parse the comma-separated CORS origins into a clean list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


# Single shared instance imported across the app.
settings = Settings()


def log_startup_config() -> None:
    """Log the effective config at startup.

    Secrets are never logged in plaintext: the Finnhub key and ``secret_key`` are
    reduced to present/ABSENT and the database DSN password is masked.
    """
    logger.info(
        "[config] redis_url=%s finnhub_key=%s cors=%s ttls(stock/crypto/forex)=%d/%d/%d",
        settings.redis_url,
        "present" if settings.finnhub_api_key else "ABSENT",
        settings.cors_origin_list,
        settings.stock_ttl,
        settings.crypto_ttl,
        settings.forex_ttl,
    )
    logger.info(
        "[config] database_url=%s secret_key=%s algorithm=%s token_ttl_min=%d uploads_dir=%s",
        _mask_dsn_password(settings.database_url),
        "present" if settings.secret_key and settings.secret_key != "your-secret-key-change-in-production" else "DEFAULT(insecure)",
        settings.algorithm,
        settings.access_token_expire_minutes,
        settings.uploads_dir,
    )
    logger.info(
        "[config] google_client_id=%s google_client_secret=%s backend_url=%s frontend_url=%s",
        "present" if settings.google_client_id else "ABSENT",
        "present" if settings.google_client_secret else "ABSENT",
        settings.backend_url,
        settings.frontend_url,
    )
