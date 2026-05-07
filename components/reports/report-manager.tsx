"use client";

import type { ReportBudget, ReportTransaction } from "@/app/reports/page";
import { supabase } from "@/lib/supabase/client";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type CategoryReportRow = {
  category: string;
  income: number;
  expense: number;
  budget: number;
  remaining: number | null;
  usedPercentage: number | null;
  progressValue: number;
  status: "Safe" | "Warning" | "Exceeded" | "No Budget";
};

declare global {
  interface Window {
    median?: {
      share?: {
        downloadFile?: (options: { url: string; open?: boolean }) => void;
      };
    };
  }
}

const monthOptions = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

function formatMoney(value: number | string) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonthRange(month: number, year: number) {
  return {
    monthStart: formatLocalDate(new Date(year, month - 1, 1)),
    monthEnd: formatLocalDate(new Date(year, month, 0)),
  };
}

function formatMonth(month: number, year: number) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function normalizeCategory(category: string | null | undefined) {
  return category?.trim() || "Uncategorized";
}

function escapeCsvValue(value: string | number | null | undefined) {
  const stringValue = String(value ?? "");
  const escaped = stringValue.replaceAll('"', '""');

  return `"${escaped}"`;
}

function sanitizeFilename(value: string) {
  const safeValue = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return safeValue || "user";
}

function isMedianDownloadAvailable() {
  return (
    typeof window !== "undefined" &&
    typeof window.median?.share?.downloadFile === "function"
  );
}

function browserDownloadCsv(filename: string, csvContent: string) {
  const blob = new Blob([`\uFEFF${csvContent}`], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

async function downloadCsv({
  filename,
  csvContent,
  month,
  year,
}: {
  filename: string;
  csvContent: string;
  month: number;
  year: number;
}) {
  if (!isMedianDownloadAvailable()) {
    browserDownloadCsv(filename, csvContent);
    return;
  }

  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session?.access_token) {
    throw new Error("Please log in again before downloading your report.");
  }

  const downloadUrl = new URL("/api/reports/export", window.location.origin);

  downloadUrl.searchParams.set("month", String(month));
  downloadUrl.searchParams.set("year", String(year));
  downloadUrl.searchParams.set("access_token", data.session.access_token);

  window.median!.share!.downloadFile!({
    url: downloadUrl.toString(),
    open: false,
  });
}

function getBudgetStatus(expense: number, budget: number) {
  if (budget <= 0) {
    return {
      status: "No Budget" as const,
      usedPercentage: null,
      progressValue: 0,
    };
  }

  const usedPercentage = (expense / budget) * 100;

  if (usedPercentage >= 100) {
    return {
      status: "Exceeded" as const,
      usedPercentage,
      progressValue: 100,
    };
  }

  if (usedPercentage >= 80) {
    return {
      status: "Warning" as const,
      usedPercentage,
      progressValue: usedPercentage,
    };
  }

  return {
    status: "Safe" as const,
    usedPercentage,
    progressValue: usedPercentage,
  };
}

function getCurrentYear() {
  return new Date().getFullYear();
}

export default function ReportManager({
  userId,
  userDisplayName,
  initialMonth,
  initialYear,
  initialTransactions,
  initialBudgets,
}: {
  userId: string;
  userDisplayName: string;
  initialMonth: number;
  initialYear: number;
  initialTransactions: ReportTransaction[];
  initialBudgets: ReportBudget[];
}) {
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedYear, setSelectedYear] = useState(initialYear);

  const [transactions, setTransactions] =
    useState<ReportTransaction[]>(initialTransactions);
  const [budgets, setBudgets] = useState<ReportBudget[]>(initialBudgets);

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const currentYear = getCurrentYear();

  const yearOptions = useMemo(() => {
    const years = new Set<number>();

    years.add(currentYear);
    years.add(initialYear);
    years.add(selectedYear);

    budgets.forEach((budget) => {
      years.add(Number(budget.year));
    });

    transactions.forEach((transaction) => {
      years.add(new Date(transaction.transaction_date).getFullYear());
    });

    return Array.from(years).sort((a, b) => b - a);
  }, [budgets, transactions, currentYear, initialYear, selectedYear]);

  const reportSummary = useMemo(() => {
    const incomeTransactions = transactions.filter(
      (transaction) => transaction.type === "income"
    );

    const expenseTransactions = transactions.filter(
      (transaction) => transaction.type === "expense"
    );

    const totalIncome = incomeTransactions.reduce(
      (sum, transaction) => sum + Number(transaction.amount),
      0
    );

    const totalExpenses = expenseTransactions.reduce(
      (sum, transaction) => sum + Number(transaction.amount),
      0
    );

    const totalBudget = budgets.reduce(
      (sum, budget) => sum + Number(budget.amount),
      0
    );

    const netBalance = totalIncome - totalExpenses;

    const categoryMap = new Map<
      string,
      {
        category: string;
        income: number;
        expense: number;
        budget: number;
      }
    >();

    for (const transaction of transactions) {
      const category = normalizeCategory(transaction.category);

      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          category,
          income: 0,
          expense: 0,
          budget: 0,
        });
      }

      const current = categoryMap.get(category)!;

      if (transaction.type === "income") {
        current.income += Number(transaction.amount);
      }

      if (transaction.type === "expense") {
        current.expense += Number(transaction.amount);
      }
    }

    for (const budget of budgets) {
      const category = normalizeCategory(budget.category);

      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          category,
          income: 0,
          expense: 0,
          budget: 0,
        });
      }

      categoryMap.get(category)!.budget += Number(budget.amount);
    }

    const categoryRows: CategoryReportRow[] = Array.from(categoryMap.values())
      .map((item) => {
        const statusDetails = getBudgetStatus(item.expense, item.budget);

        return {
          category: item.category,
          income: item.income,
          expense: item.expense,
          budget: item.budget,
          remaining: item.budget > 0 ? item.budget - item.expense : null,
          usedPercentage: statusDetails.usedPercentage,
          progressValue: statusDetails.progressValue,
          status: statusDetails.status,
        };
      })
      .sort((a, b) => {
        if (b.expense !== a.expense) return b.expense - a.expense;
        return a.category.localeCompare(b.category);
      });

    const highestExpenseCategory =
      categoryRows.find((item) => item.expense > 0) ?? null;

    const highestIncomeCategory =
      [...categoryRows]
        .filter((item) => item.income > 0)
        .sort((a, b) => b.income - a.income)[0] ?? null;

    const exceededBudgets = categoryRows.filter(
      (item) => item.status === "Exceeded"
    ).length;

    const warningBudgets = categoryRows.filter(
      (item) => item.status === "Warning"
    ).length;

    const safeBudgets = categoryRows.filter(
      (item) => item.status === "Safe"
    ).length;

    const noBudgetCategories = categoryRows.filter(
      (item) => item.status === "No Budget" && item.expense > 0
    ).length;

    const budgetUsagePercentage =
      totalBudget > 0 ? (totalExpenses / totalBudget) * 100 : null;

    return {
      incomeTransactions,
      expenseTransactions,
      totalIncome,
      totalExpenses,
      totalBudget,
      netBalance,
      budgetUsagePercentage,
      transactionCount: transactions.length,
      incomeCount: incomeTransactions.length,
      expenseCount: expenseTransactions.length,
      categoryRows,
      highestExpenseCategory,
      highestIncomeCategory,
      exceededBudgets,
      warningBudgets,
      safeBudgets,
      noBudgetCategories,
    };
  }, [transactions, budgets]);

  async function loadReport(month: number, year: number) {
    setLoading(true);

    const toastId = toast.loading("Loading report...", {
      description: `Fetching transactions and budgets for ${formatMonth(
        month,
        year
      )}.`,
    });

    const { monthStart, monthEnd } = getMonthRange(month, year);

    const { data: transactionData, error: transactionError } = await supabase
      .from("transactions")
      .select(
        "id, user_id, type, amount, category, note, transaction_date, created_at"
      )
      .eq("user_id", userId)
      .gte("transaction_date", monthStart)
      .lte("transaction_date", monthEnd)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (transactionError) {
      toast.error("Report loading failed", {
        id: toastId,
        description: transactionError.message,
      });
      setLoading(false);
      return;
    }

    const { data: budgetData, error: budgetError } = await supabase
      .from("budgets")
      .select("id, user_id, category, amount, month, year, created_at")
      .eq("user_id", userId)
      .eq("month", month)
      .eq("year", year)
      .order("category", { ascending: true });

    if (budgetError) {
      toast.error("Report loading failed", {
        id: toastId,
        description: budgetError.message,
      });
      setLoading(false);
      return;
    }

    setTransactions((transactionData ?? []) as ReportTransaction[]);
    setBudgets((budgetData ?? []) as ReportBudget[]);
    setSelectedMonth(month);
    setSelectedYear(year);

    toast.success("Report loaded", {
      id: toastId,
      description: `${formatMonth(month, year)} report is ready.`,
    });

    setLoading(false);
  }

  async function handleMonthChange(month: number) {
    await loadReport(month, selectedYear);
  }

  async function handleYearChange(year: number) {
    await loadReport(selectedMonth, year);
  }

  async function handleDownloadReport() {
    setDownloading(true);

    const reportMonth = formatMonth(selectedMonth, selectedYear);
    const safeUserName = sanitizeFilename(userDisplayName);
    const filename = `${safeUserName}-report-${selectedYear}-${String(
      selectedMonth
    ).padStart(2, "0")}.csv`;

    const toastId = toast.loading("Preparing download...", {
      description: `Generating ${filename}.`,
    });

    try {
      await new Promise((resolve) => setTimeout(resolve, 700));

      const summaryRows = [
        ["Prepared For", userDisplayName],
        ["Report Month", reportMonth],
        ["Total Income", reportSummary.totalIncome.toFixed(2)],
        ["Total Expenses", reportSummary.totalExpenses.toFixed(2)],
        ["Total Budget", reportSummary.totalBudget.toFixed(2)],
        ["Net Balance", reportSummary.netBalance.toFixed(2)],
        [
          "Budget Usage",
          reportSummary.budgetUsagePercentage === null
            ? "No budget set"
            : `${reportSummary.budgetUsagePercentage.toFixed(0)}%`,
        ],
        ["Total Transactions", reportSummary.transactionCount],
        ["Income Transactions", reportSummary.incomeCount],
        ["Expense Transactions", reportSummary.expenseCount],
        ["Safe Budgets", reportSummary.safeBudgets],
        ["Warning Budgets", reportSummary.warningBudgets],
        ["Exceeded Budgets", reportSummary.exceededBudgets],
        ["Expense Categories Without Budget", reportSummary.noBudgetCategories],
        [],
      ];

      const categoryHeader = [
        "Category",
        "Income",
        "Expense",
        "Budget",
        "Remaining",
        "Used Percentage",
        "Status",
      ];

      const categoryRows = reportSummary.categoryRows.map((item) => [
        item.category,
        item.income.toFixed(2),
        item.expense.toFixed(2),
        item.budget > 0 ? item.budget.toFixed(2) : "No Budget",
        item.remaining === null ? "" : item.remaining.toFixed(2),
        item.usedPercentage === null
          ? ""
          : `${item.usedPercentage.toFixed(0)}%`,
        item.status,
      ]);

      const transactionHeader = [
        "Date",
        "Type",
        "Category",
        "Amount",
        "Note",
      ];

      const transactionRows = transactions.map((transaction) => [
        transaction.transaction_date,
        transaction.type,
        transaction.category,
        Number(transaction.amount).toFixed(2),
        transaction.note ?? "",
      ]);

      const csvSections = [
        ["LOMONGGO MONTHLY FINANCIAL REPORT"],
        [],
        ["SUMMARY"],
        ...summaryRows,
        ["CATEGORY SUMMARY"],
        categoryHeader,
        ...categoryRows,
        [],
        ["TRANSACTION RECORDS"],
        transactionHeader,
        ...transactionRows,
      ];

      const csvContent = csvSections
        .map((row) => row.map(escapeCsvValue).join(","))
        .join("\n");

      await downloadCsv({
        filename,
        csvContent,
        month: selectedMonth,
        year: selectedYear,
      });

      toast.success("Download successful", {
        id: toastId,
        description: `${filename} has been downloaded.`,
      });
    } catch (error) {
      toast.error("Download failed", {
        id: toastId,
        description:
          error instanceof Error
            ? error.message
            : "Something went wrong while generating the report.",
      });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-emerald-400">
            Reports & Summary
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Reports
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Review income, expenses, budgets, spending categories, and download
            a monthly financial report.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadReport}
          disabled={downloading || loading}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {downloading ? "Downloading..." : "Download Report"}
        </button>
      </div>

      {(reportSummary.warningBudgets > 0 ||
        reportSummary.exceededBudgets > 0 ||
        reportSummary.noBudgetCategories > 0) && (
        <div className="mb-6 rounded-3xl border border-yellow-500/20 bg-yellow-500/10 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-yellow-500/10 text-yellow-300">
              <AlertTriangle className="h-5 w-5" />
            </div>

            <div>
              <h2 className="font-semibold text-yellow-100">
                Report attention needed
              </h2>
              <p className="mt-1 text-sm text-yellow-200/80">
                {reportSummary.warningBudgets > 0 &&
                  `${reportSummary.warningBudgets} budget near the limit. `}
                {reportSummary.exceededBudgets > 0 &&
                  `${reportSummary.exceededBudgets} budget exceeded. `}
                {reportSummary.noBudgetCategories > 0 &&
                  `${reportSummary.noBudgetCategories} expense category without a budget. `}
                Review {formatMonth(selectedMonth, selectedYear)} before
                downloading your report.
              </p>
            </div>
          </div>
        </div>
      )}

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Income"
          value={formatMoney(reportSummary.totalIncome)}
          helper={`${reportSummary.incomeCount} income record${
            reportSummary.incomeCount === 1 ? "" : "s"
          }`}
          icon={<TrendingUp className="h-5 w-5" />}
        />

        <SummaryCard
          title="Total Expenses"
          value={formatMoney(reportSummary.totalExpenses)}
          helper={`${reportSummary.expenseCount} expense record${
            reportSummary.expenseCount === 1 ? "" : "s"
          }`}
          icon={<TrendingDown className="h-5 w-5" />}
          danger={reportSummary.totalExpenses > reportSummary.totalIncome}
        />

        <SummaryCard
          title="Net Balance"
          value={formatMoney(reportSummary.netBalance)}
          helper="Income minus expenses"
          icon={<Wallet className="h-5 w-5" />}
          danger={reportSummary.netBalance < 0}
        />

        <SummaryCard
          title="Total Budget"
          value={formatMoney(reportSummary.totalBudget)}
          helper={
            reportSummary.budgetUsagePercentage === null
              ? "No budget set"
              : `${reportSummary.budgetUsagePercentage.toFixed(0)}% used`
          }
          icon={<FileText className="h-5 w-5" />}
        />
      </section>

      <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Monthly Report Filter
            </h2>
            <p className="text-sm text-slate-400">
              Currently showing {formatMonth(selectedMonth, selectedYear)}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthChange(Number(e.target.value))}
              disabled={loading || downloading}
              className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-60"
            >
              {monthOptions.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              disabled={loading || downloading}
              className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-60"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleDownloadReport}
              disabled={downloading || loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {downloading ? "Preparing..." : "Export CSV"}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl lg:col-span-2">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white">
              Category Summary
            </h2>
            <p className="text-sm text-slate-400">
              Budget usage is calculated from expense transactions only.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="hidden grid-cols-6 bg-white/5 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400 md:grid">
              <span>Category</span>
              <span className="text-right">Income</span>
              <span className="text-right">Expense</span>
              <span className="text-right">Budget</span>
              <span>Progress</span>
              <span>Status</span>
            </div>

            {reportSummary.categoryRows.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-slate-400">
                  <CalendarDays className="h-6 w-6" />
                </div>

                <h3 className="mt-4 font-semibold text-white">
                  No report data
                </h3>

                <p className="mt-1 text-sm text-slate-400">
                  Add transactions or budgets to generate a report.
                </p>
              </div>
            ) : (
              reportSummary.categoryRows.map((item) => (
                <div
                  key={item.category}
                  className="grid gap-4 border-t border-white/10 px-4 py-5 text-sm md:grid-cols-6 md:items-center"
                >
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                      Category
                    </p>
                    <p className="font-semibold text-white">{item.category}</p>
                    {item.remaining !== null && (
                      <p
                        className={`mt-1 text-xs ${
                          item.remaining < 0
                            ? "text-red-300"
                            : "text-slate-500"
                        }`}
                      >
                        Remaining: {formatMoney(item.remaining)}
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                      Income
                    </p>
                    <p className="font-medium text-emerald-300 md:text-right">
                      {formatMoney(item.income)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                      Expense
                    </p>
                    <p className="font-medium text-red-300 md:text-right">
                      {formatMoney(item.expense)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                      Budget
                    </p>
                    <p className="font-medium text-slate-200 md:text-right">
                      {item.budget > 0 ? formatMoney(item.budget) : "No budget"}
                    </p>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                        Progress
                      </p>

                      <p className="text-xs font-semibold text-slate-300">
                        {item.usedPercentage === null
                          ? "—"
                          : `${item.usedPercentage.toFixed(0)}%`}
                      </p>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full transition-all ${
                          item.status === "Exceeded"
                            ? "bg-red-500"
                            : item.status === "Warning"
                              ? "bg-yellow-500"
                              : item.status === "Safe"
                                ? "bg-emerald-500"
                                : "bg-slate-600"
                        }`}
                        style={{ width: `${item.progressValue}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                      Status
                    </p>

                    <StatusBadge status={item.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <h2 className="text-lg font-semibold text-white">
              Report Insight
            </h2>

            {reportSummary.highestExpenseCategory ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-slate-400">
                  Highest spending category
                </p>
                <h3 className="mt-2 text-2xl font-bold text-white">
                  {reportSummary.highestExpenseCategory.category}
                </h3>
                <p className="mt-2 text-sm text-red-300">
                  {formatMoney(reportSummary.highestExpenseCategory.expense)}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">
                No expenses recorded for this month.
              </p>
            )}

            {reportSummary.highestIncomeCategory && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-slate-400">
                  Highest income category
                </p>
                <h3 className="mt-2 text-2xl font-bold text-white">
                  {reportSummary.highestIncomeCategory.category}
                </h3>
                <p className="mt-2 text-sm text-emerald-300">
                  {formatMoney(reportSummary.highestIncomeCategory.income)}
                </p>
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-slate-400">Recommendation</p>
              <p className="mt-2 text-sm text-slate-300">
                Check categories marked Warning, Exceeded, or No Budget before
                setting next month&apos;s budget limits.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <h2 className="text-lg font-semibold text-white">
              Download Includes
            </h2>

            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <DownloadItem label="Prepared user name" />
              <DownloadItem label="Monthly summary" />
              <DownloadItem label="Income and expense totals" />
              <DownloadItem label="Category budget usage" />
              <DownloadItem label="Transaction records" />
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  helper,
  icon,
  danger = false,
}: {
  title: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border p-5 shadow-2xl shadow-black/20 backdrop-blur-xl ${
        danger
          ? "border-red-500/20 bg-red-500/[0.04]"
          : "border-white/10 bg-white/[0.04]"
      }`}
    >
      <div
        className={`mb-5 flex h-11 w-11 items-center justify-center rounded-2xl ${
          danger
            ? "bg-red-500/10 text-red-300"
            : "bg-emerald-500/10 text-emerald-300"
        }`}
      >
        {icon}
      </div>

      <p className="text-sm text-slate-400">{title}</p>
      <h2 className="mt-2 text-2xl font-bold text-white">{value}</h2>
      <p className="mt-2 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: CategoryReportRow["status"] }) {
  if (status === "Exceeded") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300">
        <AlertTriangle className="h-4 w-4" />
        Exceeded
      </span>
    );
  }

  if (status === "Warning") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-300">
        <AlertTriangle className="h-4 w-4" />
        Warning
      </span>
    );
  }

  if (status === "Safe") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
        <CheckCircle2 className="h-4 w-4" />
        Safe
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
      No Budget
    </span>
  );
}

function DownloadItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <CheckCircle2 className="h-4 w-4 text-emerald-300" />
      <span>{label}</span>
    </div>
  );
}