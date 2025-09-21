from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, time

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_db_session, get_plan
from ..utils import apply_visibility_limit
from ...models import Transaction
from ...schemas.dashboard import DashboardSummary
from ...schemas.transaction import TransactionSummary
from ...services.users import ensure_local_user
from ...utils.cards import resolve_card_label

router = APIRouter()


@router.get("/summary", response_model=DashboardSummary)
async def get_summary(
    month: str | None = Query(None, regex=r"^\d{4}-\d{2}$"),
    plan: str = Depends(get_plan),
    session: AsyncSession = Depends(get_db_session),
) -> DashboardSummary:
    target_month = _resolve_month(month)
    month_str = target_month.strftime("%Y-%m")

    start_dt = datetime.combine(target_month, time.min)
    end_month = _next_month(target_month)
    end_dt = datetime.combine(end_month, time.min)

    user = await ensure_local_user(session)

    stmt = select(Transaction).where(
        Transaction.user_id == user.id,
        Transaction.purchased_at >= start_dt,
        Transaction.purchased_at < end_dt,
    )
    result = await session.execute(stmt)
    transactions = result.scalars().all()

    aggregates: dict[str, dict[str, int]] = defaultdict(
        lambda: {"total_cents": 0, "confirmed_cents": 0, "pending_cents": 0, "transaction_count": 0}
    )

    total_amount = 0
    for tx in transactions:
        label = resolve_card_label(tx)
        bucket = aggregates[label]
        bucket["total_cents"] += tx.amount_cents
        bucket["transaction_count"] += 1
        if tx.status == "pending":
            bucket["pending_cents"] += tx.amount_cents
        else:
            bucket["confirmed_cents"] += tx.amount_cents
        total_amount += tx.amount_cents

    card_summaries = [
        TransactionSummary(
            card_label=label,
            total_cents=values["total_cents"],
            confirmed_cents=values["confirmed_cents"],
            pending_cents=values["pending_cents"],
            transaction_count=values["transaction_count"],
        )
        for label, values in sorted(
            aggregates.items(), key=lambda item: item[1]["total_cents"], reverse=True
        )
    ]

    visible_cards, meta = apply_visibility_limit(card_summaries, plan)

    return DashboardSummary(
        month=month_str,
        total_amount_cents=total_amount,
        cards=visible_cards,
        meta=meta,
    )


def _resolve_month(month: str | None) -> date:
    if month is None:
        today = date.today()
        return today.replace(day=1)
    try:
        year, month_number = month.split("-")
        return date(int(year), int(month_number), 1)
    except ValueError as exc:  # pragma: no cover - validation guard
        raise HTTPException(status_code=400, detail="Invalid month format") from exc


def _next_month(current: date) -> date:
    year = current.year + (1 if current.month == 12 else 0)
    month = 1 if current.month == 12 else current.month + 1
    return date(year, month, 1)
