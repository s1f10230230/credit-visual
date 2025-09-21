from __future__ import annotations

from collections import defaultdict
from datetime import datetime, time
from typing import Dict, Iterable, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Subscription, Transaction
from ..utils.cards import resolve_card_label, resolve_instrument_key


def _month_range(target_month: datetime) -> tuple[datetime, datetime]:
    start = target_month.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    return start, end


async def fetch_card_summaries(
    session: AsyncSession,
    user_id: str,
    target_month: datetime,
) -> list[dict]:
    start_dt, end_dt = _month_range(target_month)

    stmt = select(Transaction).where(
        Transaction.user_id == user_id,
        Transaction.purchased_at >= start_dt,
        Transaction.purchased_at < end_dt,
    )
    transactions = (await session.execute(stmt)).scalars().all()

    subs_stmt = select(Subscription).where(Subscription.user_id == user_id)
    subscriptions = (await session.execute(subs_stmt)).scalars().all()
    subscription_merchants = {sub.merchant_norm for sub in subscriptions if sub.merchant_norm}

    grouped: Dict[str, dict] = {}
    for tx in transactions:
        key = resolve_instrument_key(tx)
        group = grouped.get(key)
        if not group:
            group = {
                "instrument_key": key,
                "issuer": tx.issuer or "UNKNOWN",
                "label": resolve_card_label(tx),
                "card_last4": tx.card_last4,
                "token_last4": tx.token_last4,
                "wallet_type": tx.wallet_type,
                "total_amount_cents": 0,
                "transaction_count": 0,
                "subscription_merchants": set(),
                "merchant_totals": defaultdict(lambda: {"amount": 0, "count": 0}),
            }
            grouped[key] = group

        group["total_amount_cents"] += tx.amount_cents
        group["transaction_count"] += 1

        merchant_name = tx.merchant_norm or tx.merchant_raw
        merchant_entry = group["merchant_totals"][merchant_name]
        merchant_entry["amount"] += tx.amount_cents
        merchant_entry["count"] += 1

        if tx.merchant_norm and tx.merchant_norm in subscription_merchants:
            group["subscription_merchants"].add(tx.merchant_norm)

    summaries: List[dict] = []
    for data in grouped.values():
        merchant_totals = data.pop("merchant_totals")
        top_merchants = [
            {
                "name": name,
                "amount_cents": entry["amount"],
                "transaction_count": entry["count"],
            }
            for name, entry in sorted(
                merchant_totals.items(), key=lambda item: item[1]["amount"], reverse=True
            )[:5]
        ]
        data["subscription_count"] = len(data.pop("subscription_merchants"))
        data["top_merchants"] = top_merchants
        summaries.append(data)

    summaries.sort(key=lambda item: item["total_amount_cents"], reverse=True)
    return summaries


async def fetch_card_transactions(
    session: AsyncSession,
    user_id: str,
    instrument_key: str,
    target_month: datetime,
    only_subs: bool = False,
) -> list[Transaction]:
    start_dt, end_dt = _month_range(target_month)

    stmt = select(Transaction).where(
        Transaction.user_id == user_id,
        Transaction.purchased_at >= start_dt,
        Transaction.purchased_at < end_dt,
    )
    transactions = (await session.execute(stmt)).scalars().all()

    if only_subs:
        subs_stmt = select(Subscription).where(Subscription.user_id == user_id)
        subscriptions = (await session.execute(subs_stmt)).scalars().all()
        subscription_merchants = {sub.merchant_norm for sub in subscriptions if sub.merchant_norm}
    else:
        subscription_merchants = None

    filtered: list[Transaction] = []
    for tx in transactions:
        if resolve_instrument_key(tx) != instrument_key:
            continue
        if subscription_merchants is not None and (
            not tx.merchant_norm or tx.merchant_norm not in subscription_merchants
        ):
            continue
        filtered.append(tx)

    filtered.sort(key=lambda tx: tx.purchased_at, reverse=True)
    return filtered
