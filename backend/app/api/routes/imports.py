from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_db_session, get_plan
from ..deps import PLAN_FREE
from ..utils import apply_visibility_limit, is_free_plan
from ..schemas import ListMeta
from ...core.limits import FREE_IMPORT_LIMIT, DEFAULT_IMPORT_LIMIT
from ...schemas.imports import ImportSummary
from ...services.importer import import_eml_files, extract_transaction_preview, coerce_datetime
from ...services.extractor.common import parse_eml
from ...services.users import ensure_local_user

router = APIRouter()


class RawImportRequest(BaseModel):
    texts: list[str]


class RawImportItem(BaseModel):
    merchant: str
    amount_cents: int
    purchased_at: datetime
    issuer: str | None = None
    card_last4: str | None = None
    token_last4: str | None = None
    wallet_type: str | None = None


class RawImportResponse(BaseModel):
    items: list[RawImportItem]
    meta: ListMeta


@router.post("/raw", response_model=RawImportResponse)
async def import_raw(
    payload: RawImportRequest,
    plan: str = Depends(get_plan),
    session: AsyncSession = Depends(get_db_session),
) -> RawImportResponse:
    texts = [text for text in payload.texts if text and text.strip()]
    if not texts:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No content provided")

    limit = FREE_IMPORT_LIMIT if plan == PLAN_FREE else DEFAULT_IMPORT_LIMIT
    texts = texts[:limit]

    # For non-free plans we prepare the user once so that Phase 2 can persist if desired.
    user = None
    if not is_free_plan(plan):
        user = await ensure_local_user(session)
        _ = user  # placeholder to avoid lint; persistence will come in later phases

    summaries: list[RawImportItem] = []
    for raw in texts:
        email = _prepare_email_from_text(raw)
        received_at = _parse_received_at(email)
        tx_data = extract_transaction_preview(email, received_at)
        if not tx_data:
            continue
        summaries.append(
            RawImportItem(
                merchant=tx_data["merchant_norm"] or tx_data["merchant_raw"],
                amount_cents=tx_data["amount_cents"],
                purchased_at=tx_data["purchased_at"],
                issuer=tx_data["issuer"],
                card_last4=tx_data["card_last4"],
                token_last4=tx_data["token_last4"],
                wallet_type=tx_data["wallet_type"],
            )
        )

    visible_items, meta = apply_visibility_limit(summaries, plan)
    return RawImportResponse(items=visible_items, meta=meta)


@router.post("/eml", response_model=ImportSummary)
async def import_eml(
    files: list[UploadFile] = File(...),
    plan: str = Depends(get_plan),
    session: AsyncSession = Depends(get_db_session),
) -> ImportSummary:
    if is_free_plan(plan):
        raise HTTPException(status_code=status.HTTP_405_METHOD_NOT_ALLOWED, detail="Lite plan required")

    stats = await import_eml_files(session, files)
    return ImportSummary(**stats.as_dict())


@router.post("/mbox")
async def import_mbox(
    file: UploadFile = File(...),
    plan: str = Depends(get_plan),
) -> dict[str, str]:
    if is_free_plan(plan):
        raise HTTPException(status_code=status.HTTP_405_METHOD_NOT_ALLOWED, detail="Lite plan required")
    return {"status": "accepted", "filename": file.filename}


@router.post("/csv")
async def import_csv(
    file: UploadFile = File(...),
    amount_column: Annotated[str | None, Form()] = None,
    date_column: Annotated[str | None, Form()] = None,
    plan: str = Depends(get_plan),
) -> dict[str, str | None]:
    if is_free_plan(plan):
        raise HTTPException(status_code=status.HTTP_405_METHOD_NOT_ALLOWED, detail="Lite plan required")
    return {
        "status": "accepted",
        "filename": file.filename,
        "amount_column": amount_column,
        "date_column": date_column,
    }


def _prepare_email_from_text(text: str) -> dict:
    stripped = text.lstrip()
    if stripped.lower().startswith("from:"):
        try:
            return parse_eml(text.encode("utf-8", "ignore"))
        except Exception:
            pass
    return {
        "message_id": None,
        "from": "",
        "subject": "",
        "date": None,
        "body": text,
        "headers": {},
    }


def _parse_received_at(email: dict) -> datetime:
    raw_date = email.get("date")
    parsed = coerce_datetime(raw_date)
    return parsed or datetime.utcnow()
