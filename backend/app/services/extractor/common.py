from __future__ import annotations

import re
from datetime import datetime
from email.message import Message
from typing import Optional

try:
    import mailparser
except ImportError:  # pragma: no cover - optional dependency for tests
    mailparser = None  # type: ignore

try:
    from dateutil import parser as dateparser
except ImportError:  # pragma: no cover - fallback when dateutil unavailable
    dateparser = None  # type: ignore


def parse_eml(content: bytes) -> dict:
    if mailparser is None:  # pragma: no cover - defensive for install-less envs
        raise ImportError("mailparser is required to parse eml content")

    parsed = mailparser.parse_from_bytes(content)
    body = parsed.body or ""
    return {
        "message_id": parsed.message_id,
        "from": parsed.from_[0][1] if parsed.from_ else "",
        "subject": parsed.subject or "",
        "date": parsed.date.isoformat() if parsed.date else None,
        "body": body,
        "headers": dict(parsed.headers)
    }


def extract_amount_yen(body: str) -> Optional[int]:
    match = re.search(r"([¥\\u00a5]?)([0-9,]+)\s*円", body)
    if not match:
        return None
    amount = int(match.group(2).replace(",", ""))
    return amount * 100


def extract_date(text: str) -> Optional[datetime]:
    if dateparser is not None:
        try:
            return dateparser.parse(text, fuzzy=True)
        except (ValueError, TypeError):
            return None

    normalized = text.strip()
    normalized = normalized.replace("年", "-").replace("月", "-").replace("日", "")
    normalized = normalized.replace("/", "-")
    normalized = normalized.replace(".", "-")
    parts = normalized.split("-")
    parts = [p for p in parts if p]
    if len(parts) < 3:
        return None
    try:
        year, month, day = (int(parts[0]), int(parts[1]), int(parts[2]))
        return datetime(year, month, day)
    except ValueError:
        return None


def extract_card_last4(text: str) -> Optional[str]:
    patterns = [
        r"下4桁\s*(\d{4})",
        r"末尾\s*(\d{4})",
        r"[*＊]{4}\s*(\d{4})",
        r"X{4}\s*(\d{4})",
        r"カード番号[^\d]*(\d{4})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    return None
