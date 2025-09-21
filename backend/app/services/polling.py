from __future__ import annotations

import asyncio
from datetime import datetime, timedelta

from ..core.config import settings
from ..workers.poller import poll_mailbox
from ..db.session import SessionLocal
from ..services.users import ensure_pro_user
from ..services.importer import ingest_raw_messages
from .scheduler import scheduler


async def run_imap_poll() -> None:
    host = settings.IMAP_HOST
    username = settings.IMAP_USERNAME
    password = settings.IMAP_PASSWORD
    if not (host and username and password):
        return

    since = datetime.utcnow() - timedelta(days=1)
    result = await asyncio.to_thread(poll_mailbox, host, username, password, since)
    if result.errors:
        print("[poller] errors:", result.errors)

    if not result.messages:
        return

    async with SessionLocal() as session:
        user = await ensure_pro_user(session)
        stats = await ingest_raw_messages(session, user.id, result.messages)
        await session.commit()
        print(
            f"[poller] fetched {result.fetched_count} messages, "
            f"stored {stats.transactions_created} transactions, duplicates {stats.duplicates}"
        )


if settings.ENABLE_IMAP_POLL:
    scheduler.add_interval_task(
        name="imap_poll",
        interval=max(60, float(settings.IMAP_POLL_INTERVAL_SECONDS)),
        callback=run_imap_poll,
    )
