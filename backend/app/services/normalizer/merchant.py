import re
from typing import Optional

from rapidfuzz import fuzz


def normalize_name(raw: str) -> str:
    name = raw.strip().lower()
    name = re.sub(r"[\*\#\|\(\)]", " ", name)
    name = re.sub(r"\s+", " ", name)
    return name.strip()


def pick_display_name(candidates: list[str]) -> Optional[str]:
    if not candidates:
        return None
    shortest = min(candidates, key=len)
    return shortest


def fuzzy_match(candidate: str, existing: list[str], threshold: int = 85) -> Optional[str]:
    for name in existing:
        if fuzz.ratio(candidate, name) >= threshold:
            return name
    return None
