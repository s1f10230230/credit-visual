from typing import Generic, List, Optional, TypeVar

from pydantic import BaseModel

from ..api.schemas import ListMeta

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int = 1
    page_size: int
    next_page: Optional[int] = None
    prev_page: Optional[int] = None
    metadata: Optional[dict] = None
    meta: ListMeta = ListMeta()
