from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import GmailToken


async def get_gmail_token(session: AsyncSession, user_id: str) -> Optional[GmailToken]:
    stmt = select(GmailToken).where(GmailToken.user_id == user_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def upsert_gmail_token(
    session: AsyncSession,
    user_id: str,
    credential_id: str,
    access_token: str,
    refresh_token: str,
    token_expiry: datetime,
) -> GmailToken:
    existing = await get_gmail_token(session, user_id)
    if existing:
        existing.access_token = access_token
        existing.refresh_token = refresh_token
        existing.token_expiry = token_expiry
        existing.credential_id = credential_id
        await session.flush()
        return existing

    token = GmailToken(
        id=str(uuid4()),
        user_id=user_id,
        credential_id=credential_id,
        access_token=access_token,
        refresh_token=refresh_token,
        token_expiry=token_expiry,
    )
    session.add(token)
    await session.flush()
    return token
