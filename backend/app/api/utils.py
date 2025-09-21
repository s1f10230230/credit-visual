from __future__ import annotations

from collections.abc import Sequence
from typing import TypeVar

from ..core.limits import FREE_VISIBLE_RESULTS
from .schemas import ListMeta
from .deps import PLAN_FREE

T = TypeVar("T")


def is_free_plan(plan: str) -> bool:
    return plan == PLAN_FREE


def apply_visibility_limit(items: Sequence[T], plan: str, limit: int | None = None) -> tuple[list[T], ListMeta]:
    if not items:
        return [], ListMeta()

    if not is_free_plan(plan):
        return list(items), ListMeta()

    visible_limit = limit if limit is not None else FREE_VISIBLE_RESULTS
    visible_items = list(items)[:visible_limit]
    locked = max(0, len(items) - len(visible_items))
    return visible_items, ListMeta(locked_count=locked, truncated=locked > 0)
