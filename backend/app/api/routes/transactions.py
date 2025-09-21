from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select
from sqlalchemy.sql import or_
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_db_session, get_plan
from ...models import Transaction
from ...schemas.pagination import PaginatedResponse
from ...schemas.transaction import TransactionBase
from ...services.users import ensure_local_user
from ...utils.cards import resolve_card_label
from ..utils import apply_visibility_limit

router = APIRouter()


@router.get("/", response_model=PaginatedResponse[TransactionBase])
async def list_transactions(
    month: str | None = Query(None, regex=r"^\d{4}-\d{2}$"),
    card_label: str | None = Query(None),
    start_date: str | None = Query(None, regex=r"^\d{4}-\d{2}-\d{2}$"),
    end_date: str | None = Query(None, regex=r"^\d{4}-\d{2}-\d{2}$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    plan: str = Depends(get_plan),
    session: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[TransactionBase]:
    user = await ensure_local_user(session)

    stmt = select(Transaction).where(Transaction.user_id == user.id)
    if month:
        year, month_num = map(int, month.split("-"))
        stmt = stmt.where(
            Transaction.purchased_at >= f"{year:04d}-{month_num:02d}-01",
            Transaction.purchased_at < _next_month_iso(year, month_num),
        )
    if start_date:
        stmt = stmt.where(Transaction.purchased_at >= f"{start_date} 00:00:00")
    if end_date:
        stmt = stmt.where(Transaction.purchased_at <= f"{end_date} 23:59:59")
    if card_label:
        search = f"%{card_label.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Transaction.card_last4).like(search),
                func.lower(Transaction.token_last4).like(search),
                func.lower(Transaction.wallet_type).like(search),
                func.lower(Transaction.product_hint).like(search),
            )
        )

    filtered_subquery = stmt.subquery()

    total_stmt = select(func.count()).select_from(filtered_subquery)
    total_result = await session.execute(total_stmt)
    total = total_result.scalar_one()

    aggregate_stmt = select(
        func.coalesce(func.sum(filtered_subquery.c.amount_cents), 0).label("total_cents"),
        func.coalesce(
            func.sum(
                case(
                    (filtered_subquery.c.status == "pending", filtered_subquery.c.amount_cents),
                    else_=0,
                )
            ),
            0,
        ).label("pending_cents"),
        func.count(filtered_subquery.c.id).label("transaction_count"),
    )
    aggregate_result = await session.execute(aggregate_stmt)
    agg_row = aggregate_result.first()
    total_cents = int(agg_row.total_cents) if agg_row else 0
    pending_cents = int(agg_row.pending_cents) if agg_row else 0
    confirmed_cents = total_cents - pending_cents
    transaction_count = int(agg_row.transaction_count) if agg_row else 0

    # breakdown by label
    breakdown_result = await session.execute(
        select(filtered_subquery.c.id)
    )
    breakdown_map: dict[str, dict[str, int]] = {}
    tx_ids = [row.id for row in breakdown_result]
    if tx_ids:
        tx_rows = await session.execute(
            select(Transaction).where(Transaction.id.in_(tx_ids))
        )
        for tx in tx_rows.scalars():
            label = resolve_card_label(tx)
            record = breakdown_map.setdefault(label, {"amount_cents": 0, "count": 0})
            record["amount_cents"] += tx.amount_cents
            record["count"] += 1
    breakdown = [
        {
            "label": label,
            "amount_cents": data["amount_cents"],
            "count": data["count"],
        }
        for label, data in sorted(
            breakdown_map.items(), key=lambda item: item[1]["amount_cents"], reverse=True
        )
    ]

    paged_stmt = stmt.order_by(Transaction.purchased_at.desc())
    result = await session.execute(
        paged_stmt
            .offset((page - 1) * page_size)
            .limit(page_size)
    )
    transactions = result.scalars().all()

    items = [
        TransactionBase(
            id=tx.id,
            merchant_raw=tx.merchant_raw,
            merchant_norm=tx.merchant_norm,
            card_last4=tx.card_last4,
            token_last4=tx.token_last4,
            wallet_type=tx.wallet_type,
            product_hint=tx.product_hint,
            currency=tx.currency,
            amount_cents=tx.amount_cents,
            purchased_at=tx.purchased_at,
            status=tx.status,
            issuer=tx.issuer,
            flags=tx.flags or {},
        )
        for tx in transactions
    ]

    next_page = page + 1 if page * page_size < total else None
    prev_page = page - 1 if page > 1 else None

    metadata = {
        "total_amount_cents": total_cents,
        "pending_amount_cents": pending_cents,
        "confirmed_amount_cents": confirmed_cents,
        "transaction_count": transaction_count,
        "card_breakdown": breakdown,
    }

    visible_items, list_meta = apply_visibility_limit(items, plan)

    return PaginatedResponse[TransactionBase](
        items=visible_items,
        total=total,
        page=page,
        page_size=page_size,
        next_page=next_page,
        prev_page=prev_page,
        metadata=metadata,
        meta=list_meta,
    )


def _next_month_iso(year: int, month: int) -> str:
    if month == 12:
        return f"{year + 1:04d}-01-01"
    return f"{year:04d}-{month + 1:02d}-01"
