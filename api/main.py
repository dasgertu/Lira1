"""FastAPI app exposing endpoints for the Lira mobile/web app.

Endpoints:
- POST /v1/activate — legacy code-based activation (kept for backwards
  compatibility with old app builds; new app does not use codes).
- GET  /v1/subscription?device_id=… — current subscription status for a
  given app installation. The bot writes ``users.device_id`` when the
  user taps the in-app "Synchronize with Telegram" button (deep-link
  ``t.me/<bot>?start=link_<device_id>``); after a paid subscription is
  created against that telegram_id, this endpoint flips the app to
  ``valid: true``.
- POST /v1/link {device_id} — returns the deep-link URL the app should
  open to bind a device to a Telegram user.

The bot writes activation_codes after a paid subscription; the app
posts the user-entered code here. We return validity, tariff, and
expiry so the app can flip the local subscription banner.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import desc, select

from bot.config import get_settings
from bot.db import engine, session_scope
from bot.models import Base, PendingDeviceLink, Subscription, User
from bot.services.catalog import seed_catalog
from bot.services.codes import redeem_code

log = logging.getLogger("flowcare-api")
logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with session_scope() as session:
        await seed_catalog(session)
    yield


app = FastAPI(
    title="Lira API",
    version="2.0.0",
    description="Subscription status + activation for the Lira app.",
    lifespan=lifespan,
)

# Web build runs from a different origin than the API host (Cloudflare
# tunnels rotate the subdomain on every restart). Allow any origin —
# requests carry no auth-bearing cookies, only a generated device_id.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


class ActivateIn(BaseModel):
    code: str = Field(..., min_length=4, max_length=16)
    device_id: str | None = Field(default=None, max_length=128)


class ActivateOut(BaseModel):
    valid: bool
    tariff: str | None = None
    expires: str | None = None
    redeemed_at: str | None = None


class SubscriptionOut(BaseModel):
    valid: bool
    tariff: str | None = None
    expires: str | None = None
    linked: bool = False


class PeriodEpisode(BaseModel):
    """One observed period episode (start..end inclusive, ISO dates)."""

    start: str = Field(..., max_length=10)
    end: str = Field(..., max_length=10)


class LinkIn(BaseModel):
    device_id: str = Field(..., min_length=1, max_length=128)
    bot_username: str | None = Field(default=None, max_length=64)
    # Optional cycle data the app collected during in-app onboarding. We
    # stash it keyed by device_id so the bot can copy it into the user's
    # questionnaire profile and skip the cycle-related questions.
    anchor_date: str | None = Field(
        default=None,
        max_length=10,
        description="Last period start date in YYYY-MM-DD",
    )
    cycle_length_days: int | None = Field(default=None, ge=18, le=60)
    period_length_days: int | None = Field(default=None, ge=1, le=14)
    # Ordered list (oldest → newest) of all period episodes the app has
    # logged so far. Used by the admin notification so the operator
    # sees the real history (e.g. "3-8 апр, 30 апр - 4 мая, …").
    period_episodes: list[PeriodEpisode] | None = Field(default=None)


class LinkOut(BaseModel):
    deep_link: str
    device_id: str


@app.post("/v1/activate", response_model=ActivateOut)
async def activate(body: ActivateIn) -> ActivateOut:
    """Legacy code-based activation. Kept for backwards compatibility."""
    async with session_scope() as session:
        result = await redeem_code(session, body.code, device_id=body.device_id)
    if result is None:
        return ActivateOut(valid=False)
    code, sub = result
    return ActivateOut(
        valid=True,
        tariff=sub.tariff.value,
        expires=sub.expires_at.date().isoformat(),
        redeemed_at=(code.redeemed_at.isoformat() if code.redeemed_at else None),
    )


@app.get("/v1/subscription", response_model=SubscriptionOut)
async def subscription_status(device_id: str) -> SubscriptionOut:
    """Return the current active subscription for the user linked to
    ``device_id`` (via the bot's ``/start link_<device_id>`` deep link).

    - ``linked=False, valid=False``  → user has not opened the bot yet,
      app should show the "Synchronize with Telegram" CTA.
    - ``linked=True, valid=False``   → device is bound but no active
      subscription (or it expired); app shows the tariff cards / CTA to
      pick a tariff in the bot.
    - ``linked=True, valid=True``    → unlock the corresponding tier.
    """
    async with session_scope() as session:
        user = (
            await session.execute(
                select(User).where(User.device_id == device_id)
            )
        ).scalar_one_or_none()
        if user is None:
            return SubscriptionOut(valid=False, linked=False)
        stmt = (
            select(Subscription)
            .where(
                Subscription.user_id == user.id,
                Subscription.status == "active",
            )
            .order_by(desc(Subscription.expires_at))
        )
        sub = (await session.execute(stmt)).scalars().first()
    if sub is None:
        return SubscriptionOut(valid=False, linked=True)
    expires = sub.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        return SubscriptionOut(valid=False, linked=True)
    return SubscriptionOut(
        valid=True,
        tariff=sub.tariff.value,
        expires=sub.expires_at.date().isoformat(),
        linked=True,
    )


@app.post("/v1/link", response_model=LinkOut)
async def build_link(body: LinkIn) -> LinkOut:
    """Stash any cycle data the app collected and return the bot deep-link.

    Two paths:

    * If the device_id is already bound to a Telegram user (the user has
      tapped "Sync with Telegram" before), write the cycle data directly
      to that user's questionnaire ``Profile`` so the admin notification
      stays current with each app-side log change.
    * Otherwise, stash it in ``PendingDeviceLink`` keyed by device_id;
      the bot will copy it into the Profile on the very first
      ``/start link_<device_id>`` call.
    """
    settings = get_settings()
    bot_username = body.bot_username or settings.bot_username or "lowerBsk24_bot"

    parsed_anchor: date | None = None
    if body.anchor_date:
        try:
            parsed_anchor = date.fromisoformat(body.anchor_date)
        except ValueError:
            parsed_anchor = None

    episodes_payload: list[dict] | None = None
    if body.period_episodes is not None:
        episodes_payload = [
            {"start": e.start, "end": e.end} for e in body.period_episodes
        ]

    has_anything = (
        parsed_anchor is not None
        or body.cycle_length_days is not None
        or body.period_length_days is not None
        or episodes_payload is not None
    )

    if has_anything:
        async with session_scope() as session:
            user = (
                await session.execute(
                    select(User).where(User.device_id == body.device_id)
                )
            ).scalar_one_or_none()
            if user is not None:
                # Already linked → write straight to Profile so the admin
                # always sees fresh data on every box assembly.
                from bot.services.users import get_or_create_profile

                profile = await get_or_create_profile(session, user)
                if parsed_anchor is not None:
                    profile.last_period_start = parsed_anchor
                if body.cycle_length_days is not None:
                    profile.cycle_length_days = body.cycle_length_days
                if body.period_length_days is not None:
                    profile.period_length_days = body.period_length_days
                if episodes_payload is not None:
                    extra = dict(profile.extra or {})
                    extra["period_episodes"] = episodes_payload
                    profile.extra = extra
            else:
                existing = await session.get(PendingDeviceLink, body.device_id)
                if existing is None:
                    session.add(
                        PendingDeviceLink(
                            device_id=body.device_id,
                            anchor_date=parsed_anchor,
                            cycle_length_days=body.cycle_length_days,
                            period_length_days=body.period_length_days,
                            period_episodes=episodes_payload,
                        )
                    )
                else:
                    if parsed_anchor is not None:
                        existing.anchor_date = parsed_anchor
                    if body.cycle_length_days is not None:
                        existing.cycle_length_days = body.cycle_length_days
                    if body.period_length_days is not None:
                        existing.period_length_days = body.period_length_days
                    if episodes_payload is not None:
                        existing.period_episodes = episodes_payload

    return LinkOut(
        deep_link=f"https://t.me/{bot_username}?start=link_{body.device_id}",
        device_id=body.device_id,
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


def run() -> None:  # pragma: no cover
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "api.main:app", host=settings.api_host, port=settings.api_port, reload=False
    )
