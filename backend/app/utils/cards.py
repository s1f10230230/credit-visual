from __future__ import annotations

from typing import Any

from ..models import Transaction


def resolve_card_label(tx: Any, default: str = "その他") -> str:
    """Generate a display label for a transaction's payment instrument."""

    label = tx.card_last4
    if label:
        return label

    if tx.token_last4:
        label = tx.token_last4
        if tx.wallet_type:
            label = f"{tx.wallet_type.upper()}:{label}"
        return label

    flags: dict[str, Any] | None = tx.flags if isinstance(tx.flags, dict) else None
    if flags:
        flag_label = flags.get("card_label")
        if flag_label:
            return str(flag_label)

    if tx.wallet_type:
        return tx.wallet_type.upper()

    if tx.product_hint:
        return tx.product_hint

    if tx.issuer:
        return tx.issuer.upper()

    return default


def resolve_instrument_key(tx: Transaction) -> str:
    issuer = (tx.issuer or "UNKNOWN").upper()
    if tx.card_last4:
        return f"{issuer}|CARD|{tx.card_last4}"
    if tx.wallet_type and tx.token_last4:
        return f"{issuer}|{tx.wallet_type.upper()}|{tx.token_last4}"
    if tx.token_last4:
        return f"{issuer}|TOKEN|{tx.token_last4}"
    if tx.product_hint:
        return f"{issuer}|PRODUCT|{tx.product_hint.upper()}"
    return f"{issuer}|UNKNOWN"
