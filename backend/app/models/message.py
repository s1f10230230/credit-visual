from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, LargeBinary, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (UniqueConstraint("provider_msg_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    provider_msg_id: Mapped[str] = mapped_column(String)
    from_addr: Mapped[str] = mapped_column(String)
    subject: Mapped[str] = mapped_column(String)
    received_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    card_hint: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    issuer_hint: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    raw_encrypted: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
