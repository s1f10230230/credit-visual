from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class MerchantAlias(Base):
    __tablename__ = "merchant_aliases"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    raw_pattern: Mapped[str] = mapped_column(String)
    norm_name: Mapped[str] = mapped_column(String)
    source: Mapped[str] = mapped_column(String, default="system")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
