from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class LicenseActivateRequest(BaseModel):
    key: str
    email: str | None = None


@router.post("/activate")
async def activate_license(payload: LicenseActivateRequest) -> dict[str, str]:
    if not payload.key:
        raise HTTPException(status_code=400, detail="License key required")

    # TODO: verify JWT signature
    return {"status": "ok", "plan": "lite"}
