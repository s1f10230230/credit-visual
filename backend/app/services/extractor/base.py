from __future__ import annotations

from typing import Protocol, runtime_checkable


@runtime_checkable
class Extractor(Protocol):
    def score(self, email: dict) -> float:
        ...

    def extract(self, email: dict) -> dict | None:
        ...
