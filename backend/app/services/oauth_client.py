from __future__ import annotations

from dataclasses import dataclass

from ..core.config import settings


@dataclass
class OAuthConfig:
    client_id: str | None = None
    client_secret: str | None = None
    redirect_uri: str | None = None


oauth_config = OAuthConfig(
    client_id=settings.GMAIL_CLIENT_ID if hasattr(settings, "GMAIL_CLIENT_ID") else None,
    client_secret=settings.GMAIL_CLIENT_SECRET if hasattr(settings, "GMAIL_CLIENT_SECRET") else None,
    redirect_uri=settings.GMAIL_REDIRECT_URI if hasattr(settings, "GMAIL_REDIRECT_URI") else None,
)
