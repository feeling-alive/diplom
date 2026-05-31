"""Application configuration loaded from environment variables / backend/.env.

All settings have safe defaults so the service can boot for a demo even when
only some env vars are provided. The Finnhub key is the only secret; it is read
from the environment and never logged in plaintext.
"""

from __future__ import annotations

import logging

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("backend.config")


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
    """Log the effective config at startup. The API key is masked to present/ABSENT."""
    logger.info(
        "[config] redis_url=%s finnhub_key=%s cors=%s ttls(stock/crypto/forex)=%d/%d/%d",
        settings.redis_url,
        "present" if settings.finnhub_api_key else "ABSENT",
        settings.cors_origin_list,
        settings.stock_ttl,
        settings.crypto_ttl,
        settings.forex_ttl,
    )
