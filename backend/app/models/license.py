from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class License(Base):
    __tablename__ = "licenses"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    plan: Mapped[str] = mapped_column(String)
    issued_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
