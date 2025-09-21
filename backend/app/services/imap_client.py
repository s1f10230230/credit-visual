from __future__ import annotations

import email
import imaplib
from dataclasses import dataclass
from typing import Iterable, Iterator


@dataclass
class ImapMessage:
    raw: bytes
    uid: str
    flags: tuple[str, ...]


class ImapClient:
    def __init__(self, host: str, username: str, password: str, ssl: bool = True) -> None:
        self.host = host
        self.username = username
        self.password = password
        self.ssl = ssl
        self._conn: imaplib.IMAP4 | imaplib.IMAP4_SSL | None = None

    def __enter__(self) -> "ImapClient":
        self.connect()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.logout()

    def connect(self) -> None:
        if self.ssl:
            self._conn = imaplib.IMAP4_SSL(self.host)
        else:
            self._conn = imaplib.IMAP4(self.host)
        self._conn.login(self.username, self.password)

    def logout(self) -> None:
        if self._conn is not None:
            try:
                self._conn.logout()
            finally:
                self._conn = None

    def _require_conn(self) -> imaplib.IMAP4 | imaplib.IMAP4_SSL:
        if self._conn is None:
            raise RuntimeError("IMAP client not connected")
        return self._conn

    def select_mailbox(self, mailbox: str = "INBOX") -> None:
        conn = self._require_conn()
        conn.select(mailbox)

    def fetch_since(self, since: str, mailbox: str = "INBOX") -> Iterator[ImapMessage]:
        """Yield messages since the given date string (e.g., '01-Jan-2024')."""

        conn = self._require_conn()
        conn.select(mailbox)
        typ, data = conn.search(None, f"SINCE {since}")
        if typ != "OK":
            return
        for num in data[0].split():
            typ, msg_data = conn.fetch(num, "(RFC822 FLAGS UID)")
            if typ != "OK" or not msg_data:
                continue
            raw = msg_data[0][1]
            flags = tuple()
            uid = num.decode()
            yield ImapMessage(raw=raw, uid=uid, flags=flags)
