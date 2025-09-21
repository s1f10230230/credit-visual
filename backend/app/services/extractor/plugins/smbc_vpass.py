from __future__ import annotations

import re
from datetime import datetime

from ..base import Extractor
from ..common import extract_amount_yen, extract_card_last4, extract_date


class SMBCVpassExtractor:
    ISSUER = "smbc"

    def score(self, email: dict) -> float:
        subject = (email.get("subject") or "").lower()
        sender = (email.get("from") or "").lower()
        body = (email.get("body") or "").lower()

        score = 0.0
        if any(hint in sender for hint in ("vpass.ne.jp", "smbc-card")):
            score += 0.5
        if "ご利用" in subject and "カード" in subject:
            score += 0.3
        if "vpass" in body or "三井住友" in body:
            score += 0.2
        return min(score, 1.0)

    def extract(self, email: dict) -> dict | None:
        body = email.get("body") or ""
        amount = extract_amount_yen(body)
        if amount is None:
            return None

        usage_date = self._extract_usage_date(body)
        merchant = self._extract_merchant(body)
        last4 = extract_card_last4(body)

        flags: dict[str, object] = {}
        wallet_type = None
        token_last4 = None

        if "ナンバーレス" in body and last4 is None:
            flags["numberless"] = True
            flags["card_label"] = "SMBCナンバーレス"

        if "アップルペイ" in body or "Apple Pay" in body:
            wallet_type = "apple_pay"
        elif "グーグルペイ" in body or "Google Pay" in body:
            wallet_type = "google_pay"

        token_match = re.search(r"\bトークン末尾\s*(\d{4})\b", body)
        if token_match:
            token_last4 = token_match.group(1)
            flags.setdefault("token_label", f"トークン: {token_last4}")

        fallback_date = usage_date
        if fallback_date is None:
            email_date = email.get("date")
            fallback_date = extract_date(email_date) if isinstance(email_date, str) else None
        if fallback_date is None:
            fallback_date = datetime.utcnow()

        payload = {
            "amount_cents": amount,
            "currency": "JPY",
            "merchant_raw": merchant or "三井住友カード ご利用",
            "purchased_at": fallback_date,
            "card_last4": last4,
            "token_last4": token_last4,
            "wallet_type": wallet_type,
            "issuer": self.ISSUER,
            "status": "pending",
        }
        if flags:
            payload["flags"] = flags
        return payload

    def _extract_usage_date(self, text: str) -> datetime | None:
        patterns = [
            r"ご利用日[：:]*\s*([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日)",
            r"ご利用日[：:]*\s*([0-9]{4}/[0-9]{1,2}/[0-9]{1,2})",
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                parsed = extract_date(match.group(1))
                if parsed:
                    return parsed
        return None

    def _extract_merchant(self, text: str) -> str | None:
        match = re.search(r"ご利用先[：:]*\s*(.+)", text)
        if match:
            merchant = match.group(1).strip()
            merchant = merchant.splitlines()[0].strip()
            return merchant
        return None


plugin: Extractor = SMBCVpassExtractor()
