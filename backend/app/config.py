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

    # --- Admin API key encryption (Fernet) ------------------------------------
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    # Required for POST /admin/api-keys; graceful error if absent.
    encryption_key: str = ""

    # --- Uploads ---------------------------------------------------------------
    uploads_dir: str = "uploads"

    # --- Google OAuth / service URLs (Блок B) ----------------------------------
    # Empty client id => the /auth/google endpoints return 501 (not configured).
    google_client_id: str = ""
    google_client_secret: str = ""
    backend_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:5173"

    # --- SMTP / Email (восстановление пароля) -----------------------------------
    # Empty smtp_host => emails are not sent; the reset link is logged at DEBUG
    # instead (graceful degradation for local development without a mailbox).
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@fintrack.local"

    # --- CORS ------------------------------------------------------------------
    # Comma-separated origins; the frontend Vite dev server by default.
    cors_origins: str = "http://localhost:5173"

    # --- News / AI enrichment --------------------------------------------------
    news_api_key: str = ""
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "meta-llama/llama-3.3-70b-instruct:free"
    # Max AI-enrichment attempts before an article is given up on (flagged
    # ai_processed). Transient provider failures retry on later passes until this.
    enrich_max_attempts: int = 3
    # How many untranslated articles to backfill at the end of each fetch cycle.
    enrich_tail_batch: int = 20
    # How many untranslated articles to backfill in the background on startup.
    reenrich_startup_limit: int = 50

    # --- External API keys (Phase 2) -------------------------------------------
    # Optional — when absent the corresponding endpoint returns a static
    # fallback immediately (see services/gas.py, services/coingecko.py, ...).
    etherscan_api_key: str = ""

    # --- AI / ML API keys ------------------------------------------------------
    # PatchTST inference is local (services/patchtst.py + app/ml/pytorch_model.pt);
    # no HF API key is needed anymore.
    groq_api_key: str = ""

    # --- AI / ML inference tuning ----------------------------------------------
    # Candle window (SEQ_LEN) and timeframe fed to the PatchTST classifier.
    prediction_seq_len: int = 100
    prediction_timeframe: str = "1H"
    # Confidence gating (soft): only a near-tie |UP - DOWN| < prediction_margin
    # is reported as SIDEWAYS — otherwise the argmax direction is kept. The
    # threshold drives the low_confidence *flag* only (probability below it is
    # flagged, never re-labelled): a weak UP stays UP.
    prediction_confidence_threshold: float = 0.55
    prediction_margin: float = 0.03
    # Optional joblib scaler applied to the feature window before the HF call.
    # Path is relative to the backend working dir; absent file => raw close
    # prices are sent (graceful, behaviour unchanged from before).
    scaler_path: str = "app/ml/scaler.pkl"

    # --- Chat news context -----------------------------------------------------
    # Max news articles injected into the asset-chat system prompt.
    news_context_limit: int = 5
    # When True, the general (symbol-less) chat also gets a fresh market-news
    # block. Off by default — keeps the general chat behaviour unchanged.
    general_news_enabled: bool = False

    # --- Cache TTLs (seconds) --------------------------------------------------
    stock_ttl: int = 60
    crypto_ttl: int = 30
    forex_ttl: int = 300
    # New Phase 2 quote endpoints (widgets-redis-cleanup plan):
    ohlcv_crypto_ttl: int = 60      # OKX — frequent updates are fine
    ohlcv_stock_ttl: int = 300      # Finnhub — tighter free-tier limits
    coin_ttl: int = 30 * 60         # 30 min — static-ish CoinGecko data
    fng_ttl: int = 60 * 60          # 1 h — Fear & Greed index cadence
    funding_ttl: int = 30           # 30 s — funding rate is realtime-ish
    gas_ttl: int = 15               # 15 s — gas oracle changes fast

    # --- External API timeout (seconds) ---------------------------------------
    http_timeout: float = 5.0

    # --- AI chat rate limit ----------------------------------------------------
    # Fixed silent cap on AI-assistant requests per user per minute (ПЗ: "ограничение
    # числа обращений к ИИ-модулю"). Enforced via a Redis per-minute counter in
    # routes/chat.py; never surfaced in the UI. Fail-open if Redis is unavailable.
    ai_rate_limit_per_minute: int = 30

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
    logger.info(
        "[config] groq_api_key=%s",
        "present" if settings.groq_api_key else "ABSENT",
    )
    logger.info(
        "[config] smtp host=%s port=%d user=%s from=%s",
        settings.smtp_host or "ABSENT(emails logged, not sent)",
        settings.smtp_port,
        "present" if settings.smtp_user else "ABSENT",
        settings.smtp_from,
    )
    logger.info(
        "[config] prediction seq_len=%d tf=%s threshold=%.2f margin=%.2f scaler=%s",
        settings.prediction_seq_len,
        settings.prediction_timeframe,
        settings.prediction_confidence_threshold,
        settings.prediction_margin,
        settings.scaler_path or "none",
    )
    logger.info(
        "[config] news_context_limit=%d general_news_enabled=%s",
        settings.news_context_limit,
        settings.general_news_enabled,
    )
