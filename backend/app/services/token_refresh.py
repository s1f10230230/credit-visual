from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import settings
from ..services.scheduler import scheduler
from ..services.oauth import get_oauth_credential
from ..services.gmail_tokens import get_gmail_token, upsert_gmail_token


REFRESH_THRESHOLD = timedelta(minutes=5)


async def refresh_gmail_tokens(session_factory) -> None:
    async with session_factory() as session:
        token = await get_gmail_token(session, user_id="pro-user")
        if not token:
            return
        if token.token_expiry - datetime.utcnow() > REFRESH_THRESHOLD:
            return
        credential = await get_oauth_credential(session, provider="gmail")
        if not credential:
            return
        # Stub refresh: real implementation should call Google token endpoint.
        await upsert_gmail_token(
            session,
            user_id="pro-user",
            credential_id=credential.id,
            access_token=f"access-refresh-{datetime.utcnow().timestamp()}",
            refresh_token=token.refresh_token,
            token_expiry=datetime.utcnow() + timedelta(minutes=55),
        )


if settings.ENABLE_IMAP_POLL:
    from ..db.session import SessionLocal

    scheduler.add_interval_task(
        name="gmail_token_refresh",
        interval=300,
        callback=lambda: refresh_gmail_tokens(SessionLocal),
    )
