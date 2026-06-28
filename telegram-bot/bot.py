"""Telegram bot entry point. Runs as a long-polling process."""

import logging

from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

import api_client
from config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)


def _budget_bar(spent: float, budget: float, width: int = 20) -> str:
    if budget <= 0:
        return "no budget set"
    pct = min(spent / budget, 1.0)
    filled = int(pct * width)
    bar = "█" * filled + "░" * (width - filled)
    return f"[{bar}] {pct*100:.0f}%"


async def cmd_start(update: Update, _ctx: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "👋 Expense Tracker Bot\n\n"
        "Commands:\n"
        "/link <code> — link your account (get code from web app Settings)\n"
        "/total — this month's spending vs budget\n"
        "/budget — your budget caps\n"
        "/undo — delete your last entry\n"
        "/help — show this message\n\n"
        "Or just type an expense: swiggy 420 dinner"
    )


async def cmd_help(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    await cmd_start(update, ctx)


async def cmd_link(update: Update, _ctx: ContextTypes.DEFAULT_TYPE) -> None:
    parts = update.message.text.split()
    if len(parts) < 2:
        await update.message.reply_text("Usage: /link <code>  — get the code from Settings in the web app.")
        return

    code = parts[1].strip().upper()
    chat_id = update.effective_chat.id
    ok = await api_client.resolve_link(code, chat_id)
    if ok:
        await update.message.reply_text("✅ Account linked! You can now log expenses here.")
    else:
        await update.message.reply_text("❌ Invalid or expired code. Generate a new one from Settings.")


async def cmd_total(update: Update, _ctx: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    data = await api_client.get_total(chat_id)
    if not data:
        await update.message.reply_text("Account not linked. Use /link <code> first.")
        return

    sym = data.get("currency", "₹")
    total = data["total"]
    budget = data["monthly_budget"]
    bar = _budget_bar(total, budget)
    msg = f"📊 {data['month']}\nSpent: {sym}{total:,.0f}"
    if budget:
        msg += f" / {sym}{budget:,.0f}\n{bar}"
    await update.message.reply_text(msg)


async def cmd_undo(update: Update, _ctx: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    result = await api_client.undo(chat_id)
    if result:
        sym = "₹"
        await update.message.reply_text(
            f"↩️ Deleted: {sym}{result['deleted_amount']:,.0f} [{result['deleted_category']}]"
        )
    else:
        await update.message.reply_text("Nothing to undo — no transactions found for your account.")


async def cmd_budget(update: Update, _ctx: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    data = await api_client.get_budget(chat_id)
    if not data:
        await update.message.reply_text("Account not linked. Use /link <code> first.")
        return

    sym = data.get("currency", "₹")
    monthly = data.get("monthly_budget", 0)
    cat = data.get("category_budgets", {})
    lines = [f"💰 Monthly budget: {sym}{monthly:,.0f}" if monthly else "💰 Monthly budget: not set"]
    if cat:
        lines.append("\nCategory caps:")
        for c, cap in cat.items():
            lines.append(f"  {c}: {sym}{cap:,.0f}")
    await update.message.reply_text("\n".join(lines))


async def handle_text(update: Update, _ctx: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    text = update.message.text.strip()

    data = await api_client.send_message(chat_id, text)
    if not data:
        await update.message.reply_text(
            "❌ Couldn't process that. Make sure your account is linked (/link <code>) "
            "and the message includes an amount."
        )
        return

    sym = data.get("currency", "₹")
    total = data["month_total"]
    budget = data["monthly_budget"]
    bar = _budget_bar(total, budget)
    msg = (
        f"✅ {sym}{data['amount']:,.0f} [{data['category']}]"
        + (f" — {data['note']}" if data.get("note") else "")
        + f"\n\nThis month: {sym}{total:,.0f}"
    )
    if budget:
        msg += f" / {sym}{budget:,.0f}\n{bar}"
    await update.message.reply_text(msg)


def main() -> None:
    app = Application.builder().token(settings.telegram_bot_token).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("link", cmd_link))
    app.add_handler(CommandHandler("total", cmd_total))
    app.add_handler(CommandHandler("undo", cmd_undo))
    app.add_handler(CommandHandler("budget", cmd_budget))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    log.info("Bot starting (long polling)…")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
