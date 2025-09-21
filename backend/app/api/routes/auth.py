from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_db_session
from ...services.jwt_auth import jwt_auth
from ...services.user_sessions import upsert_user_with_plan

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    plan: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    plan: str


@router.post("/mock-login", response_model=LoginResponse)
async def mock_login(
    payload: LoginRequest,
    session: AsyncSession = Depends(get_db_session),
) -> LoginResponse:
    plan = payload.plan.lower()
    if plan not in {"free", "lite", "pro"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported plan")
    
    user = await upsert_user_with_plan(session, payload.email, plan)
    await session.commit()
    
    token = jwt_auth.create_access_token(
        email=payload.email,
        plan=plan,
        user_id=user.id
    )
    return LoginResponse(access_token=token, plan=plan)
