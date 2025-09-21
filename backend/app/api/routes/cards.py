from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_db_session, get_plan
from ..utils import apply_visibility_limit
from ...models import Transaction
from ...schemas.cards import (
    CardSummary,
    CardSummaryResponse,
    CardTransaction,
    CardTransactionsResponse,
)
from ...services.card_summary import fetch_card_summaries, fetch_card_transactions
from ...services.users import ensure_local_user, ensure_pro_user

router = APIRouter()


def _parse_month(value: str | None) -> datetime:
    if value is None:
        now = datetime.utcnow()
        return datetime(now.year, now.month, 1)
    try:
        year, month = value.split("-")
        return datetime(int(year), int(month), 1)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid month format") from exc


@router.get("/summary", response_model=CardSummaryResponse)
async def card_summary(
    month: str | None = Query(None, regex=r"^\d{4}-\d{2}$"),
    plan: str = Depends(get_plan),
    session: AsyncSession = Depends(get_db_session),
) -> CardSummaryResponse:
    target = _parse_month(month)
    user = await (ensure_local_user(session) if plan != "pro" else ensure_pro_user(session))

    summaries = await fetch_card_summaries(session, user.id, target)
    items = [CardSummary(**summary) for summary in summaries]
    visible_items, meta = apply_visibility_limit(items, plan)

    if plan == "free":
        for item in visible_items:
            item.top_merchants = []

    return CardSummaryResponse(items=visible_items, meta=meta)


@router.get("/{instrument_key}/transactions", response_model=CardTransactionsResponse)
async def card_transactions(
    instrument_key: str,
    month: str | None = Query(None, regex=r"^\d{4}-\d{2}$"),
    only_subs: bool = False,
    plan: str = Depends(get_plan),
    session: AsyncSession = Depends(get_db_session),
) -> CardTransactionsResponse:
    target = _parse_month(month)
    user = await (ensure_local_user(session) if plan != "pro" else ensure_pro_user(session))

    transactions = await fetch_card_transactions(session, user.id, instrument_key, target, only_subs=only_subs)

    items = [
        CardTransaction(
            id=tx.id,
            merchant=tx.merchant_norm or tx.merchant_raw or "Unknown",
            amount_cents=tx.amount_cents,
            currency=tx.currency,
            purchased_at=tx.purchased_at.isoformat(),
            status=tx.status,
            issuer=tx.issuer,
            merchant_norm=tx.merchant_norm,
        )
        for tx in transactions
    ]

    visible_items, meta = apply_visibility_limit(items, plan)
    return CardTransactionsResponse(items=visible_items, meta=meta, total=len(items))
