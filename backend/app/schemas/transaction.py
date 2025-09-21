from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class TransactionBase(BaseModel):
    id: str
    merchant_raw: str
    merchant_norm: Optional[str]
    card_last4: Optional[str]
    token_last4: Optional[str] = None
    wallet_type: Optional[str] = None
    product_hint: Optional[str] = None
    currency: str = "JPY"
    amount_cents: int
    purchased_at: datetime
    status: str = "confirmed"
    issuer: Optional[str] = None
    flags: dict = {}


class TransactionCreate(BaseModel):
    user_id: str
    merchant_raw: str
    amount_cents: int
    currency: str = "JPY"
    purchased_at: datetime
    merchant_norm: Optional[str] = None
    card_last4: Optional[str] = None
    token_last4: Optional[str] = None
    wallet_type: Optional[str] = None
    product_hint: Optional[str] = None
    issuer: Optional[str] = None
    flags: dict = {}


class TransactionSummary(BaseModel):
    card_label: str
    total_cents: int
    confirmed_cents: int
    pending_cents: int
    transaction_count: int
