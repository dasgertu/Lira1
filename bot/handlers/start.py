from __future__ import annotations

import logging
from datetime import datetime, timezone

from aiogram import F, Router
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    CallbackQuery,
)

from bot.db import session_scope
from bot.services.users import get_or_create_user
from bot.states import Onboarding

log = logging.getLogger(__name__)
router = Router(name="start")


WELCOME = (
    "Привет, я <b>Flow</b> 🌸\n\n"
    "Я помогу собрать персональный <b>бокс заботы</b> — каждый месяц "
    "к датам М тебе будет приезжать коробка со средствами гигиены, "
    "уходом и приятностями. Подобрано лично под тебя: твои "
    "предпочтения, аллергии, образ жизни и фаза цикла.\n\n"
    "Также есть <b>Lira Premium</b> — цифровой тариф 199 ₽/мес: "
    "расширенная аналитика, прогноз овуляции, экспорт PDF/CSV, гайды. "
    "Без бокса и без опросника — оплатил, получил код активации, "
    "ввёл в приложении.\n\n"
    "Для бокса сначала зададу несколько вопросов (можно прерваться и "
    "вернуться позже — твои ответы сохраняются), потом покажу тарифы и "
    "оформим подписку через Telegram-оплату. После оплаты дам код для "
    "приложения."
)


# Prominent personal-data notice shown before the welcome screen on the
# very first /start. Wording is intentionally large/explicit per 152-ФЗ
# («Согласие субъекта на обработку персональных данных»):
# – scope is restricted to box assembly + delivery,
# – we list the categories of data processed,
# – we name the third party we share with (logistics),
# – we confirm we do NOT use the data for ads or sell it,
# – we point to /privacy for the full text.
CONSENT_TEXT = (
    "<b>⚠️ ВНИМАНИЕ — обработка персональных данных</b>\n\n"
    "Перед тем как начать, прочитай и подтверди согласие на обработку "
    "персональных данных (требование 152-ФЗ).\n\n"
    "<b>Твои данные используются ТОЛЬКО для формирования и доставки "
    "бокса заботы.</b>\n\n"
    "Что мы собираем:\n"
    "• имя, год рождения, город;\n"
    "• твои ответы из опросника (предпочтения по гигиене, аллергии, "
    "образ жизни);\n"
    "• адрес доставки и контактный телефон;\n"
    "• данные о цикле, которые ты сама присылаешь из приложения "
    "(только если используешь функцию синхронизации);\n"
    "• сведения об оплате через Telegram Payments.\n\n"
    "Что мы <b>НЕ</b> делаем:\n"
    "• не передаём данные третьим лицам, кроме службы доставки "
    "(только адрес и имя получателя);\n"
    "• не используем данные для рекламы и не продаём их;\n"
    "• не публикуем твои ответы и не показываем их другим пользователям.\n\n"
    "Хранение — на серверах оператора Lira в РФ. Ты можешь в любой "
    "момент удалить данные, написав в /mybox → «Удалить мои данные» "
    "или связавшись с поддержкой.\n\n"
    "Полный текст: /privacy\n\n"
    "Нажимая «Согласна и продолжить», ты подтверждаешь, что тебе "
    "<b>16+</b>, ты ознакомилась с условиями и даёшь согласие на "
    "обработку перечисленных персональных данных."
)


PRIVACY_TEXT = (
    "<b>Политика обработки персональных данных</b>\n\n"
    "<b>1. Оператор</b>\n"
    "Сервис «Lira BOX» (далее — Оператор), Telegram-бот @lowerBsk24_bot.\n\n"
    "<b>2. Цели обработки</b>\n"
    "Формирование персонального бокса заботы и его доставка по адресу, "
    "указанному пользователем. Обработка платежей подписки через "
    "Telegram Payments. Поддержка пользователя.\n\n"
    "<b>3. Категории субъектов</b>\n"
    "Совершеннолетние и пользователи 16+, добровольно прошедшие "
    "опросник в боте.\n\n"
    "<b>4. Категории обрабатываемых данных</b>\n"
    "ФИО / имя, год рождения, город, адрес доставки, телефон, "
    "ответы опросника (предпочтения по гигиене, аллергии, "
    "образ жизни), данные о цикле (только при использовании "
    "функции синхронизации в приложении), идентификатор Telegram, "
    "username и язык интерфейса, метаданные оплат.\n\n"
    "<b>5. Правовое основание</b>\n"
    "Согласие субъекта (ч. 1 ст. 6 152-ФЗ), договор-оферта на "
    "оказание услуг подписки.\n\n"
    "<b>6. Передача третьим лицам</b>\n"
    "Только службам доставки и платёжной системе Telegram Payments / "
    "ЮMoney в объёме, необходимом для исполнения заказа. Передача "
    "за пределы РФ не осуществляется.\n\n"
    "<b>7. Сроки хранения</b>\n"
    "До отзыва согласия пользователем или до прекращения "
    "необходимости в данных (3 года после последней оплаты).\n\n"
    "<b>8. Права пользователя</b>\n"
    "Доступ, изменение, удаление, отзыв согласия — через /mybox или "
    "обращение в поддержку. Жалобу можно направить в Роскомнадзор.\n\n"
    "Согласие — /start. Отозвать согласие — /forget."
)


def _consent_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="✅ Согласна и продолжить",
                    callback_data="consent:accept",
                )
            ],
            [
                InlineKeyboardButton(
                    text="📄 Полный текст политики",
                    callback_data="consent:privacy",
                )
            ],
            [
                InlineKeyboardButton(
                    text="❌ Отказаться",
                    callback_data="consent:decline",
                )
            ],
        ]
    )


def _welcome_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="✨ Lira Premium — 199₽/мес",
                    callback_data="premium:buy",
                )
            ],
            [
                InlineKeyboardButton(
                    text="📦 Бокс заботы (опросник)",
                    callback_data="onboarding:start",
                )
            ],
            [
                InlineKeyboardButton(
                    text="📦 Мой бокс", callback_data="cabinet:status"
                )
            ],
        ]
    )


async def _show_welcome(message: Message) -> None:
    """Send the standard welcome screen with main-menu buttons."""
    await message.answer(
        WELCOME,
        parse_mode="HTML",
        reply_markup=_welcome_keyboard(),
    )


async def _show_consent(message: Message, state: FSMContext, *, pending: str) -> None:
    """Render the personal-data notice and remember which action to resume
    after the user accepts (e.g. ``"welcome"`` or ``"premium"``)."""
    await state.update_data(_consent_pending=pending)
    await message.answer(
        CONSENT_TEXT,
        parse_mode="HTML",
        reply_markup=_consent_keyboard(),
        disable_web_page_preview=True,
    )


async def ensure_consent(message: Message, state: FSMContext, tg_user, *, pending: str) -> bool:
    """Public guard for other handlers (``/setup``, ``/mybox``, …): if the
    user has not yet accepted the personal-data consent, show the consent
    screen and return ``False`` so the caller can bail. Returns ``True`` if
    the user is good to go."""
    async with session_scope() as session:
        user = await get_or_create_user(session, tg_user)
        if user.pd_consent_at is not None:
            return True
    await _show_consent(message, state, pending=pending)
    return False


@router.message(CommandStart(deep_link=True), F.text.regexp(r"^/start\s+premium\b"))
async def on_start_premium(message: Message, state: FSMContext) -> None:
    """Deep link from the app: tariff is preselected as Premium → straight to invoice."""
    await state.clear()
    if message.from_user is None:
        return
    async with session_scope() as session:
        user = await get_or_create_user(session, message.from_user)
        accepted = user.pd_consent_at is not None
    if not accepted:
        await _show_consent(message, state, pending="premium")
        return
    await _send_premium_invoice(message, state)


@router.callback_query(F.data == "premium:buy")
async def on_premium_buy(cb: CallbackQuery, state: FSMContext) -> None:
    if cb.message is None:
        await cb.answer()
        return
    await state.clear()
    if cb.from_user is None:
        await cb.answer()
        return
    async with session_scope() as session:
        user = await get_or_create_user(session, cb.from_user)
        accepted = user.pd_consent_at is not None
    try:
        await cb.message.edit_reply_markup(reply_markup=None)
    except Exception:
        pass
    if not accepted:
        await _show_consent(cb.message, state, pending="premium")
        await cb.answer()
        return
    await _send_premium_invoice(cb.message, state)
    await cb.answer()


async def _send_premium_invoice(message: Message, state: FSMContext) -> None:
    """Push the user straight into invoicing for the Premium tariff."""
    from bot.models import Tariff
    from bot.services.payments import TARIFF_META, send_invoice

    tariff = Tariff.PREMIUM
    await state.set_state(Onboarding.waiting_payment)
    await state.update_data(_tariff=tariff.value)
    await message.answer(
        "<b>Lira Premium</b>\n"
        "Цифровой тариф — 199 ₽/мес. Без бокса и без опросника.\n\n"
        "После оплаты пришлю код активации — введи его в приложении "
        "Lira на экране «Подписка».",
        parse_mode="HTML",
    )
    sent = await send_invoice(message.bot, message.chat.id, tariff)
    if not sent:
        await message.answer(
            "Платёжный провайдер пока не настроен. Можешь оформить "
            "Premium в тестовом режиме — нажми кнопку ниже, и я пришлю "
            "код активации.",
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


@router.message(CommandStart())
async def on_start(message: Message, state: FSMContext) -> None:
    await state.clear()
    if message.from_user is None:
        return
    async with session_scope() as session:
        user = await get_or_create_user(session, message.from_user)
        accepted = user.pd_consent_at is not None
    if not accepted:
        await _show_consent(message, state, pending="welcome")
        return
    await _show_welcome(message)


@router.callback_query(F.data == "consent:accept")
async def on_consent_accept(cb: CallbackQuery, state: FSMContext) -> None:
    if cb.message is None or cb.from_user is None:
        await cb.answer()
        return
    async with session_scope() as session:
        user = await get_or_create_user(session, cb.from_user)
        if user.pd_consent_at is None:
            user.pd_consent_at = datetime.now(timezone.utc)
    try:
        await cb.message.edit_reply_markup(reply_markup=None)
    except Exception:
        pass
    await cb.message.answer(
        "Спасибо! Согласие сохранила. Теперь продолжаем 🌸",
        parse_mode="HTML",
    )
    data = await state.get_data()
    pending = data.get("_consent_pending", "welcome")
    await state.update_data(_consent_pending=None)
    if pending == "premium":
        await _send_premium_invoice(cb.message, state)
    else:
        await _show_welcome(cb.message)
    await cb.answer()


@router.callback_query(F.data == "consent:privacy")
async def on_consent_privacy(cb: CallbackQuery) -> None:
    if cb.message is None:
        await cb.answer()
        return
    await cb.message.answer(
        PRIVACY_TEXT,
        parse_mode="HTML",
        disable_web_page_preview=True,
    )
    await cb.answer()


@router.callback_query(F.data == "consent:decline")
async def on_consent_decline(cb: CallbackQuery, state: FSMContext) -> None:
    if cb.message is None:
        await cb.answer()
        return
    await state.clear()
    try:
        await cb.message.edit_reply_markup(reply_markup=None)
    except Exception:
        pass
    await cb.message.answer(
        "Поняла. Без согласия на обработку данных я не смогу собрать "
        "и доставить бокс. Если передумаешь — отправь /start.",
    )
    await cb.answer()


@router.message(Command("privacy"))
async def on_privacy(message: Message) -> None:
    await message.answer(
        PRIVACY_TEXT,
        parse_mode="HTML",
        disable_web_page_preview=True,
    )


@router.message(Command("help"))
async def on_help(message: Message) -> None:
    await message.answer(
        "Команды:\n"
        "/start — приветствие\n"
        "/setup — пройти / продолжить настройку бокса\n"
        "/mybox — личный кабинет (статус подписки, дата ближайшего бокса)\n"
        "/privacy — политика обработки персональных данных\n"
        "/cancel — отменить текущий ввод"
    )


@router.message(Command("cancel"))
async def on_cancel(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer("Окей, отменила. Чтобы начать заново — /start.")
