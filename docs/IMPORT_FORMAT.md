# Import File Format

How to prepare a file for importing actual spending into budgy-ting.

---

## What the app needs

Your file must have **rows of transactions** with at least these columns:

| Column | Required? | What it is |
|--------|-----------|------------|
| **Date** | Yes | When the transaction happened |
| **Amount** | Yes | How much was spent or earned |
| **Description** | At least one of these | What the transaction was (e.g. "Pick n Pay Greenacres") |
| **Category** | At least one of these | A grouping label (e.g. "Groceries", "Rent") |

You need either a Description column, a Category column, or both. The more info you provide, the better the auto-matching works.

---

## Accepted file types

### CSV (recommended)

Standard comma-separated values. First row must be column headers.

```csv
Date,Description,Amount,Category
2026-01-02,Woolworths Food,-1250.00,Groceries
2026-01-02,Netflix Subscription,-199.00,Entertainment
2026-01-03,Salary Deposit,25000.00,Income
2026-01-05,Engen Fuel,-850.50,Transport
2026-01-07,Pick n Pay,-643.20,Groceries
2026-01-10,Vodacom Airtime,-299.00,Utilities
2026-01-12,Landlord Transfer,-8500.00,Rent
2026-01-15,Freelance Payment,5000.00,Income
2026-01-18,Mr Price Clothing,-450.00,Clothing
2026-01-20,City Power Prepaid,-780.00,Utilities
```

### JSON

An array of objects. Each object is one transaction.

```json
[
  { "date": "2026-01-02", "description": "Woolworths Food", "amount": -1250.00, "category": "Groceries" },
  { "date": "2026-01-02", "description": "Netflix Subscription", "amount": -199.00, "category": "Entertainment" },
  { "date": "2026-01-03", "description": "Salary Deposit", "amount": 25000.00, "category": "Income" },
  { "date": "2026-01-05", "description": "Engen Fuel", "amount": -850.50, "category": "Transport" }
]
```

---

## Column details

### Date formats

The app auto-detects these formats:

- `YYYY-MM-DD` — 2026-01-15 (ISO standard, works best)
- `DD/MM/YYYY` — 15/01/2026
- `MM/DD/YYYY` — 01/15/2026
- `DD-MM-YYYY` — 15-01-2026
- `YYYY/MM/DD` — 2026/01/15

If auto-detection picks the wrong format, you can change it manually in Step 2 of the import wizard.

### Amounts

- **Negative numbers** = money going out (expenses): `-1250.00`
- **Positive numbers** = money coming in (income): `25000.00`
- Currency symbols are stripped automatically (R, $, €, £, ¥, ₹)
- Commas in numbers are handled: `1,250.00` works
- Parentheses for negatives work: `(1250.00)` = `-1250.00`

### Column header names

The app auto-detects columns by looking for these keywords in headers:

| Column | Recognized header names |
|--------|------------------------|
| Date | date, transaction date, trans date, posting date |
| Amount | amount, debit, value, total |
| Category | category, type, group |
| Description | description, desc, memo, reference, narrative, details |

If your headers don't match these, you can manually assign columns in Step 2.

---

## Tips

- **One transaction per row** — don't combine multiple purchases into one row
- **Keep it simple** — the app handles basic CSV well; avoid merged cells, subtotals, or summary rows that banks sometimes add
- **Clean up first** — remove any header/footer text your bank adds (like "Statement for account ending 1234")
- **Consistent dates** — use the same date format for every row

---

## Ask an AI to convert your bank statement

If your bank gives you a PDF or a weirdly formatted CSV, you can ask an AI (like ChatGPT or Claude) to convert it. Copy and paste this prompt along with your data:

~~~
Convert the following bank statement data into a CSV file with exactly these columns:

Date,Description,Amount,Category

Rules:
- Date format: YYYY-MM-DD
- Amount: negative for expenses (money out), positive for income (money in)
- Description: the merchant or transaction name, cleaned up
- Category: your best guess at a category (e.g. Groceries, Transport, Rent, Utilities, Entertainment, Dining, Insurance, Medical, Income, Savings)
- Remove any summary rows, totals, or account headers
- One transaction per row
- Output only the CSV, no explanation

Here is my bank statement data:

[PASTE YOUR DATA HERE]
~~~
