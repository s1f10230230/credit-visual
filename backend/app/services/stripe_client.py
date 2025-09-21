from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from ..core.config import settings

logger = logging.getLogger(__name__)

# Try to import Stripe, fallback to stub if not available
try:
    import stripe
    STRIPE_AVAILABLE = True
except ImportError:
    STRIPE_AVAILABLE = False
    logger.warning("Stripe library not available, using stub implementation")


@dataclass
class CheckoutSession:
    url: str
    plan: str
    email: str


class StripeClient:
    """Real Stripe client implementation with fallback to stub."""

    def __init__(self):
        if STRIPE_AVAILABLE and settings.STRIPE_SECRET_KEY:
            stripe.api_key = settings.STRIPE_SECRET_KEY
            self.real_stripe = True
            logger.info("Using real Stripe integration")
        else:
            self.real_stripe = False
            logger.info("Using stub Stripe implementation")

    def create_checkout_session(self, plan: str, email: str) -> CheckoutSession:
        if not self.real_stripe:
            return self._create_stub_session(plan, email)
        
        try:
            # Get price ID based on plan
            if plan == "lite":
                price_id = settings.STRIPE_PRICE_LITE
            elif plan == "pro":
                price_id = settings.STRIPE_PRICE_PRO
            else:
                raise ValueError(f"Unknown plan: {plan}")
            
            if not price_id:
                logger.warning(f"No Stripe price ID configured for plan {plan}, using stub")
                return self._create_stub_session(plan, email)

            # Create Stripe checkout session
            session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price': price_id,
                    'quantity': 1,
                }],
                mode='subscription',
                customer_email=email,
                success_url=settings.STRIPE_CHECKOUT_SUCCESS_URL or "https://example.com/success",
                cancel_url=settings.STRIPE_CHECKOUT_CANCEL_URL or "https://example.com/cancel",
                metadata={
                    'plan': plan,
                    'email': email,
                }
            )
            
            logger.info(f"Created Stripe checkout session {session.id} for {email} ({plan})")
            return CheckoutSession(url=session.url, plan=plan, email=email)
            
        except Exception as e:
            logger.error(f"Failed to create Stripe session: {e}")
            return self._create_stub_session(plan, email)

    def _create_stub_session(self, plan: str, email: str) -> CheckoutSession:
        """Fallback stub implementation."""
        success = settings.STRIPE_CHECKOUT_SUCCESS_URL or "https://example.com/success"
        cancel = settings.STRIPE_CHECKOUT_CANCEL_URL or "https://example.com/cancel"
        url = (
            "https://billing.example.com/checkout"
            f"?plan={plan}&email={email}&success_url={success}&cancel_url={cancel}"
        )
        return CheckoutSession(url=url, plan=plan, email=email)

    def verify_webhook_signature(self, payload: bytes, signature: str, endpoint_secret: str) -> bool:
        """Verify Stripe webhook signature."""
        if not self.real_stripe:
            return True  # Always pass in stub mode
        
        try:
            stripe.Webhook.construct_event(payload, signature, endpoint_secret)
            return True
        except Exception as e:
            logger.error(f"Webhook signature verification failed: {e}")
            return False


stripe_client = StripeClient()
