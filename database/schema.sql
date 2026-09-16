-- ==================================================================
-- Student Financial Wellness Platform
-- Complete Normalized MySQL Database Schema
-- ==================================================================

DROP DATABASE IF EXISTS student_financial_wellness;
CREATE DATABASE student_financial_wellness CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE student_financial_wellness;

-- ------------------------------------------------------------------
-- Table: users
-- ------------------------------------------------------------------
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    university VARCHAR(150) DEFAULT NULL,
    student_id VARCHAR(50) DEFAULT NULL,
    profile_picture VARCHAR(255) DEFAULT NULL,
    dark_mode TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------------
-- Table: income
-- ------------------------------------------------------------------
CREATE TABLE income (
    income_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    source VARCHAR(100) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    income_date DATE NOT NULL,
    notes VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_income_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------------
-- Table: expense
-- ------------------------------------------------------------------
CREATE TABLE expense (
    expense_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    category ENUM('Food','Transport','Education','Entertainment','Shopping','Medical','Others') NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    expense_date DATE NOT NULL,
    description VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_expense_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------------
-- Table: budget
-- ------------------------------------------------------------------
CREATE TABLE budget (
    budget_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    month_year CHAR(7) NOT NULL COMMENT 'Format: YYYY-MM',
    monthly_budget DECIMAL(12,2) NOT NULL,
    daily_budget DECIMAL(12,2) DEFAULT NULL COMMENT 'Optional custom daily spending allowance; auto-derived from monthly_budget when NULL',
    savings_goal DECIMAL(12,2) DEFAULT NULL COMMENT 'Optional target amount the student wants to save this month',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_budget_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_month (user_id, month_year)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------
-- Table: category_budget
-- Per-category monthly spending limits (envelope-style budgeting),
-- e.g. "Food: ৳5000 this month". Independent of the overall
-- monthly_budget on the `budget` table.
-- ------------------------------------------------------------------
CREATE TABLE category_budget (
    category_budget_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    month_year CHAR(7) NOT NULL COMMENT 'Format: YYYY-MM',
    category ENUM('Food','Transport','Education','Entertainment','Shopping','Medical','Others') NOT NULL,
    budget_amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_category_budget_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_month_category (user_id, month_year, category)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------
-- Table: recurring_expense
-- Fixed/recurring daily costs (e.g. Food, Travel Fare) that a
-- student can log with one click each day instead of re-entering
-- the full expense form every time.
-- ------------------------------------------------------------------
CREATE TABLE recurring_expense (
    recurring_expense_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    label VARCHAR(100) NOT NULL,
    category ENUM('Food','Transport','Education','Entertainment','Shopping','Medical','Others') NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    last_logged_date DATE DEFAULT NULL COMMENT 'Date this was last logged as a real expense; used to show today''s status',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_recurring_expense_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------------
-- Table: recommendations (AI engine output log)
-- ------------------------------------------------------------------
CREATE TABLE recommendations (
    recommendation_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    message VARCHAR(500) NOT NULL,
    category VARCHAR(50) NOT NULL,
    severity ENUM('info','warning','success','danger') NOT NULL DEFAULT 'info',
    health_score INT NOT NULL DEFAULT 0,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_recommendation_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------------
-- Table: reports (generated monthly report log)
-- ------------------------------------------------------------------
CREATE TABLE reports (
    report_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    month_year CHAR(7) NOT NULL COMMENT 'Format: YYYY-MM',
    total_income DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_expense DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_savings DECIMAL(12,2) NOT NULL DEFAULT 0,
    health_score INT NOT NULL DEFAULT 0,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reports_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------------
-- Indexes for performance
-- ------------------------------------------------------------------
CREATE INDEX idx_income_user_date ON income(user_id, income_date);
CREATE INDEX idx_expense_user_date ON expense(user_id, expense_date);
CREATE INDEX idx_expense_category ON expense(category);
CREATE INDEX idx_budget_user_month ON budget(user_id, month_year);
CREATE INDEX idx_category_budget_user_month ON category_budget(user_id, month_year);
CREATE INDEX idx_recurring_expense_user ON recurring_expense(user_id);
CREATE INDEX idx_recommendation_user ON recommendations(user_id);
CREATE INDEX idx_reports_user_month ON reports(user_id, month_year);

-- ------------------------------------------------------------------
-- Sample seed data (optional - a demo account)
-- Password for demo account below is: Demo@1234
-- Hash generated with bcryptjs (10 salt rounds)
-- ------------------------------------------------------------------
INSERT INTO users (full_name, email, password_hash, university, student_id)
VALUES (
  'Demo Student',
  'demo@student.com',
  '$2a$10$lq5nDnALm.MLbqueDWpL5OGwce2hWwiw9QmTy3NpqcMDHdAdhpoZO',
  'Demo University',
  'STU-2026-001'
);

INSERT INTO income (user_id, source, amount, income_date, notes) VALUES
(1, 'Part-time Job', 15000.00, '2026-07-01', 'Monthly salary'),
(1, 'Family Support', 5000.00, '2026-07-01', 'Allowance from parents'),
(1, 'Scholarship', 3000.00, '2026-07-05', 'Merit scholarship');

INSERT INTO expense (user_id, category, amount, expense_date, description) VALUES
(1, 'Food', 4500.00, '2026-07-03', 'Groceries and meals'),
(1, 'Transport', 2200.00, '2026-07-04', 'Bus pass'),
(1, 'Education', 3000.00, '2026-07-06', 'Books and supplies'),
(1, 'Entertainment', 1800.00, '2026-07-10', 'Movies and outings'),
(1, 'Shopping', 1500.00, '2026-07-12', 'Clothes'),
(1, 'Medical', 700.00, '2026-07-15', 'Pharmacy'),
(1, 'Others', 500.00, '2026-07-18', 'Miscellaneous');

INSERT INTO budget (user_id, month_year, monthly_budget) VALUES
(1, '2026-07', 18000.00);
