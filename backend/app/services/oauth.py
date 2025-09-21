from __future__ import annotations

from typing import Optional
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import OAuthCredential


async def get_oauth_credential(session: AsyncSession, provider: str) -> Optional[OAuthCredential]:
    stmt = select(OAuthCredential).where(OAuthCredential.provider == provider)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def upsert_oauth_credential(
    session: AsyncSession,
    provider: str,
    client_id: str,
    client_secret: str,
    redirect_uri: str | None = None,
) -> OAuthCredential:
    existing = await get_oauth_credential(session, provider)
    if existing:
        existing.client_id = client_id
        existing.client_secret = client_secret
        existing.redirect_uri = redirect_uri
        await session.flush()
        return existing

    credential = OAuthCredential(
        id=str(uuid4()),
        provider=provider,
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri,
    )
    session.add(credential)
    await session.flush()
    return credential
