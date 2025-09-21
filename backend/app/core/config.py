from functools import lru_cache

try:  # Pydantic v2
    from pydantic_settings import BaseSettings
except ImportError:  # Fall back to v1 for local environments
    from pydantic import BaseSettings  # type: ignore


class Settings(BaseSettings):
    PROJECT_NAME: str = "Subscan API"
    VERSION: str = "0.1.0"
    API_PREFIX: str = "/api"

    DATABASE_URL: str = "sqlite+aiosqlite:///./app.db"
    JWT_SECRET: str = "change-me"
    DEFAULT_USER_ID: str = "lite-local-user"
    DEFAULT_USER_EMAIL: str = "lite@local"
    ENABLE_IMAP_POLL: bool = False
    IMAP_HOST: str | None = None
    IMAP_USERNAME: str | None = None
    IMAP_PASSWORD: str | None = None
    IMAP_POLL_INTERVAL_SECONDS: int = 300
    ENABLE_GMAIL_SYNC: bool = False
    GMAIL_SYNC_INTERVAL_SECONDS: int = 600
    GMAIL_CLIENT_ID: str | None = None
    GMAIL_CLIENT_SECRET: str | None = None
    GMAIL_REDIRECT_URI: str | None = None
    STRIPE_SECRET_KEY: str | None = None
    STRIPE_PUBLISHABLE_KEY: str | None = None
    STRIPE_WEBHOOK_SECRET: str | None = None
    STRIPE_PRICE_LITE: str | None = None
    STRIPE_PRICE_PRO: str | None = None
    STRIPE_CHECKOUT_SUCCESS_URL: str | None = None
    STRIPE_CHECKOUT_CANCEL_URL: str | None = None

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
