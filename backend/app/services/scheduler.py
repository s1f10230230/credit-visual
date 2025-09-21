from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Awaitable, Callable, Dict, List


Callback = Callable[[], Awaitable[None]]


@dataclass
class ScheduledTask:
    name: str
    interval: float
    callback: Callback


class BackgroundScheduler:
    def __init__(self) -> None:
        self._tasks: List[ScheduledTask] = []
        self._handles: Dict[str, asyncio.Task] = {}
        self._running = False
        self._lock = asyncio.Lock()

    def add_interval_task(self, name: str, interval: float, callback: Callback) -> None:
        self._tasks.append(ScheduledTask(name=name, interval=interval, callback=callback))

    async def start(self) -> None:
        async with self._lock:
            if self._running:
                return
            self._running = True
            for registered in self._tasks:
                self._handles[registered.name] = asyncio.create_task(self._runner(registered))

    async def shutdown(self) -> None:
        async with self._lock:
            if not self._running:
                return
            self._running = False
            for task in list(self._handles.values()):
                task.cancel()
            self._handles.clear()

    async def _runner(self, task: ScheduledTask) -> None:
        while self._running:
            try:
                await task.callback()
            except asyncio.CancelledError:
                break
            except Exception as exc:  # pragma: no cover - background logging
                print(f"[scheduler] task {task.name} error: {exc}")
            await asyncio.sleep(task.interval)


scheduler = BackgroundScheduler()
