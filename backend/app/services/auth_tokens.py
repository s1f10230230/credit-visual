from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict

TOKEN_TTL = timedelta(hours=12)


@dataclass
class TokenInfo:
    plan: str
    email: str
    expires_at: datetime


class TokenStore:
    def __init__(self) -> None:
        self._tokens: Dict[str, TokenInfo] = {}

    def issue_token(self, email: str, plan: str) -> str:
        token = secrets.token_urlsafe(32)
        self._tokens[token] = TokenInfo(plan=plan, email=email, expires_at=datetime.utcnow() + TOKEN_TTL)
        return token

    def resolve_plan(self, token: str) -> str | None:
        info = self._tokens.get(token)
        if not info:
            return None
        if info.expires_at < datetime.utcnow():
            del self._tokens[token]
            return None
        return info.plan


token_store = TokenStore()
