from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Iterable
from uuid import uuid4

from dateutil import parser as dateparser
from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Message, Transaction
from ..services.users import ensure_local_user
from ..services.settings import get_retention
from .extractor.common import parse_eml
from .extractor.registry import load_extractors
from .normalizer.merchant import normalize_name


@dataclass
class ImportStats:
    processed: int = 0
    ingested_messages: int = 0
    transactions_created: int = 0
    duplicates: int = 0
    no_match: int = 0
    errors: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, int | list[str]]:
        return {
            "processed": self.processed,
            "ingested_messages": self.ingested_messages,
            "transactions_created": self.transactions_created,
            "duplicates": self.duplicates,
            "no_match": self.no_match,
            "errors": self.errors,
        }


EXTRACTORS = load_extractors()
MIN_SCORE = 0.3


async def import_eml_files(session: AsyncSession, files: Iterable[UploadFile]) -> ImportStats:
    stats = ImportStats()
    user = await ensure_local_user(session)
    retention = get_retention()

    for upload in files:
        stats.processed += 1
        try:
            content = await upload.read()
            await upload.close()
        except Exception as exc:  # pragma: no cover - UploadFile I/O errorsは稀
            stats.errors.append(f"{upload.filename}: read_error: {exc}")
            continue

        if not content:
            stats.errors.append(f"{upload.filename}: empty_file")
            continue

        try:
            email = parse_eml(content)
        except Exception as exc:  # pragma: no cover
            stats.errors.append(f"{upload.filename}: parse_error: {exc}")
            continue

        await _process_email(session, user.id, email, content, stats, retention)

    return stats


async def ingest_raw_messages(
    session: AsyncSession,
    user_id: str,
    contents: Iterable[bytes],
) -> ImportStats:
    stats = ImportStats()
    retention = get_retention()
    for content in contents:
        stats.processed += 1
        try:
            email = parse_eml(content)
        except Exception as exc:  # pragma: no cover - parsing errors
            stats.errors.append(f"parse_error: {exc}")
            continue
        await _process_email(session, user_id, email, content, stats, retention)
    return stats


async def _process_email(
    session: AsyncSession,
    user_id: str,
    email: dict,
    raw_content: bytes | None,
    stats: ImportStats,
    retention,
) -> bool:
    provider_msg_id = email.get("message_id") or f"local-{uuid4()}"
    received_at = _coerce_datetime(email.get("date")) or datetime.utcnow()

    exists_stmt = select(Message.id).where(
        Message.user_id == user_id,
        Message.provider_msg_id == provider_msg_id,
    )
    existing = await session.scalar(exists_stmt)
    if existing:
        stats.duplicates += 1
        return False

    message = Message(
        id=str(uuid4()),
        user_id=user_id,
        provider_msg_id=provider_msg_id,
        from_addr=email.get("from", ""),
        subject=email.get("subject", ""),
        received_at=received_at,
        card_hint=None,
        issuer_hint=None,
        raw_encrypted=raw_content if retention.store_raw_messages else None,
    )
    session.add(message)
    stats.ingested_messages += 1

    tx_data = _extract_transaction_data(email, received_at)
    if tx_data is None:
        stats.no_match += 1
        return False

    transaction = Transaction(
        id=str(uuid4()),
        user_id=user_id,
        message_id=message.id,
        merchant_raw=tx_data["merchant_raw"],
        merchant_norm=tx_data["merchant_norm"],
        amount_cents=tx_data["amount_cents"],
        currency=tx_data["currency"],
        purchased_at=tx_data["purchased_at"],
        card_last4=tx_data["card_last4"],
        token_last4=tx_data["token_last4"],
        wallet_type=tx_data["wallet_type"],
        product_hint=tx_data["product_hint"],
        issuer=tx_data["issuer"],
        status=tx_data["status"],
        flags=tx_data["flags"],
    )
    session.add(transaction)
    message.card_hint = transaction.card_last4 or transaction.token_last4
    message.issuer_hint = transaction.issuer
    stats.transactions_created += 1
    return True


def _extract_transaction_data(email: dict, received_at: datetime) -> dict | None:
    extractor = _pick_extractor(email)
    if extractor is None:
        return None

    try:
        payload = extractor.extract(email)
    except Exception:  # pragma: no cover - defensive guard for custom plugins
        return None

    if not payload:
        return None

    merchant_raw = payload.get("merchant_raw", "")
    merchant_norm = payload.get("merchant_norm")
    if not merchant_norm and merchant_raw:
        merchant_norm = normalize_name(merchant_raw)

    purchased_at = _coerce_datetime(payload.get("purchased_at")) or received_at

    return {
        "merchant_raw": merchant_raw,
        "merchant_norm": merchant_norm,
        "amount_cents": int(payload.get("amount_cents", 0)),
        "currency": payload.get("currency", "JPY"),
        "purchased_at": purchased_at,
        "card_last4": payload.get("card_last4"),
        "token_last4": payload.get("token_last4"),
        "wallet_type": payload.get("wallet_type"),
        "product_hint": payload.get("product_hint"),
        "issuer": payload.get("issuer"),
        "status": payload.get("status", "confirmed"),
        "flags": payload.get("flags", {}),
    }


def extract_transaction_preview(email: dict, received_at: datetime | None = None) -> dict | None:
    """Public helper for preview-only extraction (no persistence)."""

    received = received_at or datetime.utcnow()
    return _extract_transaction_data(email, received)


def coerce_datetime(value: object) -> datetime | None:
    return _coerce_datetime(value)


def _pick_extractor(email: dict) -> object | None:
    best_score = 0.0
    best_extractor: object | None = None
    for extractor in EXTRACTORS:
        try:
            score = extractor.score(email)
        except Exception:  # pragma: no cover - extractor misconfiguration
            continue
        if score > best_score:
            best_score = score
            best_extractor = extractor
    if best_score < MIN_SCORE:
        return None
    return best_extractor


def _coerce_datetime(value: object) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str) and value:
        try:
            return dateparser.parse(value)
        except (ValueError, TypeError):
            return None
    return None
