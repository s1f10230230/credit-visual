from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Transaction


@dataclass
class CardAggregate:
    card_label: str
    total_cents: int = 0
    confirmed_cents: int = 0
    pending_cents: int = 0
    transaction_count: int = 0


async def fetch_monthly_summary(
    session: AsyncSession,
    user_id: str,
    month: str,
) -> list[CardAggregate]:
    month_prefix = f"{month}-"
    stmt = select(Transaction).where(
        Transaction.user_id == user_id,
        Transaction.purchased_at.like(f"{month_prefix}%"),
    )
    result = await session.execute(stmt)
    rows = result.scalars().all()

    aggregates: dict[str, CardAggregate] = {}
    for tx in rows:
        label = tx.card_last4 or "その他"
        agg = aggregates.setdefault(label, CardAggregate(card_label=label))
        agg.total_cents += tx.amount_cents
        agg.transaction_count += 1
        if tx.status == "pending":
            agg.pending_cents += tx.amount_cents
        else:
            agg.confirmed_cents += tx.amount_cents

    return list(aggregates.values())
