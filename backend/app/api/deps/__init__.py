from collections.abc import AsyncIterator
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...services.jwt_auth import jwt_auth


PLAN_FREE = "free"
PLAN_LITE = "lite"
PLAN_PRO = "pro"
_KNOWN_PLANS = {PLAN_FREE, PLAN_LITE, PLAN_PRO}


async def get_db_session() -> AsyncIterator[AsyncSession]:
    async with get_session() as session:
        yield session


async def get_current_user(
    authorization: str | None = Header(default=None, convert_underscores=False)
) -> Optional[dict]:
    """Get current user from JWT token."""
    if not authorization:
        return None

    token = authorization.replace("Bearer", "").strip()
    if not token:
        return None

    return jwt_auth.verify_token(token)


async def get_plan(
    authorization: str | None = Header(default=None, convert_underscores=False),
    x_plan: str | None = Header(default=None),
) -> str:
    """Get user plan from token or header."""
    if authorization:
        token = authorization.replace("Bearer", "").strip()
        if token:
            user = jwt_auth.verify_token(token)
            if user and user.get("plan") in _KNOWN_PLANS:
                return user["plan"]

    if x_plan:
        plan_header = x_plan.strip().lower()
        if plan_header in _KNOWN_PLANS:
            return plan_header

    return PLAN_FREE


async def require_auth(current_user: dict = Depends(get_current_user)) -> dict:
    """Require valid authentication."""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return current_user


def require_plan(required_plans: list[str]):
    """Require specific plan(s)."""
    async def _check_plan(current_user: dict = Depends(require_auth)) -> dict:
        if current_user["plan"] not in required_plans:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Plan {current_user['plan']} not authorized. Required: {required_plans}",
            )
        return current_user
    return _check_plan
