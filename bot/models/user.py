from __future__ import annotations

from typing import TYPE_CHECKING

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from bot.models.base import Base

if TYPE_CHECKING:
    from bot.models.profile import Profile
    from bot.models.subscription import Subscription
    from bot.models.activation_code import ActivationCode


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    username: Mapped[str | None] = mapped_column(String(64))
    first_name: Mapped[str | None] = mapped_column(String(128))
    language_code: Mapped[str | None] = mapped_column(String(8))
    # Timestamp when the user accepted the personal-data processing consent
    # (152-ФЗ). Until this is set, /start shows only the consent screen and
    # blocks access to the questionnaire / Premium invoice.
    pd_consent_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)
    # Stable identifier of the Lira app installation that the user linked to
    # this Telegram account via the in-app "Sync with Telegram" button. The
    # API uses this to answer subscription-status queries from the app
    # without the user having to copy any activation code by hand.
    device_id: Mapped[str | None] = mapped_column(String(128), index=True, default=None)

    profile: Mapped["Profile | None"] = relationship(
        "Profile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    subscriptions: Mapped[list["Subscription"]] = relationship(
        "Subscription", back_populates="user", cascade="all, delete-orphan"
    )
    activation_codes: Mapped[list["ActivationCode"]] = relationship(
        "ActivationCode", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<User id={self.id} tg={self.telegram_id} @{self.username}>"
