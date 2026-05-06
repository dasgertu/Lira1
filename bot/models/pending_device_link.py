"""Stash of cycle data the Lira app pushes when the user taps "Sync with
Telegram", before they actually open the bot.

Flow:
1. App POSTs ``/v1/link {device_id, anchor_date, cycle_length_days,
   period_length_days}`` and saves a row here keyed by ``device_id``.
2. App opens ``t.me/<bot>?start=link_<device_id>``.
3. Bot's ``/start link_X`` handler copies the cycle data into the user's
   ``Profile`` row, sets ``users.device_id``, and deletes this row.

Because step 1 happens before any Telegram interaction, we don't yet know
the Telegram user — hence a separate table keyed by ``device_id``.
"""
from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from bot.models.base import Base


class PendingDeviceLink(Base):
    __tablename__ = "pending_device_links"

    device_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    anchor_date: Mapped[date | None] = mapped_column(Date, default=None)
    cycle_length_days: Mapped[int | None] = mapped_column(Integer, default=None)
    period_length_days: Mapped[int | None] = mapped_column(Integer, default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
