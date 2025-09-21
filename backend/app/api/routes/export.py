from __future__ import annotations

import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_db_session, get_plan
from ..deps import PLAN_FREE
from ...models import Transaction
from ...schemas.transaction import TransactionBase
from ...services.users import ensure_local_user

router = APIRouter()


@router.get("/csv")
async def export_csv(
    plan: str = Depends(get_plan),
    session: AsyncSession = Depends(get_db_session),
) -> StreamingResponse:
    if plan == PLAN_FREE:
        raise HTTPException(status_code=status.HTTP_405_METHOD_NOT_ALLOWED, detail="Lite plan required")

    user = await ensure_local_user(session)
    stmt = select(Transaction).where(Transaction.user_id == user.id).order_by(Transaction.purchased_at.asc())
    result = await session.execute(stmt)
    transactions = result.scalars().all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "transaction_id",
            "purchased_at",
            "merchant_raw",
            "merchant_norm",
            "amount_cents",
            "currency",
            "card_last4",
            "token_last4",
            "wallet_type",
            "product_hint",
            "issuer",
            "status",
        ]
    )
    for tx in transactions:
        writer.writerow(
            [
                tx.id,
                tx.purchased_at.isoformat() if isinstance(tx.purchased_at, datetime) else str(tx.purchased_at),
                tx.merchant_raw,
                tx.merchant_norm or "",
                tx.amount_cents,
                tx.currency,
                tx.card_last4 or "",
                tx.token_last4 or "",
                tx.wallet_type or "",
                tx.product_hint or "",
                tx.issuer or "",
                tx.status,
            ]
        )

    buffer.seek(0)
    filename = datetime.utcnow().strftime("transactions_%Y%m%d.csv")
    return StreamingResponse(
        iter([buffer.getvalue().encode("utf-8")]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/json", response_model=list[TransactionBase])
async def export_json(
    plan: str = Depends(get_plan),
    session: AsyncSession = Depends(get_db_session),
) -> list[TransactionBase]:
    if plan == PLAN_FREE:
        raise HTTPException(status_code=status.HTTP_405_METHOD_NOT_ALLOWED, detail="Lite plan required")

    user = await ensure_local_user(session)
    stmt = select(Transaction).where(Transaction.user_id == user.id).order_by(Transaction.purchased_at.desc())
    result = await session.execute(stmt)
    transactions = result.scalars().all()

    return [
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
