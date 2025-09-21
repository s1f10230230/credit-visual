from __future__ import annotations

from importlib import import_module
from pathlib import Path
from typing import List

from .base import Extractor

_PLUGINS_PATH = Path(__file__).parent / "plugins"


def load_extractors() -> List[Extractor]:
    extractors: List[Extractor] = []
    for file in _PLUGINS_PATH.glob("*.py"):
        if file.name.startswith("_"):
            continue
        module_name = f"app.services.extractor.plugins.{file.stem}"
        module = import_module(module_name)
        plugin = getattr(module, "plugin", None)
        if isinstance(plugin, Extractor):
            extractors.append(plugin)
    return extractors
