# Software Testing Documentation
## AI-Powered Student Financial Wellness Platform

This document covers the four levels of testing performed on the system, following
standard Software Engineering practice: **Unit Testing**, **Integration Testing**,
**System Testing**, and **Acceptance Testing**.

---

## 1. Unit Testing

Unit tests target the smallest testable parts of the system in isolation — primarily
the pure functions inside `services/aiEngine.js`, since these contain the core
business logic (Financial Health Score calculation and rule-based recommendations).

| Test ID | Unit Under Test | Input | Expected Output | Status |
|---------|-----------------|-------|------------------|--------|
| UT-01 | `calculateHealthScore()` | income=20000, expense=10000, budget=15000, no dominant category | Score between 70–100 (healthy) | Pass |
| UT-02 | `calculateHealthScore()` | income=10000, expense=15000, budget=10000 | Score below 40 (poor — overspending) | Pass |
| UT-03 | `calculateHealthScore()` | income=0, expense=0 | Score = 0 (no data, safe fallback) | Pass |
| UT-04 | `generateRecommendations()` | expenses > income | Includes a `danger` severity "expenses exceed income" message | Pass |
| UT-05 | `generateRecommendations()` | savingsRate < 20% | Includes a `warning` "increase savings" message | Pass |
| UT-06 | `generateRecommendations()` | Entertainment share > 30% of expenses | Includes "reduce entertainment" recommendation | Pass |
| UT-07 | `generateRecommendations()` | Food share > 40% of expenses | Includes "reduce food expenses" recommendation | Pass |
| UT-08 | `generateRecommendations()` | Transport share > 25% of expenses | Includes "use public transportation" recommendation | Pass |
| UT-09 | `generateRecommendations()` | expenseRatio < 70% | Includes a `success` congratulatory message | Pass |
| UT-10 | `pct()` helper (internal) | whole = 0 | Returns 0 (no divide-by-zero crash) | Pass |
| UT-11 | Password hashing (`bcrypt.hash`) | plaintext password | Returns a 60-character bcrypt hash, never equal to plaintext | Pass |
| UT-12 | `UserModel.findByEmail()` | Non-existent email | Returns `null` | Pass |

---

## 2. Integration Testing

Integration tests verify that controllers, models and the database work together
correctly through the Express routing layer.

| Test ID | Scenario | Steps | Expected Result | Status |
|---------|----------|-------|------------------|--------|
| IT-01 | Register → auto-login | POST `/auth/register` with valid data | User row created in `users`; session set; redirected to `/dashboard` | Pass |
| IT-02 | Duplicate email registration | Register twice with the same email | Second attempt rejected with flash error, no duplicate row created | Pass |
| IT-03 | Login with wrong password | POST `/auth/login` with valid email, wrong password | Redirect to `/auth/login` with "Invalid email or password" | Pass |
| IT-04 | Add income persists and appears on dashboard | POST `/income`, then GET `/dashboard` | New income total reflected in Total Income stat card | Pass |
| IT-05 | Add expense updates category breakdown | POST `/expenses` with category=Food, then GET `/dashboard` | Pie chart data includes updated Food total | Pass |
| IT-06 | Delete expense removes DB row | POST `/expenses/:id/delete` | Row removed from `expense` table (foreign key cascade unaffected) | Pass |
| IT-07 | Budget upsert (same month twice) | POST `/budget` twice with same `monthYear` | Only one row per (user, month) due to unique key; second call updates it | Pass |
| IT-08 | AI engine reflects new data immediately | Add expense that pushes food share > 40%, reload dashboard | New "reduce food expenses" recommendation appears | Pass |
| IT-09 | PDF report download | GET `/reports/download/pdf?month=YYYY-MM` | Response has `Content-Type: application/pdf` and valid PDF bytes | Pass |
| IT-10 | CSV export | GET `/reports/download/csv?month=YYYY-MM` | Response has `Content-Type: text/csv` with correct row count | Pass |
| IT-11 | Unauthorized access blocked | GET `/dashboard` without a session | Redirected to `/auth/login` with flash error | Pass |
| IT-12 | Profile picture upload | POST `/profile/upload-picture` with a valid image | Image stored as a base64 data URI in `users.profile_picture` (not on disk, so it survives redeploys) | Pass |

---

## 3. System Testing

System tests validate the application as a whole, end-to-end, against the
functional requirements of the specification.

| Test ID | Requirement | Test Procedure | Expected Result | Status |
|---------|-------------|-----------------|------------------|--------|
| ST-01 | Full authentication flow | Register → Logout → Login → Logout | Each step succeeds and session state is correct at every stage | Pass |
| ST-02 | Dashboard aggregation accuracy | Seed known income/expense values, verify totals on dashboard match manual sum | Totals, savings and budget % are numerically correct | Pass |
| ST-03 | Expense CRUD end-to-end | Add, edit, then delete an expense via the UI modals | Table updates correctly after each action without page errors | Pass |
| ST-04 | Income CRUD end-to-end | Add, edit, then delete an income record via the UI modals | Table updates correctly after each action without page errors | Pass |
| ST-05 | Budget planner calculations | Set a budget, add expenses, confirm Remaining/Spent/Savings/Percentage | All four values match expected formulas | Pass |
| ST-06 | AI engine full rule sweep | Create data that triggers all 6 core rules simultaneously | All 6 expected recommendations appear, sorted by severity | Pass |
| ST-07 | Report generation & history | Generate a report, refresh page, confirm it appears in Report History | Row appears with correct month, totals and health score | Pass |
| ST-08 | Dark mode persistence | Toggle dark mode, log out, log back in | Dark mode preference is remembered (stored in `users.dark_mode`) | Pass |
| ST-09 | Search & filter | Search income/expenses by keyword and date range | Only matching rows are returned | Pass |
| ST-10 | Responsive layout | Resize browser to mobile width (375px) | Sidebar collapses behind a toggle button; layout remains usable | Pass |

---

## 4. Acceptance Testing (User Acceptance Criteria)

These tests confirm the system meets the university project brief from an
end-user's perspective.

| Test ID | Acceptance Criterion | Verification Method | Status |
|---------|----------------------|----------------------|--------|
| AT-01 | A student can create an account and log in securely | Manual walkthrough of registration/login | Pass |
| AT-02 | Dashboard clearly shows income, expense, savings, health score and budget | Visual inspection against requirements list | Pass |
| AT-03 | Student can manage income and expenses without needing direct DB access | Full CRUD tested through the UI only | Pass |
| AT-04 | AI engine gives understandable, actionable advice (not generic ML jargon) | Review of generated recommendation text | Pass |
| AT-05 | Student can download a professional monthly report as PDF | Open generated PDF, confirm formatting and content | Pass |
| AT-06 | The interface looks like a modern, professional SaaS product | Design review against green/white glassmorphism brief | Pass |
| AT-07 | The system works after following only the README instructions | Fresh clone + `npm install` + schema import + `npm start` | Pass |

---

## Notes on Test Execution

- Unit tests were exercised by calling `services/aiEngine.js` functions directly with
  representative fixture data covering edge cases (zero income, negative savings,
  category over-concentration).
- Integration and system tests were performed manually against a local MySQL
  instance seeded with `database/schema.sql`, using the demo account
  (`demo@student.com` / `Demo@1234`).
- All 12 + 12 + 10 + 7 = 41 test cases above passed in the final verification pass
  before submission.
