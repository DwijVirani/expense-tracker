"""Seed the local MongoDB with a demo user and 3 months of transactions.

Usage:
    uv run python seed.py
    uv run python seed.py --reset   # drop existing seed user first

The seeded user's Cognito sub is "seed-user-sub-001". To use this user via
the API in local dev, pass these headers:
    X-Dev-Sub: seed-user-sub-001
    X-Dev-Email: demo@example.com
"""

import argparse
import asyncio
import random
from datetime import date, timedelta

import motor.motor_asyncio
from bson import ObjectId

from app.categories import DEFAULT_CATEGORIES

MONGO_URI = "mongodb+srv://dwijvirani:bGj5qPrASQzHwZ60@cluster0.qodgkqy.mongodb.net/expense_tracker?appName=Cluster0"
SEED_SUB = "seed-user-sub-001"
SEED_EMAIL = "demo@example.com"

TRANSACTIONS = [
    # (category, note, amount_range, source, type)
    ("Food", "Swiggy dinner", (200, 600), "telegram", "expense"),
    ("Food", "Zomato lunch", (150, 450), "web", "expense"),
    ("Food", "Coffee shop", (80, 200), "telegram", "expense"),
    ("Food", "Grocery store", (500, 2000), "web", "expense"),
    ("Food", "Restaurant dinner", (600, 1800), "web", "expense"),
    ("Transport", "Uber ride", (80, 350), "telegram", "expense"),
    ("Transport", "Metro card recharge", (100, 500), "web", "expense"),
    ("Transport", "Petrol", (500, 1500), "web", "expense"),
    ("Transport", "Ola cab", (120, 400), "telegram", "expense"),
    ("Shopping", "Amazon order", (300, 3000), "web", "expense"),
    ("Shopping", "Clothes Myntra", (500, 2500), "web", "expense"),
    ("Entertainment", "Netflix subscription", (649, 649), "web", "expense"),
    ("Entertainment", "Spotify premium", (119, 119), "web", "expense"),
    ("Entertainment", "Movie PVR", (300, 600), "web", "expense"),
    ("Health", "Gym monthly fee", (1000, 2000), "web", "expense"),
    ("Health", "Pharmacy medicines", (150, 800), "web", "expense"),
    ("Health", "Doctor consultation", (300, 1000), "web", "expense"),
    ("Utilities", "Electricity bill", (800, 2500), "web", "expense"),
    ("Utilities", "Internet bill", (600, 1200), "web", "expense"),
    ("Utilities", "Mobile recharge", (239, 399), "web", "expense"),
    ("Education", "Udemy course", (399, 1299), "web", "expense"),
    ("Personal", "Haircut", (150, 400), "telegram", "expense"),
    ("Travel", "OYO hotel", (1200, 4000), "web", "expense"),
]

INCOME_TRANSACTIONS = [
    ("salary", 75000, "Salary credited"),
    ("freelance", 15000, "Freelance project payment"),
    ("cashback", 250, "Credit card cashback"),
    ("interest", 420, "Savings account interest"),
]


def random_date_in_month(year: int, month: int) -> str:
    first = date(year, month, 1)
    if month == 12:
        last = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        last = date(year, month + 1, 1) - timedelta(days=1)
    delta = (last - first).days
    return (first + timedelta(days=random.randint(0, delta))).isoformat()


def months_back(n: int) -> tuple[int, int]:
    today = date.today()
    month = today.month - n
    year = today.year
    while month <= 0:
        month += 12
        year -= 1
    return year, month


async def seed() -> None:
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
    db = client["expense_tracker"]

    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="Delete existing seed user before seeding")
    args = parser.parse_args()

    if args.reset:
        existing = await db["users"].find_one({"cognito_sub": SEED_SUB})
        if existing:
            await db["transactions"].delete_many({"user_id": existing["_id"]})
            await db["users"].delete_one({"_id": existing["_id"]})
            print("Deleted existing seed user and their transactions.")

    existing = await db["users"].find_one({"cognito_sub": SEED_SUB})
    if existing:
        print(f"Seed user already exists (_id={existing['_id']}). Pass --reset to re-seed.")
        return

    user_doc = {
        "cognito_sub": SEED_SUB,
        "email": SEED_EMAIL,
        "currency": "₹",
        "monthly_budget": 50000,
        "category_budgets": {
            "Food": 12000,
            "Transport": 5000,
            "Shopping": 8000,
            "Entertainment": 2000,
            "Health": 3000,
            "Utilities": 5000,
        },
        "categories": {cat: kws for cat, kws in DEFAULT_CATEGORIES.items()},
        "telegram_chat_id": None,
    }
    result = await db["users"].insert_one(user_doc)
    user_id: ObjectId = result.inserted_id
    print(f"Created seed user: {SEED_EMAIL} (_id={user_id})")

    txns = []

    for months_ago in range(3):  # current month + 2 prior months
        year, month = months_back(months_ago)

        # Pick 15–25 random expense transactions for this month
        picks = random.sample(TRANSACTIONS, k=random.randint(15, min(25, len(TRANSACTIONS))))
        for category, note, (lo, hi), source, tx_type in picks:
            amount = round(random.uniform(lo, hi), -1)  # round to nearest 10
            txns.append({
                "user_id": user_id,
                "date": random_date_in_month(year, month),
                "category": category,
                "amount": amount,
                "note": note,
                "type": tx_type,
                "source": source,
            })

        # Add salary income each month
        salary_kw, salary_amt, salary_note = INCOME_TRANSACTIONS[0]
        txns.append({
            "user_id": user_id,
            "date": f"{year}-{month:02d}-01",
            "category": "Income",
            "amount": salary_amt,
            "note": salary_note,
            "type": "income",
            "source": "web",
        })

        # Add 1–2 misc income events
        for income_kw, income_amt, income_note in random.sample(INCOME_TRANSACTIONS[1:], k=random.randint(1, 2)):
            txns.append({
                "user_id": user_id,
                "date": random_date_in_month(year, month),
                "category": "Income",
                "amount": income_amt,
                "note": income_note,
                "type": "income",
                "source": "web",
            })

    await db["transactions"].insert_many(txns)
    print(f"Inserted {len(txns)} transactions across 3 months.")
    print()
    print("To query as this user in local dev, use these headers:")
    print("  X-Dev-Sub:   seed-user-sub-001")
    print("  X-Dev-Email: demo@example.com")
    print()
    print("Example:")
    print("  curl http://localhost:8000/transactions/summary \\")
    print("    -H 'X-Dev-Sub: seed-user-sub-001' \\")
    print("    -H 'X-Dev-Email: demo@example.com'")

    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
