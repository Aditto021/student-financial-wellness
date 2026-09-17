/**
 * services/aiEngine.js
 * -----------------------------------------------------------------
 * Rule-Based AI Recommendation Engine
 * -----------------------------------------------------------------
 * This module simulates an "intelligent" financial advisor without
 * using any external ML/LLM API. It analyzes a student's income,
 * expenses (by category) and budget, then applies a set of
 * weighted business rules to:
 *
 *   1. Compute a Financial Health Score (0-100).
 *   2. Generate a list of personalized, prioritized recommendations.
 *
 * The engine is intentionally implemented as pure, deterministic
 * functions so it is easy to unit test (see /docs/testing.md and
 * the corresponding test cases).
 * -----------------------------------------------------------------
 */

/**
 * Safely compute a percentage, guarding against division by zero.
 */
function pct(part, whole) {
  if (!whole || whole <= 0) return 0;
  return (part / whole) * 100;
}

/**
 * Compute the Financial Health Score (0-100).
 * The score is built from four weighted components:
 *   - Savings Rate       (40 points max)
 *   - Budget Discipline  (25 points max)
 *   - Expense/Income Ratio (20 points max)
 *   - Category Balance   (15 points max) - penalizes over-concentration
 */
function calculateHealthScore({ totalIncome, totalExpense, monthlyBudget, categoryTotals }) {
  // No data recorded at all yet — the "neutral default" components below
  // would otherwise add up to a misleadingly decent-looking score for an
  // account that hasn't tracked anything. Nothing to score yet.
  if (!totalIncome && !totalExpense) return 0;

  let score = 0;
  const savings = totalIncome - totalExpense;
  const savingsRate = pct(savings, totalIncome); // can be negative

  // 1) Savings rate component (40 pts): 0% savings = 0 pts, 30%+ savings = 40 pts
  const savingsComponent = Math.max(0, Math.min(40, (savingsRate / 30) * 40));
  score += savingsComponent;

  // 2) Expense/Income ratio component (20 pts): lower ratio is better
  const expenseRatio = pct(totalExpense, totalIncome); // e.g. 70 means spent 70% of income
  let ratioComponent;
  if (totalIncome <= 0) {
    ratioComponent = 0;
  } else if (expenseRatio <= 50) {
    ratioComponent = 20;
  } else if (expenseRatio >= 120) {
    ratioComponent = 0;
  } else {
    // Linear scale down from 20 pts at 50% to 0 pts at 120%
    ratioComponent = 20 - ((expenseRatio - 50) / 70) * 20;
  }
  score += Math.max(0, ratioComponent);

  // 3) Budget discipline component (25 pts): did the student stay within budget?
  let budgetComponent = 12.5; // neutral default if no budget was set
  if (monthlyBudget && monthlyBudget > 0) {
    const budgetUsage = pct(totalExpense, monthlyBudget);
    if (budgetUsage <= 80) {
      budgetComponent = 25;
    } else if (budgetUsage <= 100) {
      // scale 25 -> 15 between 80% and 100% usage
      budgetComponent = 25 - ((budgetUsage - 80) / 20) * 10;
    } else if (budgetUsage <= 130) {
      // scale 15 -> 0 between 100% and 130% usage (over budget)
      budgetComponent = 15 - ((budgetUsage - 100) / 30) * 15;
    } else {
      budgetComponent = 0;
    }
  }
  score += Math.max(0, budgetComponent);

  // 4) Category balance component (15 pts): penalize any single category
  //    dominating total spending (a sign of poor diversification/control)
  let balanceComponent = 15;
  if (totalExpense > 0 && categoryTotals && categoryTotals.length) {
    const maxCategoryShare = Math.max(
      ...categoryTotals.map((c) => pct(parseFloat(c.total), totalExpense))
    );
    if (maxCategoryShare > 70) {
      balanceComponent = 0;
    } else if (maxCategoryShare > 40) {
      // scale 15 -> 0 between 40% and 70% share
      balanceComponent = 15 - ((maxCategoryShare - 40) / 30) * 15;
    }
  }
  score += Math.max(0, balanceComponent);

  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Apply the rule set and generate a prioritized list of
 * personalized recommendations. Each recommendation includes:
 *   - message  : human readable advice
 *   - category : which financial area it relates to
 *   - severity : info | success | warning | danger (drives UI styling)
 *
 * Beyond the core category/budget checks, this also considers (when
 * the data is available — every new param is optional so existing
 * callers keep working unchanged):
 *   - month-over-month spending trend (incomeTrend / expenseTrend)
 *   - per-category envelope budgets (categoryBudgets)
 *   - a savings goal's pacing for the rest of the month (savingsGoal)
 *   - an emergency-fund check against the all-time balance (totalBalance)
 */
function generateRecommendations({
  totalIncome,
  totalExpense,
  monthlyBudget,
  categoryTotals,
  savingsGoal = null,
  totalBalance = null,
  incomeTrend = [],
  expenseTrend = [],
  categoryBudgets = []
}) {
  const recommendations = [];
  const savings = totalIncome - totalExpense;
  const savingsRate = pct(savings, totalIncome);
  const expenseRatio = pct(totalExpense, totalIncome);

  const catMap = {};
  (categoryTotals || []).forEach((c) => {
    catMap[c.category] = parseFloat(c.total);
  });

  const foodShare = pct(catMap['Food'] || 0, totalExpense);
  const transportShare = pct(catMap['Transport'] || 0, totalExpense);
  const entertainmentShare = pct(catMap['Entertainment'] || 0, totalExpense);
  const shoppingShare = pct(catMap['Shopping'] || 0, totalExpense);

  // --- Core rules from the specification -----------------------------

  // RULE: expenses > income -> critical warning
  if (totalIncome > 0 && totalExpense > totalIncome) {
    recommendations.push({
      message: `Your expenses (৳${totalExpense.toFixed(2)}) exceed your income (৳${totalIncome.toFixed(2)}). You are spending more than you earn — take immediate action to cut non-essential costs.`,
      category: 'Overall',
      severity: 'danger'
    });
  }

  // RULE: expenses < 70% of income -> congratulate
  if (totalIncome > 0 && expenseRatio < 70 && totalExpense <= totalIncome) {
    recommendations.push({
      message: `Great job! You're spending only ${expenseRatio.toFixed(1)}% of your income. Keep up this healthy financial discipline.`,
      category: 'Overall',
      severity: 'success'
    });
  }

  // RULE: savings < 20% -> recommend increasing savings
  if (totalIncome > 0 && savingsRate < 20) {
    recommendations.push({
      message: `Your savings rate is ${savingsRate.toFixed(1)}%, which is below the recommended 20%. Try to set aside a fixed amount right after receiving income before spending.`,
      category: 'Savings',
      severity: 'warning'
    });
  } else if (totalIncome > 0) {
    recommendations.push({
      message: `Excellent! You're saving ${savingsRate.toFixed(1)}% of your income, which meets or exceeds the recommended 20% savings benchmark.`,
      category: 'Savings',
      severity: 'success'
    });
  }

  // RULE: entertainment > 30% of expenses -> reduce entertainment
  if (entertainmentShare > 30) {
    recommendations.push({
      message: `Entertainment makes up ${entertainmentShare.toFixed(1)}% of your total spending. Consider reducing entertainment expenses to free up money for savings.`,
      category: 'Entertainment',
      severity: 'warning'
    });
  }

  // RULE: food > 40% of expenses -> reduce food expenses
  if (foodShare > 40) {
    recommendations.push({
      message: `Food spending accounts for ${foodShare.toFixed(1)}% of your expenses. Meal-prepping and cooking at home instead of ordering out can significantly reduce this.`,
      category: 'Food',
      severity: 'warning'
    });
  }

  // RULE: transport > 25% of expenses -> recommend public transportation
  if (transportShare > 25) {
    recommendations.push({
      message: `Transport costs are ${transportShare.toFixed(1)}% of your expenses. Switching to public transportation or carpooling could lower this significantly.`,
      category: 'Transport',
      severity: 'warning'
    });
  }

  // --- Additional intelligent rules for a richer engine ----------------

  // RULE: shopping > 20% -> mindful spending nudge
  if (shoppingShare > 20) {
    recommendations.push({
      message: `Shopping represents ${shoppingShare.toFixed(1)}% of your spending. Try a 24-hour rule before non-essential purchases to curb impulse buying.`,
      category: 'Shopping',
      severity: 'info'
    });
  }

  // RULE: budget usage checks
  if (monthlyBudget && monthlyBudget > 0) {
    const budgetUsage = pct(totalExpense, monthlyBudget);
    if (budgetUsage > 100) {
      recommendations.push({
        message: `You have exceeded your monthly budget by ${(budgetUsage - 100).toFixed(1)}%. Review your recent transactions and pause discretionary spending for the rest of the month.`,
        category: 'Budget',
        severity: 'danger'
      });
    } else if (budgetUsage > 85) {
      recommendations.push({
        message: `You've used ${budgetUsage.toFixed(1)}% of your monthly budget already. Slow down spending to avoid going over budget.`,
        category: 'Budget',
        severity: 'warning'
      });
    } else if (budgetUsage < 50) {
      recommendations.push({
        message: `You've only used ${budgetUsage.toFixed(1)}% of your monthly budget. You have healthy room — consider moving the difference into savings.`,
        category: 'Budget',
        severity: 'success'
      });
    }
  } else {
    recommendations.push({
      message: `You haven't set a monthly budget yet. Setting one helps you track spending limits and improves your Financial Health Score.`,
      category: 'Budget',
      severity: 'info'
    });
  }

  // RULE: no income recorded at all
  if (totalIncome === 0) {
    recommendations.push({
      message: `No income has been recorded yet. Add your income sources so the AI engine can generate accurate savings and budget insights.`,
      category: 'Overall',
      severity: 'info'
    });
  }

  // --- Trend-aware rules (month-over-month momentum) -------------------
  // Compare the last two fully-completed months (never the current,
  // still-in-progress one, which would unfairly look "low") so the
  // comparison is apples-to-apples.
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const completedExpenseMonths = (expenseTrend || []).filter((m) => m.month < currentMonth);
  if (completedExpenseMonths.length >= 2) {
    const last = completedExpenseMonths[completedExpenseMonths.length - 1];
    const prev = completedExpenseMonths[completedExpenseMonths.length - 2];
    const lastTotal = parseFloat(last.total);
    const prevTotal = parseFloat(prev.total);
    if (prevTotal > 0) {
      const change = pct(lastTotal - prevTotal, prevTotal);
      if (change >= 20) {
        recommendations.push({
          message: `Your spending in ${last.month} was ${change.toFixed(1)}% higher than ${prev.month} (৳${lastTotal.toFixed(2)} vs ৳${prevTotal.toFixed(2)}). Check whether this was a one-off expense or a new pattern worth reining in.`,
          category: 'Trend',
          severity: 'warning'
        });
      } else if (change <= -15) {
        recommendations.push({
          message: `You cut spending by ${Math.abs(change).toFixed(1)}% from ${prev.month} to ${last.month} (৳${prevTotal.toFixed(2)} → ৳${lastTotal.toFixed(2)}). That's real progress — keep the momentum going.`,
          category: 'Trend',
          severity: 'success'
        });
      }
    }
  }

  // --- Category budget (envelope) rules ---------------------------------
  (categoryBudgets || []).forEach((cb) => {
    const budgetAmount = parseFloat(cb.budget_amount);
    if (!budgetAmount || budgetAmount <= 0) return;
    const spent = catMap[cb.category] || 0;
    const usage = pct(spent, budgetAmount);
    if (usage > 100) {
      recommendations.push({
        message: `You've exceeded your ${cb.category} budget by ৳${(spent - budgetAmount).toFixed(2)} (${(usage - 100).toFixed(1)}% over the ৳${budgetAmount.toFixed(2)} you set aside). Consider pausing non-essential ${cb.category.toLowerCase()} purchases for the rest of the month.`,
        category: cb.category,
        severity: 'danger'
      });
    } else if (usage >= 90) {
      recommendations.push({
        message: `You're at ${usage.toFixed(1)}% of your ${cb.category} budget (৳${(budgetAmount - spent).toFixed(2)} left). One or two more purchases could tip you over.`,
        category: cb.category,
        severity: 'warning'
      });
    }
  });

  // --- Savings goal pacing ------------------------------------------------
  if (savingsGoal && savingsGoal > 0) {
    const savings = totalIncome - totalExpense;
    if (savings >= savingsGoal) {
      recommendations.push({
        message: `You've already reached your ৳${savingsGoal.toFixed(2)} savings goal for this month with ৳${(savings - savingsGoal).toFixed(2)} to spare. Consider raising next month's target.`,
        category: 'Savings Goal',
        severity: 'success'
      });
    } else {
      const now = new Date();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daysLeft = Math.max(1, daysInMonth - now.getDate() + 1);
      const shortfall = savingsGoal - savings;
      const neededPerDay = shortfall / daysLeft;
      recommendations.push({
        message: `You're ৳${shortfall.toFixed(2)} short of your ৳${savingsGoal.toFixed(2)} savings goal. Setting aside about ৳${neededPerDay.toFixed(2)}/day for the remaining ${daysLeft} day(s) of the month would get you there.`,
        category: 'Savings Goal',
        severity: savings < 0 ? 'danger' : 'info'
      });
    }
  }

  // --- Emergency fund check (all-time balance vs. typical monthly spend) -
  if (totalBalance !== null && completedExpenseMonths.length >= 1) {
    const avgMonthlyExpense = completedExpenseMonths.reduce((sum, m) => sum + parseFloat(m.total), 0) / completedExpenseMonths.length;
    if (avgMonthlyExpense > 0) {
      const monthsCovered = totalBalance / avgMonthlyExpense;
      if (totalBalance < 0) {
        recommendations.push({
          message: `Your all-time balance is negative (৳${totalBalance.toFixed(2)}) — you've spent more than you've earned overall. This is the top priority to fix before anything else.`,
          category: 'Emergency Fund',
          severity: 'danger'
        });
      } else if (monthsCovered < 1) {
        recommendations.push({
          message: `Your all-time balance (৳${totalBalance.toFixed(2)}) covers less than a month of your typical spending (৳${avgMonthlyExpense.toFixed(2)}/month). Building a small buffer — even one month's worth — protects you from surprise costs.`,
          category: 'Emergency Fund',
          severity: 'info'
        });
      } else if (monthsCovered >= 3) {
        recommendations.push({
          message: `Your all-time balance of ৳${totalBalance.toFixed(2)} covers about ${monthsCovered.toFixed(1)} months of your typical spending — a solid safety cushion. Well done.`,
          category: 'Emergency Fund',
          severity: 'success'
        });
      }
    }
  }

  return recommendations;
}

/**
 * Main entry point used by controllers: runs the full analysis
 * and returns both the health score and the recommendation list.
 */
function analyze({
  totalIncome,
  totalExpense,
  monthlyBudget,
  categoryTotals,
  savingsGoal = null,
  totalBalance = null,
  incomeTrend = [],
  expenseTrend = [],
  categoryBudgets = []
}) {
  const healthScore = calculateHealthScore({ totalIncome, totalExpense, monthlyBudget, categoryTotals });
  const recommendations = generateRecommendations({
    totalIncome,
    totalExpense,
    monthlyBudget,
    categoryTotals,
    savingsGoal,
    totalBalance,
    incomeTrend,
    expenseTrend,
    categoryBudgets
  });

  // Sort so danger > warning > info > success (most urgent advice first)
  const severityOrder = { danger: 0, warning: 1, info: 2, success: 3 };
  recommendations.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return { healthScore, recommendations };
}

module.exports = {
  calculateHealthScore,
  generateRecommendations,
  analyze
};
