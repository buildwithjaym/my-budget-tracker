import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type ReportTransaction = {
  id: string;
  user_id: string;
  type: "income" | "expense";
  amount: number | string;
  category: string | null;
  note: string | null;
  transaction_date: string;
  created_at: string;
};

type ReportBudget = {
  id: string;
  user_id: string;
  category: string | null;
  amount: number | string;
  month: number;
  year: number;
  created_at: string;
};

type CategoryReportRow = {
  category: string;
  income: number;
  expense: number;
  budget: number;
  remaining: number | null;
  usedPercentage: number | null;
  status: "Safe" | "Warning" | "Exceeded" | "No Budget";
};

type CsvValue = string | number | null | undefined;

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
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

function escapeCsvValue(value: CsvValue) {
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

function getBudgetStatus(expense: number, budget: number) {
  if (budget <= 0) {
    return {
      status: "No Budget" as const,
      usedPercentage: null,
    };
  }

  const usedPercentage = (expense / budget) * 100;

  if (usedPercentage >= 100) {
    return {
      status: "Exceeded" as const,
      usedPercentage,
    };
  }

  if (usedPercentage >= 80) {
    return {
      status: "Warning" as const,
      usedPercentage,
    };
  }

  return {
    status: "Safe" as const,
    usedPercentage,
  };
}

function buildCsvReport({
  userDisplayName,
  month,
  year,
  transactions,
  budgets,
}: {
  userDisplayName: string;
  month: number;
  year: number;
  transactions: ReportTransaction[];
  budgets: ReportBudget[];
}) {
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
        status: statusDetails.status,
      };
    })
    .sort((a, b) => {
      if (b.expense !== a.expense) return b.expense - a.expense;
      return a.category.localeCompare(b.category);
    });

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

  const reportMonth = formatMonth(month, year);

  const summaryRows: CsvValue[][] = [
    ["Prepared For", userDisplayName],
    ["Report Month", reportMonth],
    ["Total Income", totalIncome.toFixed(2)],
    ["Total Expenses", totalExpenses.toFixed(2)],
    ["Total Budget", totalBudget.toFixed(2)],
    ["Net Balance", netBalance.toFixed(2)],
    [
      "Budget Usage",
      budgetUsagePercentage === null
        ? "No budget set"
        : `${budgetUsagePercentage.toFixed(0)}%`,
    ],
    ["Total Transactions", transactions.length],
    ["Income Transactions", incomeTransactions.length],
    ["Expense Transactions", expenseTransactions.length],
    ["Safe Budgets", safeBudgets],
    ["Warning Budgets", warningBudgets],
    ["Exceeded Budgets", exceededBudgets],
    ["Expense Categories Without Budget", noBudgetCategories],
    [],
  ];

  const categoryHeader: CsvValue[] = [
    "Category",
    "Income",
    "Expense",
    "Budget",
    "Remaining",
    "Used Percentage",
    "Status",
  ];

  const csvCategoryRows: CsvValue[][] = categoryRows.map((item) => [
    item.category,
    item.income.toFixed(2),
    item.expense.toFixed(2),
    item.budget > 0 ? item.budget.toFixed(2) : "No Budget",
    item.remaining === null ? "" : item.remaining.toFixed(2),
    item.usedPercentage === null ? "" : `${item.usedPercentage.toFixed(0)}%`,
    item.status,
  ]);

  const transactionHeader: CsvValue[] = [
    "Date",
    "Type",
    "Category",
    "Amount",
    "Note",
  ];

  const transactionRows: CsvValue[][] = transactions.map((transaction) => [
    transaction.transaction_date,
    transaction.type,
    transaction.category ?? "",
    Number(transaction.amount).toFixed(2),
    transaction.note ?? "",
  ]);

  const csvSections: CsvValue[][] = [
    ["MONTHLY FINANCIAL REPORT"],
    [],
    ["SUMMARY"],
    ...summaryRows,
    ["CATEGORY SUMMARY"],
    categoryHeader,
    ...csvCategoryRows,
    [],
    ["TRANSACTION RECORDS"],
    transactionHeader,
    ...transactionRows,
  ];

  return csvSections.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
}

export async function GET(request: NextRequest) {
  try {
    const monthParam = request.nextUrl.searchParams.get("month");
    const yearParam = request.nextUrl.searchParams.get("year");
    const accessToken = request.nextUrl.searchParams.get("access_token");

    const month = Number(monthParam);
    const year = Number(yearParam);

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return new NextResponse("Invalid or missing report month.", {
        status: 400,
      });
    }

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return new NextResponse("Invalid or missing report year.", {
        status: 400,
      });
    }

    if (!accessToken) {
      return new NextResponse("Missing access token.", {
        status: 401,
      });
    }

    const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseAnonKey = getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return new NextResponse("Invalid or expired access token.", {
        status: 401,
      });
    }

    const userDisplayName =
      typeof user.user_metadata?.full_name === "string" &&
      user.user_metadata.full_name.trim()
        ? user.user_metadata.full_name.trim()
        : user.email?.split("@")[0] ?? "user";

    const { monthStart, monthEnd } = getMonthRange(month, year);

    const { data: transactionData, error: transactionError } = await supabase
      .from("transactions")
      .select(
        "id, user_id, type, amount, category, note, transaction_date, created_at"
      )
      .eq("user_id", user.id)
      .gte("transaction_date", monthStart)
      .lte("transaction_date", monthEnd)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (transactionError) {
      throw transactionError;
    }

    const { data: budgetData, error: budgetError } = await supabase
      .from("budgets")
      .select("id, user_id, category, amount, month, year, created_at")
      .eq("user_id", user.id)
      .eq("month", month)
      .eq("year", year)
      .order("category", { ascending: true });

    if (budgetError) {
      throw budgetError;
    }

    const safeUserName = sanitizeFilename(userDisplayName);
    const filename = `${safeUserName}-report-${year}-${String(month).padStart(
      2,
      "0"
    )}.csv`;

    const csvContent = buildCsvReport({
      userDisplayName,
      month,
      year,
      transactions: (transactionData ?? []) as ReportTransaction[],
      budgets: (budgetData ?? []) as ReportBudget[],
    });

    return new NextResponse(`\uFEFF${csvContent}`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch (error) {
    return new NextResponse(
      error instanceof Error ? error.message : "Download failed.",
      {
        status: 500,
      }
    );
  }
}