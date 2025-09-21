from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_plan, PLAN_PRO, get_db_session
from ...services.users import ensure_pro_user
from ...services.alerts import generate_alerts, list_alerts

router = APIRouter()


class AlertPayload(BaseModel):
    id: str
    kind: str
    payload: dict
    created_at: str
    sent_at: str | None = None


@router.get("/", response_model=list[AlertPayload])
async def get_alerts(
    plan: str = Depends(get_plan),
    session: AsyncSession = Depends(get_db_session),
) -> list[AlertPayload]:
    if plan != PLAN_PRO:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Requires Pro plan")
    user = await ensure_pro_user(session)
    alerts = await list_alerts(session, user.id)
    return [
        AlertPayload(
            id=alert.id,
            kind=alert.kind,
            payload=alert.payload,
            created_at=alert.created_at.isoformat(),
            sent_at=alert.sent_at.isoformat() if alert.sent_at else None,
        )
        for alert in alerts
    ]


@router.post("/refresh", response_model=dict)
async def refresh_alerts(
    plan: str = Depends(get_plan),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, int]:
    if plan != PLAN_PRO:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Requires Pro plan")
    user = await ensure_pro_user(session)
    alerts = await generate_alerts(session, user.id)
    await session.commit()
    return {"generated": len(alerts)}
