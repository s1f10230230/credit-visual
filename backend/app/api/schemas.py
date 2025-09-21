from pydantic import BaseModel


class ListMeta(BaseModel):
    locked_count: int = 0
    truncated: bool = False
