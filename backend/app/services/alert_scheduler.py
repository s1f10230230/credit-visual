from __future__ import annotations

from datetime import datetime

from ..core.config import settings
from ..db.session import SessionLocal
from ..services.alerts import generate_alerts
from ..services.scheduler import scheduler
from ..services.users import ensure_pro_user


async def run_alert_detection() -> None:
    async with SessionLocal() as session:
        user = await ensure_pro_user(session)
        alerts = await generate_alerts(session, user.id)
        if alerts:
            await session.commit()
            print(f"[alerts] generated {len(alerts)} alerts at {datetime.utcnow().isoformat()}" )
        else:
            await session.rollback()


if settings.ENABLE_GMAIL_SYNC or settings.ENABLE_IMAP_POLL:
    scheduler.add_interval_task(
        name="alert_detection",
        interval=600,
        callback=run_alert_detection,
    )
