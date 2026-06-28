"""Table-driven tests for parser.py covering all amount formats, income
detection, note stripping, and per-user category overrides."""

import pytest

from app.parser import parse_message


@pytest.mark.parametrize(
    "text, expected_amount",
    [
        ("swiggy 420", 420.0),
        ("coffee 1,250", 1250.0),
        ("gym 1.5k", 1500.0),
        ("rent 2l", 200_000.0),
        ("rs 500 lunch", 500.0),
        ("₹500 lunch", 500.0),
        ("500rs petrol", 500.0),
        ("salary 50000", 50000.0),
        ("petrol 1,500.50", 1500.50),
        ("bought bag 2.5K", 2500.0),
    ],
)
def test_amount_formats(text: str, expected_amount: float):
    result = parse_message(text)
    assert result.amount == expected_amount


@pytest.mark.parametrize(
    "text",
    [
        "salary 50000",
        "refund 200",
        "cashback 100",
        "received 3000",
        "credited 1000 bonus",
        "interest 500",
    ],
)
def test_income_detection(text: str):
    result = parse_message(text)
    assert result.type == "income"


@pytest.mark.parametrize(
    "text",
    [
        "swiggy 420",
        "rent 15000",
        "netflix 199",
        "petrol 1500",
    ],
)
def test_expense_detection(text: str):
    result = parse_message(text)
    assert result.type == "expense"


@pytest.mark.parametrize(
    "text, expected_category",
    [
        ("swiggy 420 dinner", "Food"),
        ("uber 150", "Transport"),
        ("netflix 199", "Entertainment"),
        ("amazon 599 bag", "Shopping"),
        ("doctor 500", "Health"),
        ("electricity 1200", "Utilities"),
        ("udemy course 999", "Education"),
        ("oyo 2000", "Travel"),
        ("haircut 150", "Personal"),
        ("random stuff 500", "Other"),
    ],
)
def test_category_detection(text: str, expected_category: str):
    result = parse_message(text)
    assert result.category == expected_category


def test_note_strips_amount_and_filler():
    result = parse_message("swiggy 420 dinner")
    assert "420" not in result.note
    assert "swiggy" in result.note.lower() or "dinner" in result.note.lower()


def test_note_strips_rs_prefix():
    result = parse_message("rs 500 lunch")
    assert "rs" not in result.note.lower()
    assert "500" not in result.note


def test_zero_amount_on_no_match():
    result = parse_message("nothing here no digits")
    assert result.amount == 0.0


def test_user_category_override():
    user_categories = {"CustomCat": ["mynewkeyword"]}
    result = parse_message("mynewkeyword 500", user_categories)
    assert result.category == "CustomCat"


def test_user_category_override_does_not_break_defaults():
    user_categories = {"Snacks": ["biscuit"]}
    result = parse_message("swiggy 100", user_categories)
    assert result.category == "Food"
