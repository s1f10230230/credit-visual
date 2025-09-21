from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from pydantic import BaseModel

from ..deps import get_db_session, get_plan
from ..schemas import ListMeta
from ..utils import apply_visibility_limit
from ...models import Transaction
from ...schemas.subscription import SubscriptionOut
from ...services.subscription.detector import detect_subscriptions
from ...services.users import ensure_local_user

router = APIRouter()


class SubscriptionListResponse(BaseModel):
    items: list[SubscriptionOut]
    meta: ListMeta


@router.get("/", response_model=SubscriptionListResponse)
async def list_subscriptions(
    min_conf: float = Query(0.7, ge=0.0, le=1.0),
    cadence: str | None = Query(None),
    plan: str = Depends(get_plan),
    session: AsyncSession = Depends(get_db_session),
) -> SubscriptionListResponse:
    user = await ensure_local_user(session)

    stmt = select(Transaction).where(Transaction.user_id == user.id)
    result = await session.execute(stmt)
    transactions = result.scalars().all()

    candidates = detect_subscriptions(transactions)
    filtered = [
        candidate
        for candidate in candidates
        if candidate.confidence >= min_conf and (cadence is None or candidate.cadence == cadence)
    ]

    filtered.sort(key=lambda item: item.confidence, reverse=True)

    items = [
        SubscriptionOut(
            merchant_norm=candidate.merchant_norm,
            cadence=candidate.cadence,
            amount_cents_min=candidate.amount_cents_min,
            amount_cents_max=candidate.amount_cents_max,
            card_last4=candidate.card_last4,
            token_last4=candidate.signals.get("token_last4") if candidate.signals else None,
            wallet_type=candidate.signals.get("wallet_type") if candidate.signals else None,
            product_hint=candidate.signals.get("product_hint") if candidate.signals else None,
            first_seen=candidate.first_seen,
            last_seen=candidate.last_seen,
            confidence=candidate.confidence,
            signals=candidate.signals,
        )
        for candidate in filtered
    ]

    visible_items, meta = apply_visibility_limit(items, plan)
    return SubscriptionListResponse(items=visible_items, meta=meta)
