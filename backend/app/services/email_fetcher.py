from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Iterable

from ..core.limits import DEFAULT_IMPORT_LIMIT
from ..services.imap_client import ImapClient


@dataclass
class FetchResult:
    messages: list[bytes]
    fetched_count: int
    errors: list[str]


class EmailFetcher:
    def __init__(self, host: str, username: str, password: str, ssl: bool = True) -> None:
        self.host = host
        self.username = username
        self.password = password
        self.ssl = ssl

    def fetch_recent(self, since: datetime, limit: int = DEFAULT_IMPORT_LIMIT) -> FetchResult:
        result = FetchResult(messages=[], fetched_count=0, errors=[])
        since_str = since.strftime("%d-%b-%Y")
        try:
            with ImapClient(self.host, self.username, self.password, ssl=self.ssl) as client:
                for idx, message in enumerate(client.fetch_since(since_str)):
                    if idx >= limit:
                        break
                    result.messages.append(message.raw)
                    result.fetched_count += 1
        except Exception as exc:  # pragma: no cover - network errors
            result.errors.append(str(exc))
        return result
