from __future__ import annotations

import re
from datetime import datetime

from ..base import Extractor
from ..common import extract_amount_yen, extract_date


class RakutenSummaryExtractor:
    def score(self, email: dict) -> float:
        subject = email.get("subject", "")
        sender = email.get("from", "")
        if "rakuten" in sender.lower() and "速報" in subject:
            return 0.9
        return 0.0

    def extract(self, email: dict) -> dict | None:
        body: str = email.get("body", "")
        amount = extract_amount_yen(body)
        if amount is None:
            return None

        date_match = re.search(r"ご利用日\s*([0-9]{4}[/-][0-9]{1,2}[/-][0-9]{1,2})", body)
        purchased_at = None
        if date_match:
            purchased_at = extract_date(date_match.group(1))
        if purchased_at is None:
            purchased_at = datetime.utcnow()

        payload = {
            "amount_cents": amount,
            "currency": "JPY",
            "merchant_raw": "楽天カード 速報",
            "purchased_at": purchased_at,
            "card_last4": None,
            "issuer": "rakuten",
            "status": "pending",
        }
        body = email.get("body", "")
        token_match = re.search(r"トークン末尾\s*(\d{4})", body)
        if token_match:
            payload["token_last4"] = token_match.group(1)
        if "Apple Pay" in body:
            payload["wallet_type"] = "apple_pay"
        elif "Google Pay" in body:
            payload["wallet_type"] = "google_pay"
        elif "QUICPay" in body:
            payload["product_hint"] = "QUICPay"
        elif "iD" in body:
            payload["product_hint"] = "iD"

        return payload


plugin: Extractor = RakutenSummaryExtractor()
