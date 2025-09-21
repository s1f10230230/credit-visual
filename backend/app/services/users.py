from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import settings
from ..models import User


async def ensure_user(session: AsyncSession, user_id: str, email: str, plan: str) -> User:
    user = await session.get(User, user_id)
    if user is None:
        user = User(id=user_id, email=email, plan=plan)
        session.add(user)
        await session.flush()
        return user

    if plan and user.plan != plan:
        user.plan = plan
        await session.flush()
    return user


async def ensure_local_user(session: AsyncSession) -> User:
    return await ensure_user(
        session,
        settings.DEFAULT_USER_ID,
        settings.DEFAULT_USER_EMAIL,
        "lite",
    )


async def ensure_pro_user(session: AsyncSession) -> User:
    user_id = getattr(settings, "PRO_USER_ID", None) or "pro-local-user"
    email = getattr(settings, "PRO_USER_EMAIL", None) or "pro@local"
    return await ensure_user(session, user_id, email, "pro")
