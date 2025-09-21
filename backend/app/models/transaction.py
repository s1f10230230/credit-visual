from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    message_id: Mapped[Optional[str]] = mapped_column(ForeignKey("messages.id", ondelete="SET NULL"), nullable=True)
    card_last4: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    token_last4: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    wallet_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    product_hint: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="JPY")
    amount_cents: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String, default="confirmed")
    merchant_raw: Mapped[str] = mapped_column(String)
    merchant_norm: Mapped[Optional[str]] = mapped_column(String, index=True)
    purchased_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    issuer: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    flags: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
