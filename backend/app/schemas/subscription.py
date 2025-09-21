from datetime import date
from typing import Optional

from pydantic import BaseModel


class SubscriptionOut(BaseModel):
    merchant_norm: str
    cadence: str
    amount_cents_min: int
    amount_cents_max: int
    card_last4: Optional[str]
    token_last4: Optional[str] = None
    wallet_type: Optional[str] = None
    product_hint: Optional[str] = None
    first_seen: date
    last_seen: date
    confidence: float
    signals: dict[str, float | str | None] | None = None
