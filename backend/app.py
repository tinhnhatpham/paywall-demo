"""Paywall backend: starts Stripe Checkout / Billing Portal sessions and receives Stripe webhooks.

The browser never tells us who has paid. Stripe does, through signed webhooks, and we store the
result in Supabase. The members-only content is then protected by Row Level Security in the
database (see ../supabase/schema.sql), not just hidden in React.

Run locally: python app.py
"""
import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

load_dotenv()

import stripe  # noqa: E402
from supabase import create_client  # noqa: E402

stripe.api_key = os.environ["STRIPE_SECRET_KEY"]
if stripe.api_key.startswith(("sk_live", "rk_live")) and os.getenv("ALLOW_LIVE_STRIPE") != "yes":
    # This is a portfolio demo: refuse to take real money by accident
    raise RuntimeError("Live Stripe key detected. Use test-mode keys (sk_test_...) for this demo.")

PRICE_ID = os.environ["STRIPE_PRICE_ID"]
WEBHOOK_SECRET = os.environ["STRIPE_WEBHOOK_SECRET"]
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
ACTIVE_STATUSES = ("active", "trialing")

db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SECRET_KEY"])

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 64 * 1024
# The website can be reached at several addresses: FRONTEND_URL, the demo's own public address
# and any listed in ALLOWED_ORIGINS (comma-separated, e.g. the old netlify.app link)
SITE_ORIGIN = "https://members.logicagentry.com"
SITE_ORIGINS = list(dict.fromkeys(
    [FRONTEND_URL, SITE_ORIGIN] + [o.strip().rstrip("/") for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
))
CORS(app, origins=SITE_ORIGINS)


# ---------- helpers ----------

def current_user():
    """The signed-in Supabase user from the 'Authorization: Bearer <token>' header, or None."""
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    try:
        return db.auth.get_user(header.removeprefix("Bearer ")).user
    except Exception:
        return None


def site_url() -> str:
    """Where Stripe should send the visitor back: the address they're using, if it's one of ours.

    Logins are stored per address, so returning someone to a different address would log them out.
    """
    origin = (request.headers.get("Origin") or "").rstrip("/")
    return origin if origin in SITE_ORIGINS else FRONTEND_URL


def get_subscription_row(user_id: str):
    rows = db.table("subscriptions").select("*").eq("user_id", user_id).limit(1).execute().data
    return rows[0] if rows else None


def get_or_create_customer(user) -> str:
    row = get_subscription_row(user.id)
    if row and row.get("stripe_customer_id"):
        return row["stripe_customer_id"]
    customer = stripe.Customer.create(
        email=user.email,
        metadata={"user_id": user.id},
        idempotency_key=f"customer-{user.id}",  # a double click can't create two customers
    )
    db.table("subscriptions").upsert({"user_id": user.id, "stripe_customer_id": customer.id}).execute()
    return customer.id


def get_user_exists(user_id: str) -> bool:
    try:
        return db.auth.admin.get_user_by_id(user_id).user is not None
    except Exception:
        return False


def to_iso(timestamp):
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat() if timestamp else None


def sync_subscription(subscription_id: str) -> None:
    """Copy a subscription's current state from Stripe into the database.

    We re-fetch from Stripe instead of trusting the event body, because webhook events can arrive
    out of order; the fresh copy is always the latest state.
    """
    sub = stripe.Subscription.retrieve(subscription_id).to_dict()
    user_id = (sub.get("metadata") or {}).get("user_id")
    if not user_id:
        rows = db.table("subscriptions").select("user_id").eq("stripe_customer_id", sub["customer"]).limit(1).execute().data
        user_id = rows[0]["user_id"] if rows else None
    if not user_id:
        app.logger.warning(f"No user for subscription {subscription_id}")
        return

    existing = get_subscription_row(user_id)
    if (existing and existing.get("stripe_subscription_id") not in (None, sub["id"])
            and existing.get("status") in ACTIVE_STATUSES and sub["status"] not in ACTIVE_STATUSES):
        return  # an old, ended subscription must not overwrite a newer active one

    # Newer Stripe API versions keep the billing period on the subscription item
    items = (sub.get("items") or {}).get("data") or []
    period_end = (items[0].get("current_period_end") if items else None) or sub.get("current_period_end")

    if not get_user_exists(user_id):
        app.logger.info(f"User {user_id} was deleted; ignoring subscription {subscription_id}")
        return  # e.g. the account was removed before Stripe's final "deleted" event arrived

    db.table("subscriptions").upsert({
        "user_id": user_id,
        "stripe_customer_id": sub["customer"],
        "stripe_subscription_id": sub["id"],
        "status": sub["status"],
        "current_period_end": to_iso(period_end),
        # Newer Stripe versions schedule a cancellation with a cancel_at date instead of the
        # cancel_at_period_end flag (the Billing Portal does this), so check both
        "cancel_at_period_end": bool(sub.get("cancel_at_period_end") or sub.get("cancel_at")),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).execute()


# ---------- routes ----------

@app.get("/api/health")
def health():
    return jsonify({"ok": True})


@app.post("/api/checkout")
def create_checkout():
    user = current_user()
    if not user:
        return jsonify({"error": "Please log in first."}), 401
    row = get_subscription_row(user.id)
    if row and row.get("status") in ACTIVE_STATUSES:
        return jsonify({"error": "You already have an active membership."}), 409
    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            customer=get_or_create_customer(user),
            line_items=[{"price": PRICE_ID, "quantity": 1}],
            client_reference_id=user.id,
            subscription_data={"metadata": {"user_id": user.id}},
            success_url=f"{site_url()}/members?checkout=success",
            cancel_url=f"{site_url()}/?checkout=cancelled",
        )
    except stripe.StripeError as e:
        app.logger.error(f"Checkout error: {e}")
        return jsonify({"error": "Payments are unavailable right now. Please try again later."}), 502
    return jsonify({"url": session.url})


@app.post("/api/portal")
def create_portal():
    user = current_user()
    if not user:
        return jsonify({"error": "Please log in first."}), 401
    row = get_subscription_row(user.id)
    if not row or not row.get("stripe_customer_id"):
        return jsonify({"error": "No membership found for this account."}), 404
    try:
        session = stripe.billing_portal.Session.create(
            customer=row["stripe_customer_id"], return_url=f"{site_url()}/account"
        )
    except stripe.StripeError as e:
        app.logger.error(f"Portal error: {e}")
        return jsonify({"error": "Billing is unavailable right now. Please try again later."}), 502
    return jsonify({"url": session.url})


@app.post("/api/stripe/webhook")
def stripe_webhook():
    try:
        event = stripe.Webhook.construct_event(
            request.get_data(), request.headers.get("Stripe-Signature", ""), WEBHOOK_SECRET
        )
    except (ValueError, stripe.SignatureVerificationError):
        return jsonify({"error": "Invalid signature"}), 400  # not from Stripe: ignore

    obj = event["data"]["object"].to_dict()
    if event["type"] == "checkout.session.completed" and obj.get("subscription"):
        sync_subscription(obj["subscription"])
    elif event["type"] in (
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    ):
        sync_subscription(obj["id"])
    return jsonify({"received": True})


if __name__ == "__main__":
    app.run(debug=True, port=int(os.getenv("PORT", "5001")))
