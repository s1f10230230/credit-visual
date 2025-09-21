from fastapi import APIRouter

from . import (
    dashboard,
    imports,
    subscriptions,
    licenses,
    transactions,
    export,
    settings,
    admin,
    billing,
    alerts,
    auth,
    cards,
)

api_router = APIRouter()
api_router.include_router(imports.router, prefix="/import", tags=["import"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(subscriptions.router, prefix="/subscriptions", tags=["subscriptions"])
api_router.include_router(licenses.router, prefix="/license", tags=["license"])
api_router.include_router(transactions.router, prefix="/transactions", tags=["transactions"])
api_router.include_router(export.router, prefix="/export", tags=["export"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(billing.router, prefix="/billing", tags=["billing"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(cards.router, prefix="/cards", tags=["cards"])
