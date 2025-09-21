from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from statistics import mean
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Alert, Transaction


async def generate_alerts(session: AsyncSession, user_id: str) -> list[Alert]:
    stmt = select(Transaction).where(Transaction.user_id == user_id).order_by(
        Transaction.merchant_norm, Transaction.purchased_at
    )
    transactions = (await session.execute(stmt)).scalars().all()
    if not transactions:
        return []

    existing_stmt = select(Alert).where(Alert.user_id == user_id)
    existing_alerts = {(alert.kind, alert.payload.get("merchant")): alert for alert in (await session.execute(existing_stmt)).scalars()}

    alerts: list[Alert] = []
    grouped: dict[str, list[Transaction]] = defaultdict(list)
    for tx in transactions:
        key = tx.merchant_norm or tx.merchant_raw
        grouped[key].append(tx)

    for merchant, txs in grouped.items():
        if len(txs) < 2:
            continue
        amounts = [tx.amount_cents for tx in txs if tx.amount_cents > 0]
        if len(amounts) < 2:
            continue
        last_amount = amounts[-1]
        prev_avg = mean(amounts[:-1])
        if prev_avg == 0:
            continue
        diff_ratio = (last_amount - prev_avg) / prev_avg
        if diff_ratio >= 0.2:
            key = ("price_increase", merchant)
            if key not in existing_alerts:
                alert = Alert(
                    id=str(uuid4()),
                    user_id=user_id,
                    kind="price_increase",
                    payload={
                        "merchant": merchant,
                        "previous_average_cents": int(prev_avg),
                        "current_amount_cents": last_amount,
                        "generated_at": datetime.utcnow().isoformat(),
                    },
                )
                session.add(alert)
                alerts.append(alert)

        # trial detection: first positive after a 0 amount or missing
        zero_amounts = [tx for tx in txs if tx.amount_cents == 0]
        if zero_amounts and txs[-1].amount_cents > 0:
            key = ("trial_end", merchant)
            if key not in existing_alerts:
                alert = Alert(
                    id=str(uuid4()),
                    user_id=user_id,
                    kind="trial_end",
                    payload={
                        "merchant": merchant,
                        "trial_date": min(z.purchased_at for z in zero_amounts).isoformat(),
                        "first_charge_cents": txs[-1].amount_cents,
                        "generated_at": datetime.utcnow().isoformat(),
                    },
                )
                session.add(alert)
                alerts.append(alert)

    return alerts


async def list_alerts(session: AsyncSession, user_id: str) -> list[Alert]:
    stmt = select(Alert).where(Alert.user_id == user_id).order_by(Alert.created_at.desc())
    result = await session.execute(stmt)
    return result.scalars().all()
