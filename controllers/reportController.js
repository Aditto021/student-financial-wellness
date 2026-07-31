/**
 * controllers/reportController.js
 * -----------------------------------------------------------------
 * Generates monthly financial reports:
 *   - On-screen summary (income / expense / savings)
 *   - Downloadable PDF report (via pdfkit)
 *   - CSV export of transactions (via json2csv)
 * -----------------------------------------------------------------
 */

const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');

const IncomeModel = require('../models/incomeModel');
const ExpenseModel = require('../models/expenseModel');
const BudgetModel = require('../models/budgetModel');
const UserModel = require('../models/userModel');
const ReportModel = require('../models/reportModel');
const aiEngine = require('../services/aiEngine');

function currentMonthYear() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

async function buildReportData(userId, monthYear) {
  const [totalIncome, totalExpense, categoryTotals, budgetRow, incomes, expenses] = await Promise.all([
    IncomeModel.getTotal(userId, monthYear),
    ExpenseModel.getTotal(userId, monthYear),
    ExpenseModel.getTotalsByCategory(userId, monthYear),
    BudgetModel.findByMonth(userId, monthYear),
    IncomeModel.findAllByUser(userId, { startDate: `${monthYear}-01`, endDate: `${monthYear}-31` }),
    ExpenseModel.findAllByUser(userId, { startDate: `${monthYear}-01`, endDate: `${monthYear}-31` })
  ]);

  const monthlyBudget = budgetRow ? parseFloat(budgetRow.monthly_budget) : 0;
  const totalSavings = totalIncome - totalExpense;
  const { healthScore, recommendations } = aiEngine.analyze({
    totalIncome,
    totalExpense,
    monthlyBudget,
    categoryTotals
  });

  return {
    monthYear,
    totalIncome,
    totalExpense,
    totalSavings,
    monthlyBudget,
    categoryTotals,
    healthScore,
    recommendations,
    incomes,
    expenses
  };
}

const reportController = {
  async index(req, res) {
    const userId = req.session.userId;
    const monthYear = req.query.month || currentMonthYear();

    try {
      const data = await buildReportData(userId, monthYear);
      const history = await ReportModel.findAllByUser(userId);

      res.render('reports', {
        title: 'Financial Reports',
        ...data,
        history
      });
    } catch (err) {
      console.error('Report index error:', err);
      req.flash('error', 'Unable to generate report.');
      res.redirect('/dashboard');
    }
  },

  async generate(req, res) {
    const userId = req.session.userId;
    const { monthYear } = req.body;

    try {
      const data = await buildReportData(userId, monthYear);
      await ReportModel.create(userId, {
        monthYear,
        totalIncome: data.totalIncome,
        totalExpense: data.totalExpense,
        totalSavings: data.totalSavings,
        healthScore: data.healthScore
      });
      req.flash('success', `Report for ${monthYear} generated and saved to history.`);
      res.redirect(`/reports?month=${monthYear}`);
    } catch (err) {
      console.error('Report generate error:', err);
      req.flash('error', 'Failed to generate report.');
      res.redirect('/reports');
    }
  },

  async downloadPdf(req, res) {
    const userId = req.session.userId;
    const monthYear = req.query.month || currentMonthYear();

    try {
      const user = await UserModel.findById(userId);
      const data = await buildReportData(userId, monthYear);

      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="financial-report-${monthYear}.pdf"`);
      doc.pipe(res);

      // Header
      doc.fillColor('#1b8a4c').fontSize(22).font('Helvetica-Bold').text('Student Financial Wellness Platform', { align: 'center' });
      doc.moveDown(0.3);
      doc.fillColor('#333').fontSize(14).font('Helvetica').text(`Monthly Financial Report — ${monthYear}`, { align: 'center' });
      doc.moveDown(1);
      doc.strokeColor('#1b8a4c').lineWidth(2).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      // Student info
      doc.fontSize(11).fillColor('#000');
      doc.text(`Student Name: ${user.full_name}`);
      doc.text(`Email: ${user.email}`);
      if (user.university) doc.text(`University: ${user.university}`);
      if (user.student_id) doc.text(`Student ID: ${user.student_id}`);
      doc.moveDown(1);

      // Summary section
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#1b8a4c').text('Financial Summary');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica').fillColor('#000');
      doc.text(`Total Income:        ৳ ${data.totalIncome.toFixed(2)}`);
      doc.text(`Total Expense:       ৳ ${data.totalExpense.toFixed(2)}`);
      doc.text(`Total Savings:       ৳ ${data.totalSavings.toFixed(2)}`);
      doc.text(`Monthly Budget:      ৳ ${data.monthlyBudget.toFixed(2)}`);
      doc.text(`Financial Health Score: ${data.healthScore} / 100`);
      doc.moveDown(1);

      // Expense by category
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#1b8a4c').text('Expense Breakdown by Category');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica').fillColor('#000');
      if (data.categoryTotals.length === 0) {
        doc.text('No expenses recorded for this month.');
      } else {
        data.categoryTotals.forEach((c) => {
          doc.text(`${c.category}: ৳ ${parseFloat(c.total).toFixed(2)}`);
        });
      }
      doc.moveDown(1);

      // AI Recommendations
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#1b8a4c').text('AI Recommendations');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica').fillColor('#000');
      if (data.recommendations.length === 0) {
        doc.text('No specific recommendations at this time. Keep up the good work!');
      } else {
        data.recommendations.forEach((r, i) => {
          doc.text(`${i + 1}. [${r.category}] ${r.message}`);
          doc.moveDown(0.3);
        });
      }

      doc.moveDown(1);
      doc.fontSize(9).fillColor('#888').text(
        `Generated on ${new Date().toLocaleString()} by the Student Financial Wellness Platform AI Engine.`,
        { align: 'center' }
      );

      doc.end();
    } catch (err) {
      console.error('PDF generation error:', err);
      req.flash('error', 'Failed to generate PDF report.');
      res.redirect('/reports');
    }
  },

  async exportCsv(req, res) {
    const userId = req.session.userId;
    const monthYear = req.query.month || currentMonthYear();

    try {
      const data = await buildReportData(userId, monthYear);

      const rows = [
        ...data.incomes.map((i) => ({
          Type: 'Income',
          Category: i.source,
          Amount: i.amount,
          Date: i.income_date,
          Notes: i.notes || ''
        })),
        ...data.expenses.map((e) => ({
          Type: 'Expense',
          Category: e.category,
          Amount: e.amount,
          Date: e.expense_date,
          Notes: e.description || ''
        }))
      ].sort((a, b) => new Date(a.Date) - new Date(b.Date));

      const parser = new Parser({ fields: ['Type', 'Category', 'Amount', 'Date', 'Notes'] });
      const csv = parser.parse(rows);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="transactions-${monthYear}.csv"`);
      res.send(csv);
    } catch (err) {
      console.error('CSV export error:', err);
      req.flash('error', 'Failed to export CSV.');
      res.redirect('/reports');
    }
  }
};

module.exports = reportController;
