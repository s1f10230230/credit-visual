from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from statistics import median
from typing import Iterable

from rapidfuzz import fuzz

from ...models import Transaction


@dataclass
class SubscriptionCandidate:
    merchant_norm: str
    cadence: str
    amount_cents_min: int
    amount_cents_max: int
    card_last4: str | None
    first_seen: date
    last_seen: date
    confidence: float
    signals: dict


def detect_subscriptions(transactions: Iterable[Transaction]) -> list[SubscriptionCandidate]:
    groups: dict[tuple[str, str | None, str | None], list[Transaction]] = defaultdict(list)
    for tx in transactions:
        merchant = tx.merchant_norm or tx.merchant_raw
        key = (merchant, tx.card_last4 or tx.token_last4, tx.wallet_type or tx.product_hint)
        groups[key].append(tx)

    results: list[SubscriptionCandidate] = []
    for (merchant, card_key, wallet_hint), txs in groups.items():
        txs.sort(key=lambda t: t.purchased_at)
        positive_txs = [tx for tx in txs if tx.amount_cents > 0]
        if len(positive_txs) < 3:
            continue

        amounts = [tx.amount_cents for tx in positive_txs]
        dates = [tx.purchased_at.date() for tx in positive_txs]
        deltas = [
            (dates[idx + 1] - dates[idx]).days
            for idx in range(len(dates) - 1)
        ]

        periodicity_score = _calculate_periodicity_score(deltas)
        stability_score = _calculate_amount_stability(amounts)
        vocab_score = _vocab_signal(merchant)

        confidence = 0.5 * periodicity_score + 0.3 * stability_score + 0.2 * vocab_score
        if confidence < 0.5:
            continue

        cadence = _pick_cadence(deltas)
        signals = {
            "periodicity": periodicity_score,
            "stability": stability_score,
            "vocab": vocab_score,
            "token_last4": positive_txs[0].token_last4,
            "wallet_type": positive_txs[0].wallet_type,
            "product_hint": positive_txs[0].product_hint,
            "period_histogram": _period_histogram(deltas),
            "amount_min": min(amounts),
            "amount_max": max(amounts),
            "transactions": len(positive_txs),
        }

        results.append(
            SubscriptionCandidate(
                merchant_norm=merchant,
                cadence=cadence,
                amount_cents_min=min(amounts),
                amount_cents_max=max(amounts),
                card_last4=positive_txs[0].card_last4,
                first_seen=min(dates),
                last_seen=max(dates),
                confidence=round(confidence, 2),
                signals=signals,
            )
        )

    return results


def _calculate_periodicity_score(deltas: list[int]) -> float:
    if not deltas:
        return 0.0
    windows = {
        "weekly": (7 - 1, 7 + 1),
        "monthly": (30 - 3, 30 + 3),
        "yearly": (365 - 7, 365 + 7),
    }
    counts = {name: 0 for name in windows}
    for delta in deltas:
        for name, (low, high) in windows.items():
            if low <= delta <= high:
                counts[name] += 1
    best_count = max(counts.values()) if counts else 0
    return min(1.0, best_count / max(1, len(deltas)))


def _period_histogram(deltas: list[int]) -> dict[str, int]:
    buckets = {
        "weekly": 0,
        "monthly": 0,
        "yearly": 0,
        "other": 0,
    }
    for delta in deltas:
        if 6 <= delta <= 8:
            buckets["weekly"] += 1
        elif 27 <= delta <= 33:
            buckets["monthly"] += 1
        elif 358 <= delta <= 372:
            buckets["yearly"] += 1
        else:
            buckets["other"] += 1
    return buckets


def _calculate_amount_stability(amounts: list[int]) -> float:
    if not amounts:
        return 0.0
    med = median(amounts)
    if med == 0:
        return 0.0
    within = sum(1 for amt in amounts if abs(amt - med) / med <= 0.1)
    return within / len(amounts)


def _vocab_signal(merchant: str) -> float:
    keywords = ["subscription", "サブス", "会費", "月額", "定期"]
    normalized = merchant.lower()
    for kw in keywords:
        if kw in normalized:
            return 1.0
    scores = [fuzz.partial_ratio(normalized, kw) for kw in keywords]
    best = max(scores) if scores else 0
    return best / 100


def _pick_cadence(deltas: list[int]) -> str:
    if not deltas:
        return "unknown"
    avg = sum(deltas) / len(deltas)
    if 24 <= avg <= 36:
        return "monthly"
    if 6 <= avg <= 8:
        return "weekly"
    if 350 <= avg <= 380:
        return "yearly"
    return "irregular"
