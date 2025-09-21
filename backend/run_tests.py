from __future__ import annotations

import importlib
import pkgutil
import sys
import traceback


def discover_test_modules(package: str) -> list[str]:
    modules = []
    for module_info in pkgutil.iter_modules([package.replace(".", "/")]):
        name = f"{package}.{module_info.name}"
        modules.append(name)
    return modules


def run_tests() -> int:
    failures = {}
    modules = discover_test_modules("tests")
    for module_name in modules:
        module = importlib.import_module(module_name)
        for attr_name in dir(module):
            if not attr_name.startswith("test_"):
                continue
            attr = getattr(module, attr_name)
            if callable(attr):
                try:
                    attr()
                except Exception as exc:  # pragma: no cover - we want to report failures
                    tb = traceback.format_exc()
                    failures.setdefault(module_name, []).append((attr_name, exc, tb))

    if failures:
        for module_name, items in failures.items():
            print(f"[FAIL] {module_name}")
            for func_name, exc, tb in items:
                print(f" - {func_name}: {exc}")
                print(tb)
        return 1

    print("All tests passed")
    return 0


if __name__ == "__main__":
    sys.exit(run_tests())
