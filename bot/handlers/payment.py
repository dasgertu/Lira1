"""Tariff selection + Telegram Payments + activation code issuing."""
from __future__ import annotations

import logging

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    PreCheckoutQuery,
)

from bot.config import get_settings
from bot.db import session_scope
from bot.models import Tariff
from bot.services.payments import (
    TARIFF_META,
    finalize_payment_no_code,
    send_invoice,
)
from bot.services.users import get_or_create_user
from bot.states import Onboarding

log = logging.getLogger(__name__)
router = Router(name="payment")


def _tariff_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text=f"Premium — {TARIFF_META[Tariff.PREMIUM]['price']}₽/мес",
                    callback_data="tariff:premium",
                )
            ],
            [
                InlineKeyboardButton(
                    text=f"Базовый — {TARIFF_META[Tariff.BASIC]['price']}₽/мес",
                    callback_data="tariff:basic",
                )
            ],
            [
                InlineKeyboardButton(
                    text=f"VIP — {TARIFF_META[Tariff.VIP]['price']}₽/мес",
                    callback_data="tariff:vip",
                )
            ],
        ]
    )


async def show_tariffs(message: Message) -> None:
    text = (
        "<b>Шаг 7/7. Выбери тариф</b>\n\n"
        "✨ <b>Lira Premium — 199₽/мес</b>\n"
        "Цифровой тариф: расширенная аналитика цикла, прогноз овуляции, "
        "экспорт в PDF/CSV, гайды. Без бокса.\n\n"
        "🌸 <b>Базовый — 999₽/мес</b>\n"
        "До 5 предметов: средства гигиены, шоколадка, 1 средство ухода.\n\n"
        "💎 <b>VIP — 1999₽/мес</b>\n"
        "До 8 предметов + сюрприз: органика, шоколад ручной работы, "
        "3 средства ухода, чай, гайды по фазам цикла."
    )
    await message.answer(text, parse_mode="HTML", reply_markup=_tariff_keyboard())


@router.callback_query(Onboarding.tariff, F.data.startswith("tariff:"))
async def pick_tariff(cb: CallbackQuery, state: FSMContext) -> None:
    """Legacy fallback: tariff picker shown after the survey if we lost the
    preselected value. Welcome menu now handles tariff selection up front."""
    raw = (cb.data or "").split(":", 1)[1]
    try:
        tariff = Tariff(raw)
    except ValueError:
        await cb.answer("Неизвестный тариф", show_alert=True)
        return
    await state.set_state(Onboarding.waiting_payment)
    await cb.message.edit_reply_markup(reply_markup=None)
    await invoice_for_tariff(cb.message, state, tariff)
    await cb.answer()


async def invoice_for_tariff(
    message: Message, state: FSMContext, tariff: Tariff
) -> None:
    """Send a Telegram Payments invoice for the given tariff. Falls back to
    a manual ``Я оплатила (тест)`` button when no payment provider is
    configured. Used both from the Premium fast path and the
    onboarding-completed path."""
    await state.update_data(_tariff=tariff.value)
    sent = await send_invoice(message.bot, message.chat.id, tariff)
    if not sent:
        await message.answer(
            "Платёжный провайдер пока не настроен. Можешь оформить "
            "подписку в тестовом режиме — нажми кнопку ниже.",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=[
                    [
                        InlineKeyboardButton(
                            text=f"✅ Оформить за {TARIFF_META[tariff]['price']} ₽ (тест)",
                            callback_data=f"manualpay:{tariff.value}",
                        )
                    ]
                ]
            ),
        )


@router.callback_query(Onboarding.waiting_payment, F.data.startswith("manualpay:"))
async def manual_pay(cb: CallbackQuery, state: FSMContext) -> None:
    raw = (cb.data or "").split(":", 1)[1]
    try:
        tariff = Tariff(raw)
    except ValueError:
        await cb.answer()
        return
    await cb.message.edit_reply_markup(reply_markup=None)
    await _complete_payment(
        cb,
        state,
        tariff=tariff,
        payment_id="manual-test",
        amount_rub=TARIFF_META[tariff]["price"],
    )


@router.pre_checkout_query()
async def on_pre_checkout(pre_checkout: PreCheckoutQuery) -> None:
    await pre_checkout.answer(ok=True)


@router.message(F.successful_payment)
async def on_successful_payment(message: Message, state: FSMContext) -> None:
    sp = message.successful_payment
    if sp is None:
        return
    payload = sp.invoice_payload or ""
    if not payload.startswith("flowcare:"):
        return
    raw = payload.split(":", 1)[1]
    try:
        tariff = Tariff(raw)
    except ValueError:
        return
    await _complete_payment(
        message,
        state,
        tariff=tariff,
        payment_id=sp.provider_payment_charge_id or sp.telegram_payment_charge_id,
        amount_rub=sp.total_amount // 100,
    )


async def _complete_payment(
    event,
    state: FSMContext,
    *,
    tariff: Tariff,
    payment_id: str,
    amount_rub: int,
) -> None:
    settings = get_settings()
    user_tg = event.from_user
    async with session_scope() as session:
        user = await get_or_create_user(session, user_tg)
        order, sub = await finalize_payment_no_code(
            session,
            user=user,
            tariff=tariff,
            payment_id=payment_id,
            amount_rub=amount_rub,
        )
        device_id = user.device_id

    if tariff == Tariff.PREMIUM:
        tail = (
            "Открой приложение <b>Lira</b> — расширенная аналитика, история "
            "циклов, прогноз овуляции, экспорт PDF/CSV и гайды уже разблокированы.\n\n"
            "Если приложение ещё не привязано к Telegram — открой его, зайди "
            "во вкладку «Подписка» и нажми «Синхронизация с Telegram».\n\n"
            "Команда /mybox — статус подписки."
        )
    else:
        tail = (
            "Я начну собирать твой первый бокс к ближайшим месячным.\n\n"
            "В приложении <b>Lira</b> подписка автоматически активна — "
            "если ещё не привязал(а) приложение к Telegram, открой "
            "вкладку «Подписка» и нажми «Синхронизация с Telegram».\n\n"
            "Команда /mybox — статус."
        )
    expires_at = sub.expires_at.date().isoformat()
    text = (
        "✨ <b>Готово! Подписка активирована.</b>\n\n"
        f"<b>Тариф:</b> {TARIFF_META[tariff]['title']}\n"
        f"<b>Действует до:</b> {expires_at}\n\n" + tail
    )
    await _send(event, text)

    bot = event.bot if hasattr(event, "bot") else event.message.bot
    if settings.admin_chat_id:
        try:
            await bot.send_message(
                settings.admin_chat_id,
                f"💰 Новая оплата от <a href='tg://user?id={user_tg.id}'>"
                f"{user_tg.first_name or user_tg.username or user_tg.id}</a>\n"
                f"Тариф: {tariff.value} • {amount_rub}₽\n"
                f"device_id: <code>{device_id or '—'}</code>",
                parse_mode="HTML",
            )
        except Exception:  # noqa: BLE001
            log.exception("Failed to notify admin chat")

    await state.clear()


async def _send(event, text: str) -> None:
    if isinstance(event, CallbackQuery):
        await event.message.answer(text, parse_mode="HTML")
        await event.answer()
    else:
        await event.answer(text, parse_mode="HTML")
