import AppShell from "@/components/app-shell";
import DashboardCharts from "@/components/dashboard/dashboard-charts";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BellRing,
  PiggyBank,
  Plus,
  WalletCards,
} from "lucide-react";
import Link from "next/link";

export const revalidate = 0;

type DashboardTransaction = {
  id: string;
  user_id: string;
  type: "income" | "expense";
  amount: number | string;
  category: string;
  note: string | null;
  transaction_date: string;
  created_at: string;
};

type DashboardBudget = {
  id: string;
  user_id: string;
  category: string | null;
  amount: number | string;
  month: number;
  year: number;
  created_at: string | null;
};

type RecentTransaction = {
  id: string;
  type: "income" | "expense";
  amount: number | string;
  category: string;
  note: string | null;
  transaction_date: string;
  created_at: string;
};

function formatMoney(value: number | string | null | undefined) {
  const numberValue = Number(value ?? 0);

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(numberValue);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getCurrentMonthDetails() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  return {
    now,
    month,
    year,
    monthStart: formatLocalDate(new Date(year, month - 1, 1)),
    monthEnd: formatLocalDate(new Date(year, month, 0)),
  };
}

function normalizeCategory(category: string | null | undefined) {
  return category?.trim() || "Uncategorized";
}

function getBudgetStatus(usedPercentage: number, hasBudget: boolean) {
  if (!hasBudget) return "none";
  if (usedPercentage >= 100) return "exceeded";
  if (usedPercentage >= 80) return "warning";
  return "safe";
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { now, month, year, monthStart, monthEnd } = getCurrentMonthDetails();

  const [
    transactionsResult,
    recentTransactionsResult,
    budgetsResult,
    profileResult,
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id, user_id, type, amount, category, note, transaction_date, created_at"
      )
      .eq("user_id", user.id)
      .gte("transaction_date", monthStart)
      .lte("transaction_date", monthEnd)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false }),

    supabase
      .from("transactions")
      .select("id, type, amount, category, note, transaction_date, created_at")
      .eq("user_id", user.id)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5),

    supabase
      .from("budgets")
      .select("id, user_id, category, amount, month, year, created_at")
      .eq("user_id", user.id)
      .eq("month", month)
      .eq("year", year)
      .order("category", { ascending: true }),

    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);

  if (transactionsResult.error) {
    throw new Error(transactionsResult.error.message);
  }

  if (recentTransactionsResult.error) {
    throw new Error(recentTransactionsResult.error.message);
  }

  if (budgetsResult.error) {
    throw new Error(budgetsResult.error.message);
  }

  const transactions =
    (transactionsResult.data as DashboardTransaction[] | null) ?? [];

  const recentTransactions =
    (recentTransactionsResult.data as RecentTransaction[] | null) ?? [];

  const budgets = (budgetsResult.data as DashboardBudget[] | null) ?? [];

  const totalIncome = transactions
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

  const totalExpenses = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

  const balance = totalIncome - totalExpenses;

  const monthlyBudget = budgets.reduce(
    (sum, budget) => sum + Number(budget.amount),
    0
  );

  const budgetUsed =
    monthlyBudget > 0 ? (totalExpenses / monthlyBudget) * 100 : 0;

  const alertType = getBudgetStatus(budgetUsed, monthlyBudget > 0);

  const expenseCategoryMap = new Map<string, number>();

  transactions
    .filter((transaction) => transaction.type === "expense")
    .forEach((transaction) => {
      const category = normalizeCategory(transaction.category);
      const currentAmount = expenseCategoryMap.get(category) ?? 0;

      expenseCategoryMap.set(category, currentAmount + Number(transaction.amount));
    });

  const expenseByCategory = Array.from(expenseCategoryMap.entries())
    .map(([category, amount]) => ({
      category,
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);

  const budgetUsageByCategory = budgets.map((budget) => {
    const category = normalizeCategory(budget.category);
    const budgetAmount = Number(budget.amount);
    const usedAmount = expenseCategoryMap.get(category) ?? 0;
    const percentage = budgetAmount > 0 ? (usedAmount / budgetAmount) * 100 : 0;

    return {
      category,
      budget: budgetAmount,
      used: usedAmount,
      remaining: budgetAmount - usedAmount,
      percentage,
      status: getBudgetStatus(percentage, budgetAmount > 0),
    };
  });

  const incomeExpenseData = [
    {
      name: "Income",
      amount: totalIncome,
    },
    {
      name: "Expenses",
      amount: totalExpenses,
    },
  ];

  const fullName =
    profileResult.data?.full_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "there";

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium text-emerald-400">
              Personal Expense Tracking
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Welcome back, {fullName}
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Monitor your income, expenses, remaining balance, category
              spending, and recent activity for the current month.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
            {new Intl.DateTimeFormat("en-PH", {
              month: "long",
              year: "numeric",
            }).format(now)}
          </div>
        </div>

        <div
          className={`mb-6 overflow-hidden rounded-3xl border shadow-2xl shadow-black/20 ${
            alertType === "exceeded"
              ? "border-red-500/30 bg-red-500/10"
              : alertType === "warning"
                ? "border-amber-500/30 bg-amber-500/10"
                : alertType === "none"
                  ? "border-sky-500/30 bg-sky-500/10"
                  : "border-emerald-500/30 bg-emerald-500/10"
          }`}
        >
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                  alertType === "exceeded"
                    ? "bg-red-500/20 text-red-200"
                    : alertType === "warning"
                      ? "bg-amber-500/20 text-amber-200"
                      : alertType === "none"
                        ? "bg-sky-500/20 text-sky-200"
                        : "bg-emerald-500/20 text-emerald-200"
                }`}
              >
                <BellRing className="h-5 w-5" />
              </div>

              <div>
                <h2
                  className={`font-semibold ${
                    alertType === "exceeded"
                      ? "text-red-100"
                      : alertType === "warning"
                        ? "text-amber-100"
                        : alertType === "none"
                          ? "text-sky-100"
                          : "text-emerald-100"
                  }`}
                >
                  {alertType === "exceeded"
                    ? "Budget limit exceeded"
                    : alertType === "warning"
                      ? "Budget usage warning"
                      : alertType === "none"
                        ? "No budget created yet"
                        : "Your spending is under control"}
                </h2>

                <p
                  className={`mt-1 text-sm ${
                    alertType === "exceeded"
                      ? "text-red-100/80"
                      : alertType === "warning"
                        ? "text-amber-100/80"
                        : alertType === "none"
                          ? "text-sky-100/80"
                          : "text-emerald-100/80"
                  }`}
                >
                  {alertType === "exceeded"
                    ? "Your expenses are already higher than your total monthly budget."
                    : alertType === "warning"
                      ? `You already used ${budgetUsed.toFixed(
                          0
                        )}% of your total budget. Review your spending before it exceeds the limit.`
                      : alertType === "none"
                        ? "Set category budgets to activate smarter budget monitoring and alerts."
                        : "You are still within your monthly budget range. Keep tracking your transactions regularly."}
                </p>
              </div>
            </div>

            <div
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                alertType === "exceeded"
                  ? "border-red-500/20 bg-red-500/10 text-red-200"
                  : alertType === "warning"
                    ? "border-amber-500/20 bg-amber-500/10 text-amber-200"
                    : alertType === "none"
                      ? "border-sky-500/20 bg-sky-500/10 text-sky-200"
                      : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
              }`}
            >
              {alertType === "none"
                ? "Action Needed"
                : `${budgetUsed.toFixed(0)}% Used`}
            </div>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <DashboardCard
            title="Total Income"
            value={formatMoney(totalIncome)}
            icon={<ArrowDownLeft className="h-5 w-5" />}
            helper="Income received this month"
          />

          <DashboardCard
            title="Total Expenses"
            value={formatMoney(totalExpenses)}
            icon={<ArrowUpRight className="h-5 w-5" />}
            helper="Expenses recorded this month"
            danger={totalExpenses > totalIncome && totalIncome > 0}
          />

          <DashboardCard
            title="Remaining Balance"
            value={formatMoney(balance)}
            icon={<PiggyBank className="h-5 w-5" />}
            helper="Income minus expenses"
            danger={balance < 0}
          />
        </section>

        <section className="mt-6">
          <DashboardCharts
            incomeExpenseData={incomeExpenseData}
            expenseByCategory={expenseByCategory}
            budgetUsageByCategory={budgetUsageByCategory}
            totalExpenses={totalExpenses}
            monthlyBudget={monthlyBudget}
            budgetUsed={budgetUsed}
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Recent Transactions
                </h2>
                <p className="text-sm text-slate-400">
                  Latest income and expense records
                </p>
              </div>

              <Link
                href="/transactions"
                className="text-sm font-medium text-emerald-300 hover:text-emerald-200"
              >
                View all
              </Link>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10">
              <div className="hidden grid-cols-4 bg-white/5 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400 md:grid">
                <span>Category / Source</span>
                <span>Type</span>
                <span>Date</span>
                <span className="text-right">Amount</span>
              </div>

              {recentTransactions.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-400">
                  No transactions yet. Add your first income or expense.
                </div>
              ) : (
                recentTransactions.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-3 border-t border-white/10 px-4 py-4 text-sm md:grid-cols-4 md:items-center"
                  >
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                        Category / Source
                      </p>
                      <span className="font-medium text-slate-200">
                        {item.category}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                        Type
                      </p>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                          item.type === "income"
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "bg-red-500/10 text-red-300"
                        }`}
                      >
                        {item.type}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                        Date
                      </p>
                      <span className="text-slate-400">
                        {formatDate(item.transaction_date)}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                        Amount
                      </p>
                      <span
                        className={`block font-semibold md:text-right ${
                          item.type === "income"
                            ? "text-emerald-400"
                            : "text-red-300"
                        }`}
                      >
                        {item.type === "income" ? "+" : "-"}
                        {formatMoney(item.amount)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <h2 className="text-lg font-semibold text-white">Quick Actions</h2>

            <p className="mt-1 text-sm text-slate-400">
              Manage your finances faster.
            </p>

            <div className="mt-5 grid gap-3">
              <Link
                href="/transactions"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                <Plus className="h-4 w-4" />
                Add Transaction
              </Link>

              <Link
                href="/budgets"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-slate-200 transition hover:bg-white/10"
              >
                Set Budget
              </Link>

              <Link
                href="/reports"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-slate-200 transition hover:bg-white/10"
              >
                View Reports
              </Link>
            </div>
          </section>
        </section>
      </div>
    </AppShell>
  );
}

function DashboardCard({
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
      <div className="mb-5 flex items-center justify-between">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
            danger
              ? "bg-red-500/10 text-red-300"
              : "bg-emerald-500/10 text-emerald-300"
          }`}
        >
          {icon}
        </div>
      </div>

      <p className="text-sm text-slate-400">{title}</p>
      <h2 className="mt-2 text-2xl font-bold text-white">{value}</h2>
      <p className="mt-2 text-xs text-slate-500">{helper}</p>
    </div>
  );
}