"""Runtime configuration loaded from environment variables / .env."""
from __future__ import annotations

from functools import lru_cache

from pydantic import BeforeValidator, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Annotated


def _empty_str_to_none(v):
    if isinstance(v, str) and v.strip() == "":
        return None
    return v


OptionalInt = Annotated[int | None, BeforeValidator(_empty_str_to_none)]
OptionalStr = Annotated[str | None, BeforeValidator(_empty_str_to_none)]


class Settings(BaseSettings):
    """Single source of truth for env-derived configuration."""

    model_config = SettingsConfigDict(
        env_file=("bot/.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Telegram
    bot_token: str = Field(..., alias="BOT_TOKEN")
    admin_chat_id: OptionalInt = Field(default=None, alias="ADMIN_CHAT_ID")
    assembly_chat_id: OptionalInt = Field(default=None, alias="ASSEMBLY_CHAT_ID")
    payment_provider_token: OptionalStr = Field(
        default=None, alias="PAYMENT_PROVIDER_TOKEN"
    )

    # Database (default: local SQLite for dev; Postgres URL in docker-compose)
    database_url: str = Field(
        default="sqlite+aiosqlite:///./flowcare.db",
        alias="DATABASE_URL",
    )

    # FastAPI
    api_host: str = Field(default="0.0.0.0", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")
    # Username (without @) used by the API to build deep-link URLs the
    # app opens for the "Synchronize with Telegram" button.
    bot_username: OptionalStr = Field(default=None, alias="BOT_USERNAME")

    # Subscription
    basic_price_rub: int = Field(default=999, alias="BASIC_PRICE_RUB")
    vip_price_rub: int = Field(default=1999, alias="VIP_PRICE_RUB")
    subscription_days: int = Field(default=30, alias="SUBSCRIPTION_DAYS")

    # Scheduling
    box_lead_days: int = Field(
        default=5,
        alias="BOX_LEAD_DAYS",
        description="How many days before predicted period to ship the box.",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
