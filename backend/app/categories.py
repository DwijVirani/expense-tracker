"""Default category keyword map. Keys are category names, values are keyword lists.
Per-user overrides are merged at parse time, not here."""

DEFAULT_CATEGORIES: dict[str, list[str]] = {
    "Food": [
        "swiggy", "zomato", "food", "meal", "lunch", "dinner", "breakfast",
        "snack", "chai", "tea", "coffee", "cafe", "restaurant", "eat",
        "biryani", "pizza", "burger", "dosa", "idli", "thali", "bread",
        "grocery", "kirana", "vegetables", "fruits", "milk", "eggs",
    ],
    "Transport": [
        "uber", "ola", "auto", "rickshaw", "cab", "taxi", "bus", "metro",
        "train", "railway", "irctc", "flight", "air", "indigo", "petrol",
        "diesel", "fuel", "parking", "toll", "rapido",
    ],
    "Shopping": [
        "amazon", "flipkart", "myntra", "meesho", "ajio", "nykaa",
        "shop", "buy", "purchase", "clothes", "shirt", "dress", "shoes",
        "bag", "watch", "electronics", "mobile", "phone", "laptop",
    ],
    "Entertainment": [
        "netflix", "hotstar", "prime", "spotify", "youtube", "movie",
        "cinema", "pvr", "inox", "concert", "show", "game", "gaming",
        "play", "stream", "subscription", "ott",
    ],
    "Health": [
        "doctor", "hospital", "clinic", "medicine", "pharmacy", "medic",
        "tablet", "capsule", "injection", "dentist", "gym", "fitness",
        "health", "medical", "diagnostic", "lab", "blood test",
    ],
    "Utilities": [
        "electricity", "water", "gas", "internet", "wifi", "broadband",
        "phone bill", "mobile bill", "recharge", "dth", "cable", "rent",
        "maintenance", "society", "emi",
    ],
    "Education": [
        "course", "book", "books", "fee", "fees", "tuition", "class",
        "coaching", "school", "college", "udemy", "coursera", "study",
        "exam", "stationery",
    ],
    "Travel": [
        "hotel", "hostel", "oyo", "makemytrip", "goibibo", "trip",
        "vacation", "holiday", "tour", "travel", "visa",
    ],
    "Personal": [
        "haircut", "salon", "barber", "spa", "grooming", "beauty",
        "laundry", "dry clean",
    ],
}

INCOME_KEYWORDS: list[str] = [
    "salary", "refund", "cashback", "received", "credited", "bonus",
    "interest", "dividend", "freelance", "payment received", "reimbursement",
    "stipend", "reward", "credit",
]

DEFAULT_CATEGORY = "Other"
