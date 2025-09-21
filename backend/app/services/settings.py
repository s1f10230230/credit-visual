from __future__ import annotations

from pydantic import BaseModel


class RetentionSettings(BaseModel):
    store_raw_messages: bool = False


class RetentionUpdate(BaseModel):
    store_raw_messages: bool | None = None


# For Phase 1 we keep this simple and in-memory.
_RETENTION = RetentionSettings()


def get_retention() -> RetentionSettings:
    return _RETENTION


def update_retention(store_raw_messages: bool | None = None) -> RetentionSettings:
    if store_raw_messages is not None:
        _RETENTION.store_raw_messages = bool(store_raw_messages)
    return _RETENTION
