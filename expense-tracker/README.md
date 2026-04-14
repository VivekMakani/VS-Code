# 💳 ExpenseTracker

A comprehensive **personal monthly expense tracking web app** built with React. Import CSV bank statements from Chase, Bank of America, Capital One, or American Express — transactions are auto-categorized using a configurable rule engine, split calculations track your share of shared expenses, and an interactive dashboard gives you full visibility into your spending.

**All data is stored locally in your browser. No account, no backend, no subscription — ever.**

---

## ✨ Features

### 📥 Raw Import — CSV Bank Statement Importer
- Drag-and-drop or paste CSV files exported directly from your bank
- Supports **Chase**, **Bank of America**, **Capital One**, and **American Express** out of the box (different column formats and sign conventions handled automatically)
- Import preview table — review all rows before committing
- **Duplicate detection** using fuzzy description matching — suspected duplicates are unchecked by default
- Import multiple banks into the same ledger without overwriting existing transactions
- Each transaction retains its source bank label

### ⚙️ Rulebook — Smart Auto-Categorization Engine
- **89 pre-built vendor rules** covering: Walmart, Amazon, McDonald's, Starbucks, Shell, Kroger, Netflix, Spotify, Uber, Delta, CVS, Walgreens, Zelle, Venmo, and dozens more
- **Multi-keyword rules** — one rule can match multiple patterns (e.g. `WM SUPERCENTER`, `WAL-MART`, `WALMART.COM` all route to the same category)
- Three match types per keyword: **Contains**, **Starts With**, **Exact Match**
- **Priority system** — when multiple rules match, the one with the lowest priority number wins
- Fully editable: add, edit, delete, enable/disable any rule
- **16 default categories** with subcategories (Groceries, Food & Dining, Shopping, Auto & Transport, Utilities, Healthcare, Entertainment, Travel, Subscriptions, Personal Care, Education, Home & Garden, Technology, Transfers, Income, Uncategorized)
- Add custom categories and subcategories with colors and emoji icons
- **Bank column mapping viewer** — shows how each bank's CSV columns are interpreted

### 📋 Unified Ledger — Master Transaction Register
- Every imported transaction in one place, regardless of which bank it came from
- **Inline category editing** — change category/subcategory directly in the table row
- **"Save as Rule?" prompt** — after manually categorizing a transaction, a toast asks if you'd like to save it as a Rulebook rule for future imports. The rule form opens pre-filled with the raw description, category, and subcategory
- **Inline split editing** — per transaction:
  - **Full** — 100% is your expense
  - **÷N** — split evenly between N people (÷2, ÷3, ÷4, ÷5, ÷6)
  - **Custom $** — enter your exact dollar share
- My Share and Split Savings columns auto-calculate
- **Inline notes** per transaction
- Color-coded rows: red = uncategorized, yellow = duplicate, orange = large transaction, green = credit/refund
- Filter by: month, category, bank, transaction type, uncategorized only, or free-text search
- Bulk select and delete
- **Re-Categorize All** button — re-applies all current Rulebook rules to existing transactions
- **Add Manual Transaction** — log cash purchases or anything not from a bank CSV
- **Export to CSV** — download the filtered view

### 📊 Dashboard — Spending Insights
- **Month selector** — view any month or all-time
- **Monthly snapshot cards**: Budget, Total Spent (My Share), Remaining Budget, Safe to Spend per Day
- Color-coded budget status: 🟢 On Track / 🟡 Caution (>75%) / 🔴 Over Budget
- **Affordability Insight Panel**:
  - Daily spend rate
  - Projected month-end total
  - Projected surplus or deficit
  - Narrative: *"At your current pace, you will exceed your budget by $234 by month end. You have $18/day left to spend safely."*
- **Category Breakdown**: interactive donut/pie chart + ranked table with percentages
- **Monthly Bar Chart** — last 6 months, gross vs. my share
- **12-Month Trend Line** — rolling spending history
- **Top 10 Largest Expenses** for the selected period
- **Recurring Expenses Detector** — automatically identifies vendors appearing in 2+ months, with average monthly cost
- **Split Savings Summary** — total saved this month and year-to-date through expense splitting
- **Year-to-Date Summary** — total gross, total my share, total split savings, total credits/refunds, transaction count
- Uncategorized transaction alert with quick link to filter the Ledger

---

## 🚀 Getting Started

### Option A — Run Locally (Development)

```bash
# 1. Clone the repo
git clone https://github.com/VivekMakani/VS-Code.git
cd VS-Code/expense-tracker

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```
Open **http://localhost:5173** in your browser.

---

### Option B — Open the Built App Directly (No Server Needed)

```bash
cd expense-tracker
npm run build
```
Then open `expense-tracker/dist/index.html` directly in your browser — no server required.

---

### Option C — GitHub Pages (Live URL)

The app auto-deploys to GitHub Pages via GitHub Actions whenever you push to `main`.

After the first push:
1. Go to your repo on GitHub
2. **Settings → Pages → Source → select the `gh-pages` branch → Save**
3. Your app will be live at:
   ```
   https://VivekMakani.github.io/VS-Code/
   ```

You can also trigger a manual deploy from **Actions → Deploy to GitHub Pages → Run workflow**.

---

## 📖 How to Use

### Step 1 — Export a CSV from your bank

| Bank | How to Export |
|---|---|
| **Chase** | Accounts → Account Activity → Download Account Activity → CSV |
| **Bank of America** | Accounts → Transactions → Download → CSV Format |
| **Capital One** | Transactions → Download Transactions → CSV |
| **American Express** | Statements & Activity → Download → CSV |

### Step 2 — Import it

1. Go to **Raw Import**
2. Select your bank
3. Drag-and-drop the CSV file (or click to browse, or paste the text)
4. Review the preview — duplicates are flagged in yellow and unchecked
5. Click **Import Transactions**

### Step 3 — Review the Ledger

- Any transaction that didn't match a rule is highlighted red as **Uncategorized**
- Use the category dropdowns inline to fix them
- When you manually set a category, a toast will ask **"Add to Rulebook?"** — click it to save a rule so next month's import is automatic
- Adjust the **Split** column for any shared expenses

### Step 4 — Check the Dashboard

- Select the current month from the month picker
- Review your budget status, daily spend rate, and affordability projection
- Click any category in the pie chart to see its subcategory breakdown
- Check the **Recurring Expenses** panel to spot subscriptions

---

## 💡 Tips & Tricks

**Multi-keyword rules:** When adding a rule for a vendor like Walmart, add all its variations in one rule:
```
WM SUPERCENTER    → Contains
WAL-MART          → Contains  
WALMART.COM       → Contains
WALMART GAS       → Contains
```
All route to the same category. No need for four separate rules.

**Split expenses:** After a dinner with friends, set the split to `÷3` (or whichever number of people). Your "My Share" column updates instantly and the Dashboard only counts your share — not the full bill.

**Re-Categorize All:** After adding new rules in the Rulebook, go to the Ledger and click **Re-Categorize All** to apply them to all previously imported transactions.

**Manual transactions:** Use **Add Manual** in the Ledger for cash purchases, peer-to-peer payments, or anything you didn't pay by card.

---

## 🗂 Project Structure

```
expense-tracker/
├── public/                  Static assets (favicon)
├── src/
│   ├── constants/           Enums: banks, match types, split types, storage keys
│   ├── models/              Seed data: 89 default rules, 16 categories
│   ├── services/
│   │   ├── bankProfiles/    CSV column maps for Chase, BofA, Capital One, AmEx
│   │   ├── rulesEngine.js   Multi-keyword OR matching with priority
│   │   ├── csvNormalizer.js Converts raw CSV rows to canonical format
│   │   ├── splitCalculator.js  Full / ÷N / Custom $ math
│   │   ├── dashboardAggregator.js  Monthly buckets, category totals, YTD
│   │   ├── duplicateDetector.js    Fuzzy Levenshtein duplicate detection
│   │   └── csvExporter.js   Download filtered ledger as CSV
│   ├── store/
│   │   └── StorageContext.jsx  React Context + useReducer, persists to localStorage
│   ├── hooks/
│   │   ├── useCsvImport.js  5-phase import state machine (IDLE→PARSING→PREVIEW→COMMITTING→DONE)
│   │   └── useDashboardData.js  Memoized aggregations for all dashboard panels
│   ├── components/
│   │   ├── common/          Modal, ConfirmDialog, EmptyState
│   │   └── rulebook/        RuleFormModal (shared between Rulebook and Ledger)
│   ├── pages/
│   │   ├── DashboardPage.jsx
│   │   ├── RulebookPage.jsx
│   │   ├── RawImportPage.jsx
│   │   └── LedgerPage.jsx
│   ├── layouts/             RootLayout with sticky top nav
│   └── styles/              CSS custom properties + component styles
├── .github/workflows/       Auto-deploy to GitHub Pages on push to main
├── vite.config.js
└── package.json
```

---

## 🛠 Tech Stack

| Technology | Purpose |
|---|---|
| [React 19](https://react.dev) | UI framework |
| [Vite 8](https://vite.dev) | Build tool & dev server |
| [React Router v7](https://reactrouter.com) | Client-side navigation (HashRouter for static hosting) |
| [Recharts](https://recharts.org) | Bar, line, and pie/donut charts |
| [PapaParse](https://www.papaparse.com) | CSV parsing |
| `localStorage` | All data persistence — no backend required |

---

## 💾 Data Storage

All data is stored in your browser's `localStorage` under these keys:

| Key | Contents |
|---|---|
| `exp_transactions` | All imported and manual transactions |
| `exp_rules` | Vendor categorization rules |
| `exp_categories` | Category and subcategory definitions |
| `exp_settings` | Budget, default split, thresholds |
| `exp_import_batches` | Import history log |

**Your data never leaves your browser.** To move data to another device, use the **Export CSV** button in the Ledger.

---

## ⚠️ Notes

- **GitHub Pages URL** will be at the subdirectory `/VS-Code/` — the HashRouter handles this correctly
- Data lives in the browser that first populated it — opening on a different browser or device starts fresh
- The app is designed for desktop use; a mobile-responsive redesign is a planned future improvement

---

## 📄 License

Personal use. Feel free to fork and adapt for your own needs.
