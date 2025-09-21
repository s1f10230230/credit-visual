from __future__ import annotations

from datetime import datetime

from app.utils.cards import resolve_card_label


class DummyTransaction:
    def __init__(self, **kwargs):
        defaults = {
            "card_last4": None,
            "token_last4": None,
            "wallet_type": None,
            "product_hint": None,
            "issuer": None,
            "flags": {},
        }
        defaults.update(kwargs)
        for key, value in defaults.items():
            setattr(self, key, value)


def _transaction(**kwargs):
    return DummyTransaction(**kwargs)


def test_card_label_prefers_last4():
    tx = _transaction(card_last4="1234")
    assert resolve_card_label(tx) == "1234"


def test_card_label_uses_token_last4_with_wallet():
    tx = _transaction(card_last4=None, token_last4="5678", wallet_type="apple_pay")
    assert resolve_card_label(tx) == "APPLE_PAY:5678"


def test_card_label_uses_token_last4_without_wallet():
    tx = _transaction(card_last4=None, token_last4="9876")
    assert resolve_card_label(tx) == "9876"


def test_card_label_uses_flag_label_when_no_last4():
    tx = _transaction(flags={"card_label": "SMBCナンバーレス"})
    assert resolve_card_label(tx) == "SMBCナンバーレス"


def test_card_label_falls_back_to_issuer():
    tx = _transaction(issuer="epos")
    assert resolve_card_label(tx) == "EPOS"


def test_card_label_uses_product_hint_before_other():
    tx = _transaction(product_hint="d払い")
    assert resolve_card_label(tx) == "d払い"


def test_card_label_defaults_to_other():
    tx = _transaction()
    assert resolve_card_label(tx) == "その他"
