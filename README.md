# 🌿 FinWell — AI-Powered Student Financial Wellness Platform

A full-stack Software Engineering final project: a modern, MVC-architected web
application that helps university students track income and expenses, plan
monthly budgets, and receive **rule-based AI financial recommendations** — no
external ML/LLM API required.

---

## ✨ Features

- 🔐 **Authentication** — registration, secure login (bcrypt password hashing), sessions, logout, editable profile with picture upload
- 🟢 **Google Sign-In** — "Continue with Google" on login/register (optional; auto-hidden until `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are configured), auto-links to an existing email/password account with the same address
- 📊 **Dashboard** — all-time total balance, this month's income/expense/savings, financial health score gauge, budget usage bar, today's spending snapshot, savings goal progress, category pie chart, income vs. expense trend chart, recent transactions
- 💵 **Income Management** — full CRUD, search, date-range filter
- 🧾 **Expense Management** — full CRUD across 7 categories, search, category + date filters, plus a quick manual-entry row (category, amount, description, defaults to today) for small everyday spends like coke, biscuit or travel fare
- 🎯 **Monthly Budget Planner** — set a monthly budget; system auto-calculates spent, remaining, savings and usage %
- 📆 **Daily Budget Planner** — auto-splits the monthly budget into a daily spending allowance (or set a custom one), tracks today's spend against it, and projects how much you'll have left for daily expenses by month end, with a full day-by-day breakdown table
- 🔁 **Fixed Daily Expenses** — recurring day-to-day costs (Food, Travel Fare, etc.) logged as real expenses with one click instead of the full form, with a "Log All" shortcut and a flexible-budget-remaining-today figure
- 🧮 **Category Budgets** — envelope-style limits per expense category (Food, Transport, etc.), each tracked against actual spend for the month
- 🏆 **Savings Goal** — set a monthly savings target and track progress against actual income minus expenses, surfaced on both the Dashboard and Budget Planner
- 🤖 **Rule-Based AI Recommendation Engine** — a deterministic scoring + rules system that generates a 0–100 Financial Health Score and personalized advice (see [`services/aiEngine.js`](./services/aiEngine.js))
- 📄 **Reports** — monthly summary, PDF export (pdfkit), CSV export (json2csv), report history log
- 🌗 **Dark Mode**, 🔍 **Search & Filter**, 📤 **CSV Export**, 🖼️ **Profile Picture Upload**
- 💚 **Modern UI** — green/white glassmorphism SaaS-style dashboard, Bootstrap 5, Font Awesome, responsive sidebar navigation

---

## 🏗️ Architecture

The project follows the **MVC (Model-View-Controller)** pattern:

```
Routes  →  Controllers  →  Models  →  MySQL Database
                ↓
         Services (AI Engine)
                ↓
              Views (EJS)
```

- **Models** (`/models`) — pure data-access functions using parameterized SQL queries (mysql2/promise)
- **Controllers** (`/controllers`) — business/request logic, calling models and services
- **Views** (`/views`) — server-rendered EJS templates sharing a common layout + sidebar partial
- **Services** (`/services`) — the AI recommendation engine, decoupled from Express so it can be unit tested independently
- **Middleware** (`/middleware`) — authentication guard and file-upload handling

---

## 🧰 Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML5, CSS3, JavaScript, Bootstrap 5, Chart.js, Font Awesome |
| Backend | Node.js, Express.js (MVC) |
| Database | MySQL (mysql2) |
| Templating | EJS + express-ejs-layouts |
| Auth | bcryptjs + express-session |
| Reports | PDFKit (PDF), json2csv (CSV) |
| Uploads | Multer |

---

## 📁 Project Structure

```
student-financial-wellness/
├── config/
│   └── db.js                  # MySQL connection pool
├── controllers/
│   ├── authController.js
│   ├── dashboardController.js
│   ├── incomeController.js
│   ├── expenseController.js
│   ├── budgetController.js
│   ├── profileController.js
│   └── reportController.js
├── database/
│   └── schema.sql             # Full normalized DB schema + seed data
├── docs/
│   └── testing.md             # Unit/Integration/System/Acceptance test tables
├── middleware/
│   ├── auth.js                # requireAuth / redirectIfAuth
│   └── upload.js              # Multer profile picture config
├── models/
│   ├── userModel.js
│   ├── incomeModel.js
│   ├── expenseModel.js
│   ├── budgetModel.js
│   ├── recommendationModel.js
│   └── reportModel.js
├── public/
│   ├── css/style.css           # Custom green/white glassmorphism theme
│   ├── js/main.js              # Sidebar toggle, dark mode, confirmations, chart animation
│   └── images/
├── routes/
│   ├── authRoutes.js
│   ├── dashboardRoutes.js
│   ├── incomeRoutes.js
│   ├── expenseRoutes.js
│   ├── budgetRoutes.js
│   ├── reportRoutes.js
│   └── profileRoutes.js
├── services/
│   └── aiEngine.js             # Rule-based AI recommendation engine
├── uploads/profile/            # Uploaded profile pictures (gitignored)
├── views/
│   ├── partials/sidebar.ejs
│   ├── layout.ejs
│   ├── login.ejs
│   ├── register.ejs
│   ├── dashboard.ejs
│   ├── income.ejs
│   ├── expenses.ejs
│   ├── budget.ejs
│   ├── reports.ejs
│   ├── profile.ejs
│   └── 404.ejs
├── .env.example
├── .gitignore
├── package.json
├── server.js                   # App entry point
└── README.md
```

---

## 🚀 Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v16 or higher
- [MySQL](https://www.mysql.com/) v8 (or MariaDB equivalent)
- npm (comes with Node.js)

### 1. Install dependencies

```bash
cd student-financial-wellness
npm install
```

### 2. Set up the database

Create the database and all tables (with foreign keys, indexes, and a demo
seed account) by importing the provided SQL file:

```bash
mysql -u root -p < database/schema.sql
```

This creates a database named `student_financial_wellness` and seeds it with
a demo student account:

- **Email:** `demo@student.com`
- **Password:** `Demo@1234`

### 3. Configure environment variables

Copy the example environment file and fill in your local MySQL credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=change_this_to_a_long_random_secret_string
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=student_financial_wellness
```

### 4. (Optional) Enable Google Sign-In

The "Continue with Google" button is hidden automatically until these are
set — the app works fine without it.

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an **OAuth 2.0 Client ID** (Application type: **Web application**)
2. Add an **Authorized redirect URI**: `http://localhost:3000/auth/google/callback` (add your production URL's equivalent too, e.g. `https://your-app.onrender.com/auth/google/callback`)
3. Add to `.env`:

```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

A Google sign-in automatically links to an existing account if the email
already matches one created with a password.

### 5. Run the application

```bash
npm start
```

For development with auto-restart on file changes:

```bash
npm run dev
```

The app will be available at **http://localhost:3000**

---

## 🧠 How the AI Recommendation Engine Works

The engine (`services/aiEngine.js`) is a **rule-based expert system** — it does
not call any external AI/ML API. It works in two stages:

1. **Financial Health Score (0–100)** — computed from four weighted components:
   - Savings Rate (up to 40 pts)
   - Expense-to-Income Ratio (up to 20 pts)
   - Budget Discipline (up to 25 pts)
   - Category Balance / diversification (up to 15 pts)

2. **Recommendation Rules** — a set of conditional rules such as:
   - `IF expenses > income` → critical warning
   - `IF expenses < 70% of income` → congratulate the user
   - `IF savings rate < 20%` → recommend increasing savings
   - `IF entertainment > 30% of expenses` → recommend reducing entertainment
   - `IF food > 40% of expenses` → recommend reducing food expenses
   - `IF transport > 25% of expenses` → recommend public transportation
   - Plus additional budget-usage and category-specific nudges

Recommendations are sorted by severity (danger → warning → info → success) so
the most urgent advice always appears first, and every recommendation is
logged to the `recommendations` table for historical auditing.

---

## 🧪 Testing

See [`docs/testing.md`](./docs/testing.md) for the full Unit, Integration,
System, and Acceptance testing tables (41 documented test cases).

---

## 📸 Screenshots

> Add screenshots of your running application here after setup, for example:
>
> - `docs/screenshots/login.png` — Login page
> - `docs/screenshots/dashboard.png` — Dashboard with health score gauge and charts
> - `docs/screenshots/expenses.png` — Expense management table
> - `docs/screenshots/reports.png` — Reports page with PDF/CSV export
>
> Example markdown once added:
> ```markdown
> ![Dashboard](docs/screenshots/dashboard.png)
> ```

---

## 🔒 Security Notes

- Passwords are hashed with `bcryptjs` (10 salt rounds) — plaintext passwords are never stored.
- All database queries use parameterized statements to prevent SQL injection.
- Sessions use `httpOnly` cookies with a configurable secret and expiry.
- File uploads are restricted to image MIME types and a 2MB size limit.
- All CRUD operations verify `user_id` ownership before reading/writing a record.

---

## 📄 License

MIT — built for academic / educational purposes.
