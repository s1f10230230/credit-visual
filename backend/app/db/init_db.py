import asyncio

from sqlalchemy.ext.asyncio import AsyncEngine

from .session import engine
from ..models import Base


async def init_models(bind: AsyncEngine) -> None:
    async with bind.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


def init_db() -> None:
    asyncio.run(init_models(engine))
