"""Parse free-text expense messages into structured transaction data.
Shared by the quick-add web endpoint and the Telegram bot endpoint."""

import re
from dataclasses import dataclass

from app.categories import DEFAULT_CATEGORIES, DEFAULT_CATEGORY, INCOME_KEYWORDS

# Words stripped from the note after removing the amount token.
_FILLER = {
    "rs", "inr", "rupees", "rupee", "spent", "paid", "bought", "at",
    "for", "on", "the", "a", "an", "some", "got", "received",
}

_AMOUNT_RE = re.compile(
    r"""
    (?:₹|rs\.?\s*)?             # optional prefix: ₹ or rs
    (
      \d{1,3}(?:,\d{3})+(?:\.\d+)?  # comma-grouped: 1,234 or 1,23,456.50
      |\d+(?:\.\d+)?                 # plain integer or decimal: 50000 / 1.5
    )
    ([kKlL]?)                   # optional suffix: k / K / l / L
    (?:\s*rs)?                  # optional trailing "rs"
    """,
    re.VERBOSE,
)


@dataclass
class ParsedTx:
    amount: float
    category: str
    note: str
    type: str  # "expense" | "income"


def _parse_amount(digits: str, suffix: str) -> float:
    raw = float(digits.replace(",", ""))
    s = suffix.lower()
    if s == "k":
        return raw * 1_000
    if s == "l":
        return raw * 100_000
    return raw


def _best_category(
    text: str,
    user_categories: dict[str, list[str]] | None,
) -> str:
    """Return the first matching category, checking user overrides first.
    Uses word-boundary matching to avoid substring false positives (e.g. "air" in "haircut")."""
    lower = text.lower()
    lookup = dict(DEFAULT_CATEGORIES)
    if user_categories:
        for cat, keywords in user_categories.items():
            lookup[cat] = keywords

    for category, keywords in lookup.items():
        for kw in keywords:
            if re.search(r"\b" + re.escape(kw) + r"\b", lower):
                return category
    return DEFAULT_CATEGORY


def parse_message(
    text: str,
    user_categories: dict[str, list[str]] | None = None,
) -> ParsedTx:
    """Parse a free-text message into a ParsedTx.

    Returns amount=0 and category="Other" when no amount is found rather than
    raising, so callers can surface a validation error instead.
    """
    lower = text.lower()

    # Detect income before touching the amount
    tx_type = "expense"
    for kw in INCOME_KEYWORDS:
        if kw in lower:
            tx_type = "income"
            break

    # Extract amount
    match = _AMOUNT_RE.search(text)
    if not match:
        return ParsedTx(amount=0.0, category=DEFAULT_CATEGORY, note=text.strip(), type=tx_type)

    amount = _parse_amount(match.group(1), match.group(2))

    # Build note: remove matched span + filler words
    note_text = text[: match.start()].strip() + " " + text[match.end() :].strip()
    # Strip "rs" prefix that may have appeared before the regex start
    note_text = re.sub(r"(?i)\b(?:₹|rs\.?)\b", "", note_text)
    tokens = [w for w in note_text.split() if w.lower() not in _FILLER]
    note = " ".join(tokens).strip()

    category = _best_category(text, user_categories)

    return ParsedTx(amount=amount, category=category, note=note, type=tx_type)
