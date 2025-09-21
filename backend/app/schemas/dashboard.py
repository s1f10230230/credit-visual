from typing import List

from pydantic import BaseModel

from ..api.schemas import ListMeta
from .transaction import TransactionSummary


class DashboardSummary(BaseModel):
    month: str
    total_amount_cents: int
    cards: List[TransactionSummary]
    meta: ListMeta | None = None
