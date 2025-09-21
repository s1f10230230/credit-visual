from __future__ import annotations

from datetime import date
from pathlib import Path

from app.services.extractor.common import extract_card_last4
from app.services.extractor.plugins.epos_usage import plugin as epos_plugin
from app.services.extractor.plugins.mufg_nicos import plugin as mufg_plugin
from app.services.extractor.plugins.rakuten_summary import plugin as rakuten_plugin
from app.services.extractor.plugins.smbc_vpass import plugin as smbc_plugin


FIXTURE_DIR = Path(__file__).parent / "fixtures" / "extractors"


def read_fixture(name: str) -> str:
    return (FIXTURE_DIR / name).read_text(encoding="utf-8")


def _email(subject: str, body: str, sender: str = "noreply@example.com") -> dict:
    return {
        "subject": subject,
        "body": body,
        "from": sender,
        "date": "2024-03-01T10:00:00Z",
    }


def test_rakuten_summary_extractor_parses_usage() -> None:
    cases = [
        (read_fixture("rakuten_1.txt"), "【速報】カード利用のお知らせ"),
        (read_fixture("rakuten_2.txt"), "[速報] カード利用のお知らせ"),
    ]
    for body, subject in cases:
        email = _email(subject, body, "info@rakuten-card.co.jp")

        assert rakuten_plugin.score(email) >= 0.8

        payload = rakuten_plugin.extract(email)
        assert payload is not None
        assert payload["amount_cents"] in {1_234_500, 999_900}
        assert payload["issuer"] == "rakuten"
        assert payload["status"] == "pending"
        assert payload.get("wallet_type") in {None, "apple_pay", "google_pay"}


def test_smbc_vpass_extractor_returns_merchant_and_last4():
    body = read_fixture("smbc_vpass.txt")
    email = _email(
        "【Ｖｐａｓｓ】カードご利用のお知らせ",
        body,
        "notice@vpass.ne.jp",
    )

    assert smbc_plugin.score(email) >= 0.8

    payload = smbc_plugin.extract(email)
    assert payload is not None
    assert payload["amount_cents"] == 4_567_800
    assert payload["merchant_raw"] == "AMAZON.CO.JP"
    assert payload["card_last4"] == "9876"
    assert payload["issuer"] == "smbc"
    assert payload["purchased_at"].date() == date(2024, 3, 5)
    assert payload.get("flags", {}).get("numberless") is None


def test_smbc_vpass_numberless_infers_flag_when_no_digits():
    body = read_fixture("smbc_vpass_numberless.txt")
    email = _email(
        "【Ｖｐａｓｓ】カードご利用のお知らせ",
        body,
        "notice@vpass.ne.jp",
    )

    payload = smbc_plugin.extract(email)
    assert payload is not None
    assert payload["card_last4"] is None
    assert payload.get("flags", {}).get("numberless") is True
    assert payload.get("flags", {}).get("card_label") == "SMBCナンバーレス"


def test_epos_usage_extractor_handles_alt_labels():
    body = read_fixture("epos_usage.txt")
    email = _email(
        "エポスカード ご利用のお知らせ",
        body,
        "alert@01epos.jp",
    )

    assert epos_plugin.score(email) >= 0.9

    payload = epos_plugin.extract(email)
    assert payload is not None
    assert payload["amount_cents"] == 890_000
    assert payload["merchant_raw"] == "ヨドバシカメラ"
    assert payload["card_last4"] == "4321"
    assert payload["issuer"] == "epos"
    assert payload["purchased_at"].date() == date(2024, 2, 10)
    assert payload.get("wallet_type") in {None, "apple_pay", "google_pay"}


def test_extract_card_last4_captures_multiple_formats() -> None:
    cases = [
        ("カード番号　下4桁 1111", "1111"),
        ("末尾 2222", "2222"),
        ("**** 3333", "3333"),
        ("＊＊＊＊ 4444", "4444"),
        ("XXXX 5555", "5555"),
    ]
    for text, expected in cases:
        assert extract_card_last4(text) == expected


def test_extract_card_last4_returns_none_for_missing_pattern() -> None:
    assert extract_card_last4("番号は伏せています") is None


def test_mufg_nicos_extractor_reads_basic_notice():
    body = read_fixture("mufg_nicos.txt")
    email = _email(
        "【MUFGカード】ご利用のお知らせ",
        body,
        "notice@mufg-card.com",
    )

    assert mufg_plugin.score(email) >= 0.8

    payload = mufg_plugin.extract(email)
    assert payload is not None
    assert payload["amount_cents"] == 2_345_600
    assert payload["merchant_raw"] == "ANA SKY SHOP"
    assert payload["card_last4"] == "6543"
    assert payload["issuer"] == "mufg"
    assert payload["purchased_at"].date() == date(2024, 1, 15)
    assert payload.get("wallet_type") in {None, "apple_pay", "google_pay"}


def test_extractors_return_none_when_amount_missing() -> None:
    email = _email(
        "エポスカード ご利用のお知らせ",
        "ご利用店舗：テストショップ\n下4桁 9999",
        "alert@01epos.jp",
    )

    assert epos_plugin.extract(email) is None


def test_score_low_for_unrelated_mail() -> None:
    email = _email("ニュースレター", "これは広告です", "news@example.com")
    assert rakuten_plugin.score(email) == 0
    assert smbc_plugin.score(email) == 0
    assert epos_plugin.score(email) == 0
FIXTURE_DIR = Path(__file__).parent / "fixtures" / "extractors"


def read_fixture(name: str) -> str:
    return (FIXTURE_DIR / name).read_text(encoding="utf-8")
