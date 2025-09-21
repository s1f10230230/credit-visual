from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_plan, PLAN_FREE, PLAN_LITE, PLAN_PRO, get_db_session
from ...core.config import settings
from ...services.users import ensure_user
from ...services.stripe_client import stripe_client

router = APIRouter()
logger = logging.getLogger(__name__)


class CheckoutRequest(BaseModel):
    plan: str  # "lite" or "pro"
    email: str


class CheckoutResponse(BaseModel):
    checkout_url: str


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout_session(request: CheckoutRequest, plan_header: str = Depends(get_plan)) -> CheckoutResponse:
    if plan_header == PLAN_FREE and request.plan not in {PLAN_LITE, PLAN_PRO}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid plan")

    session = stripe_client.create_checkout_session(request.plan, request.email)
    return CheckoutResponse(checkout_url=session.url)


@router.post("/webhook")
async def stripe_webhook(request: Request, session: AsyncSession = Depends(get_db_session)) -> dict[str, str]:
    """Handle Stripe webhook events."""
    
    # Get raw body and signature
    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")
    
    # Verify webhook signature if we have the secret
    if settings.STRIPE_WEBHOOK_SECRET and stripe_client.real_stripe:
        if not stripe_client.verify_webhook_signature(payload, signature, settings.STRIPE_WEBHOOK_SECRET):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature")
    
    try:
        # Parse webhook event
        event_data = json.loads(payload.decode())
        event_type = event_data.get("type")
        
        logger.info(f"Received Stripe webhook: {event_type}")
        
        # Handle checkout session completion
        if event_type == "checkout.session.completed":
            stripe_session = event_data["data"]["object"]
            customer_email = stripe_session.get("customer_email")
            metadata = stripe_session.get("metadata", {})
            plan = metadata.get("plan")
            
            if not customer_email or not plan:
                logger.warning("Missing email or plan in webhook metadata")
                return {"status": "ignored"}
            
            if plan not in {PLAN_LITE, PLAN_PRO}:
                logger.warning(f"Invalid plan in webhook: {plan}")
                return {"status": "ignored"}
            
            # Create or update user
            user_id = f"{plan}-{customer_email}"
            user = await ensure_user(session, user_id=user_id, email=customer_email, plan=plan)
            await session.commit()
            
            logger.info(f"Updated user {customer_email} to plan {plan}")
            return {"status": "ok", "plan": user.plan}
        
        # Handle subscription updates
        elif event_type in ["customer.subscription.updated", "customer.subscription.deleted"]:
            subscription = event_data["data"]["object"]
            customer_id = subscription.get("customer")
            status_str = subscription.get("status")
            
            # In a real implementation, you'd look up the customer and update their plan
            logger.info(f"Subscription {customer_id} status: {status_str}")
            return {"status": "ok"}
        
        else:
            logger.info(f"Ignoring webhook event type: {event_type}")
            return {"status": "ignored"}
            
    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Webhook processing failed")
