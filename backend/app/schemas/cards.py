from __future__ import annotations

from typing import List

from pydantic import BaseModel

from ..api.schemas import ListMeta


class MerchantSummary(BaseModel):
    name: str
    amount_cents: int
    transaction_count: int


class CardSummary(BaseModel):
    instrument_key: str
    issuer: str
    label: str
    card_last4: str | None = None
    token_last4: str | None = None
    wallet_type: str | None = None
    total_amount_cents: int
    transaction_count: int
    subscription_count: int
    top_merchants: List[MerchantSummary]


class CardSummaryResponse(BaseModel):
    items: List[CardSummary]
    meta: ListMeta


class CardTransaction(BaseModel):
    id: str
    merchant: str
    amount_cents: int
    currency: str
    purchased_at: str
    status: str
    issuer: str | None = None
    merchant_norm: str | None = None


class CardTransactionsResponse(BaseModel):
    items: List[CardTransaction]
    meta: ListMeta
    total: int
