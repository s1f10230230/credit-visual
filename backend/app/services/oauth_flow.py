from __future__ import annotations

from datetime import datetime, timedelta
import secrets


class OAuthFlowManager:
    def __init__(self) -> None:
        self.state_tokens: dict[str, datetime] = {}

    def create_state(self) -> str:
        state = secrets.token_urlsafe(32)
        self.state_tokens[state] = datetime.utcnow()
        return state

    def verify_state(self, state: str) -> bool:
        created = self.state_tokens.get(state)
        if not created:
            return False
        if datetime.utcnow() - created > timedelta(minutes=5):
            return False
        return True


oauth_flow_manager = OAuthFlowManager()
