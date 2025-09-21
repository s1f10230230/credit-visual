from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, JSON
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    merchant_norm: Mapped[str] = mapped_column(String, index=True)
    cadence: Mapped[str] = mapped_column(String)
    amount_cents_min: Mapped[int] = mapped_column(Integer)
    amount_cents_max: Mapped[int] = mapped_column(Integer)
    card_last4: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    first_seen: Mapped[date] = mapped_column(Date)
    last_seen: Mapped[date] = mapped_column(Date)
    confidence: Mapped[float] = mapped_column(Numeric(scale=2))
    signals: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
