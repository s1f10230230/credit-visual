from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_plan, PLAN_PRO, get_db_session
from ...core.config import settings
from ...services.oauth import get_oauth_credential, upsert_oauth_credential
from ...services.oauth_flow import oauth_flow_manager

router = APIRouter()


class GmailConfigResponse(BaseModel):
    client_id: str | None
    redirect_uri: str | None
    enabled: bool


class GmailConfigUpdate(BaseModel):
    client_id: str
    client_secret: str
    redirect_uri: str | None = None


class GmailAuthStartResponse(BaseModel):
    authorize_url: str
    state: str


class GmailAuthCallbackPayload(BaseModel):
    state: str
    code: str


@router.get("/gmail/config", response_model=GmailConfigResponse)
async def get_gmail_config(
    plan: str = Depends(get_plan),
    session: AsyncSession = Depends(get_db_session),
) -> GmailConfigResponse:
    if plan != PLAN_PRO:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Pro plan required")
    credential = await get_oauth_credential(session, provider="gmail")
    return GmailConfigResponse(
        client_id=credential.client_id if credential else None,
        redirect_uri=credential.redirect_uri if credential else None,
        enabled=settings.ENABLE_IMAP_POLL,
    )


@router.post("/gmail/config", response_model=GmailConfigResponse)
async def update_gmail_config(
    payload: GmailConfigUpdate,
    plan: str = Depends(get_plan),
    session: AsyncSession = Depends(get_db_session),
) -> GmailConfigResponse:
    if plan != PLAN_PRO:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Pro plan required")
    credential = await upsert_oauth_credential(
        session,
        provider="gmail",
        client_id=payload.client_id,
        client_secret=payload.client_secret,
        redirect_uri=payload.redirect_uri,
    )
    return GmailConfigResponse(
        client_id=credential.client_id,
        redirect_uri=credential.redirect_uri,
        enabled=settings.ENABLE_IMAP_POLL,
    )


@router.post("/gmail/start", response_model=GmailAuthStartResponse)
async def start_gmail_oauth(
    plan: str = Depends(get_plan),
    session: AsyncSession = Depends(get_db_session),
) -> GmailAuthStartResponse:
    if plan != PLAN_PRO:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Pro plan required")

    credential = await get_oauth_credential(session, provider="gmail")
    if not credential:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Gmail credential not configured")

    state = oauth_flow_manager.create_state()
    authorize_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={credential.client_id}"
        "&response_type=code"
        "&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgmail.readonly"
        f"&redirect_uri={credential.redirect_uri or ''}"
        f"&state={state}"
        "&access_type=offline"
        "&prompt=consent"
    )
    return GmailAuthStartResponse(authorize_url=authorize_url, state=state)


@router.post("/gmail/callback", response_model=GmailConfigResponse)
async def gmail_oauth_callback(
    payload: GmailAuthCallbackPayload,
    plan: str = Depends(get_plan),
    session: AsyncSession = Depends(get_db_session),
) -> GmailConfigResponse:
    if plan != PLAN_PRO:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Pro plan required")

    if not oauth_flow_manager.verify_state(payload.state):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid state")

    credential = await get_oauth_credential(session, provider="gmail")
    if not credential:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Gmail credential not configured")

    from datetime import datetime, timedelta
    from ...services.gmail_tokens import upsert_gmail_token
    from ...services.google_client import google_client

    token_response = await google_client.exchange_code_for_token(payload.code)
    expires_in = int(token_response.get("expires_in", 3300))
    access_token = str(token_response.get("access_token"))
    refresh_token = str(token_response.get("refresh_token", ""))

    await upsert_gmail_token(
        session,
        user_id="pro-user",  # TODO: replace with authenticated user context
        credential_id=credential.id,
        access_token=access_token,
        refresh_token=refresh_token,
        token_expiry=datetime.utcnow() + timedelta(seconds=expires_in),
    )

    return GmailConfigResponse(
        client_id=credential.client_id,
        redirect_uri=credential.redirect_uri,
        enabled=settings.ENABLE_IMAP_POLL,
    )
