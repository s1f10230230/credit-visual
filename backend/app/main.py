from fastapi import FastAPI

from .core.config import settings
from .api.routes import api_router
from .db.init_db import init_models
from .db.session import engine
from .services.scheduler import scheduler
# Ensure polling tasks are registered if enabled
from .services import polling  # noqa: F401
from .services import token_refresh  # noqa: F401
from .services import gmail_sync  # noqa: F401
from .services import alert_scheduler  # noqa: F401


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description="Subscan API",
    )

    @app.on_event("startup")
    async def on_startup() -> None:
        await init_models(engine)
        await scheduler.start()

    @app.on_event("shutdown")
    async def on_shutdown() -> None:
        await scheduler.shutdown()

    @app.get("/health", tags=["system"])
    async def health_check() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(api_router, prefix=settings.API_PREFIX)
    return app


app = create_app()
