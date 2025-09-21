# Stripe Integration (Future Work)

Due to current network restrictions, Stripe SDK calls are stubbed. Once network access is available:

1. **Install Stripe SDK**
   ```bash
   pip install stripe
   ```

2. **Environment**
   - STRIPE_SECRET
   - STRIPE_WEBHOOK_SECRET
   - STRIPE_PRICE_LITE / STRIPE_PRICE_PRO
   - STRIPE_CHECKOUT_SUCCESS_URL / STRIPE_CHECKOUT_CANCEL_URL

3. **Checkout Session**
   ```python
   import stripe
   stripe.api_key = settings.STRIPE_SECRET
   stripe.checkout.Session.create(
       customer_email=request.email,
       success_url=settings.STRIPE_CHECKOUT_SUCCESS_URL,
       cancel_url=settings.STRIPE_CHECKOUT_CANCEL_URL,
       mode="subscription",
       line_items=[{"price": price_id, "quantity": 1}],
   )
   ```

4. **Webhook**
   ```python
   event = stripe.Webhook.construct_event(
       payload=request.body(),
       sig_header=request.headers.get("Stripe-Signature"),
       secret=settings.STRIPE_WEBHOOK_SECRET,
   )
   ```
   Handle `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`.

5. **Plan updates**
   - Map stripe customer/subscription IDs to internal users.
   - Update plan in `User` table accordingly.

