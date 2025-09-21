from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class MailSource(Base):
    __tablename__ = "mail_sources"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String)
    config: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String, default="inactive")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
