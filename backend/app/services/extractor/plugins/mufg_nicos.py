from __future__ import annotations

import re
from datetime import datetime

from ..base import Extractor
from ..common import extract_amount_yen, extract_card_last4, extract_date


class MUFGNicosExtractor:
    ISSUER = "mufg"

    def score(self, email: dict) -> float:
        subject = (email.get("subject") or "").lower()
        sender = (email.get("from") or "").lower()
        body = (email.get("body") or "").lower()

        score = 0.0
        if any(domain in sender for domain in ("mufg-card.com", "nicos.co.jp", "dc-card.com")):
            score += 0.6
        if "ご利用" in subject or "ご請求" in subject:
            score += 0.3
        if "mufg" in body or "ニコス" in body:
            score += 0.1
        return min(score, 1.0)

    def extract(self, email: dict) -> dict | None:
        body = email.get("body") or ""
        amount = extract_amount_yen(body)
        if amount is None:
            return None

        usage_date = self._extract_usage_date(body)
        merchant = self._extract_merchant(body)
        last4 = extract_card_last4(body)

        wallet_type = None
        token_last4 = None
        product_hint = None

        if "Apple Pay" in body or "アップルペイ" in body:
            wallet_type = "apple_pay"
        elif "Google Pay" in body or "グーグルペイ" in body:
            wallet_type = "google_pay"
        elif "iD" in body:
            product_hint = "iD"
        elif "QUICPay" in body:
            product_hint = "QUICPay"

        token_match = re.search(r"トークン末尾\s*(\d{4})", body)
        if token_match:
            token_last4 = token_match.group(1)

        payload = {
            "amount_cents": amount,
            "currency": "JPY",
            "merchant_raw": merchant or "MUFGカード ご利用",
            "purchased_at": usage_date or email.get("date") or datetime.utcnow(),
            "card_last4": last4,
            "token_last4": token_last4,
            "wallet_type": wallet_type,
            "product_hint": product_hint,
            "issuer": self.ISSUER,
            "status": "pending",
        }
        return payload

    def _extract_usage_date(self, text: str) -> datetime | None:
        patterns = [
            r"ご利用日[：:]*\s*([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日)",
            r"ご利用日[：:]*\s*([0-9]{4}/[0-9]{1,2}/[0-9]{1,2})",
            r"ご利用日時[：:]*\s*([0-9]{4}/[0-9]{1,2}/[0-9]{1,2})",
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                parsed = extract_date(match.group(1))
                if parsed:
                    return parsed
        return None

    def _extract_merchant(self, text: str) -> str | None:
        patterns = [
            r"ご利用先[：:]*\s*(.+)",
            r"ご利用店[：:]*\s*(.+)",
            r"ご利用内容[：:]*\s*(.+)",
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                merchant = match.group(1).strip()
                merchant = merchant.splitlines()[0].strip()
                if merchant:
                    return merchant
        return None


plugin: Extractor = MUFGNicosExtractor()
