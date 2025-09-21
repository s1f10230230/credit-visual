from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..deps import get_plan
from ..deps import PLAN_FREE
from ...services.settings import get_retention, update_retention, RetentionSettings, RetentionUpdate

router = APIRouter()


@router.get("/retention")
async def get_retention_settings() -> RetentionSettings:
    return get_retention()


@router.post("/retention")
async def set_retention_settings(
    payload: RetentionUpdate,
    plan: str = Depends(get_plan),
) -> RetentionSettings:
    if plan == PLAN_FREE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Requires Lite plan or higher")

    return update_retention(store_raw_messages=payload.store_raw_messages)


class RetentionUpdate(BaseModel):
    store_raw_messages: bool
