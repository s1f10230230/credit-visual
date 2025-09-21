"""Extractor plugin registry."""

from typing import Protocol


class Extractor(Protocol):
    def score(self, email: dict) -> float:
        ...

    def extract(self, email: dict) -> dict | None:
        ...


def load_extractors() -> list[Extractor]:
    # TODO: dynamically load plugins
    return []
