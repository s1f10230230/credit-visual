from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import User


async def get_user_by_email(session: AsyncSession, email: str) -> Optional[User]:
    stmt = select(User).where(User.email == email)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def upsert_user_with_plan(session: AsyncSession, email: str, plan: str) -> User:
    user = await get_user_by_email(session, email)
    if user:
        if plan and user.plan != plan:
            user.plan = plan
            await session.flush()
        return user

    user = User(id=email, email=email, plan=plan)
    session.add(user)
    await session.flush()
    return user
