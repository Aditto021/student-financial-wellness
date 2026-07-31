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
 */
function generateRecommendations({ totalIncome, totalExpense, monthlyBudget, categoryTotals }) {
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

  return recommendations;
}

/**
 * Main entry point used by controllers: runs the full analysis
 * and returns both the health score and the recommendation list.
 */
function analyze({ totalIncome, totalExpense, monthlyBudget, categoryTotals }) {
  const healthScore = calculateHealthScore({ totalIncome, totalExpense, monthlyBudget, categoryTotals });
  const recommendations = generateRecommendations({ totalIncome, totalExpense, monthlyBudget, categoryTotals });

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
