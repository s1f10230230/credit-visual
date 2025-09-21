from __future__ import annotations

from datetime import datetime

from ..services.email_fetcher import EmailFetcher, FetchResult


def poll_mailbox(host: str, username: str, password: str, since: datetime) -> FetchResult:
    fetcher = EmailFetcher(host, username, password)
    return fetcher.fetch_recent(since)
