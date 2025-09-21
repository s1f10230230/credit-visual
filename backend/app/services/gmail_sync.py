from __future__ import annotations

from datetime import datetime, timedelta

from ..core.config import settings
from ..db.session import SessionLocal
from ..services.gmail_tokens import get_gmail_token
from ..services.google_client import google_client
from ..services.importer import ingest_raw_messages
from ..services.scheduler import scheduler
from ..services.users import ensure_pro_user


async def run_gmail_sync() -> None:
    if not settings.ENABLE_GMAIL_SYNC:
        return

    async with SessionLocal() as session:
        token = await get_gmail_token(session, user_id="pro-user")
        if not token:
            return

        user = await ensure_pro_user(session)
        messages = await google_client.fetch_messages(token.access_token)
        if not messages:
            return
        stats = await ingest_raw_messages(session, user.id, messages)
        await session.commit()
        print(
            f"[gmail-sync] stored {stats.transactions_created} transactions, "
            f"duplicates {stats.duplicates}, errors {stats.errors}"
        )


if settings.ENABLE_GMAIL_SYNC:
    scheduler.add_interval_task(
        name="gmail_sync",
        interval=max(120, float(settings.GMAIL_SYNC_INTERVAL_SECONDS)),
        callback=run_gmail_sync,
    )
