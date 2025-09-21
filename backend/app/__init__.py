from __future__ import annotations


def create_app():  # type: ignore[override]
    from .main import create_app as _create_app

    return _create_app()


__all__ = ["create_app"]
