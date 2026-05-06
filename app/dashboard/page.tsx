import AppShell from "@/components/app-shell";
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

export const revalidate = 30;

type DashboardSummary = {
  total_income: number | string | null;
  total_expenses: number | string | null;
  balance: number | string | null;
  monthly_budget: number | string | null;
  budget_used: number | string | null;
  alert_type: "none" | "safe" | "warning" | "exceeded" | string;
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

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [summaryResult, transactionsResult, profileResult] = await Promise.all([
    supabase.rpc("get_dashboard_summary", {
      target_month: month,
      target_year: year,
    }),
    supabase.rpc("get_recent_transactions", {
      limit_count: 5,
    }),
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
  ]);

  if (summaryResult.error) {
    throw new Error(summaryResult.error.message);
  }

  if (transactionsResult.error) {
    throw new Error(transactionsResult.error.message);
  }

  const summaryData = summaryResult.data as DashboardSummary[] | null;
  const recentTransactions =
    (transactionsResult.data as RecentTransaction[] | null) ?? [];

  const summary = summaryData?.[0];

  const totalIncome = Number(summary?.total_income ?? 0);
  const totalExpenses = Number(summary?.total_expenses ?? 0);
  const balance = Number(summary?.balance ?? 0);
  const monthlyBudget = Number(summary?.monthly_budget ?? 0);
  const budgetUsed = Number(summary?.budget_used ?? 0);
  const alertType = summary?.alert_type ?? "none";

  const fullName = profileResult.data?.full_name ?? "there";

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
              Monitor your income, expenses, monthly budget, and spending alerts
              for the current month.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
            {new Intl.DateTimeFormat("en-PH", {
              month: "long",
              year: "numeric",
            }).format(now)}
          </div>
        </div>

        {alertType !== "safe" && alertType !== "none" && (
          <div
            className={`mb-6 rounded-3xl border p-5 shadow-2xl shadow-black/20 ${
              alertType === "exceeded"
                ? "border-red-500/30 bg-red-500/10 text-red-100"
                : "border-amber-500/30 bg-amber-500/10 text-amber-100"
            }`}
          >
            <div className="flex gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                <BellRing className="h-5 w-5" />
              </div>

              <div>
                <h2 className="font-semibold">
                  {alertType === "exceeded"
                    ? "Budget exceeded"
                    : "Budget warning"}
                </h2>

                <p className="mt-1 text-sm opacity-90">
                  {alertType === "exceeded"
                    ? "You have already spent more than your monthly budget."
                    : `You have used ${budgetUsed.toFixed(
                        0
                      )}% of your monthly budget.`}
                </p>
              </div>
            </div>
          </div>
        )}

        {alertType === "none" && (
          <div className="mb-6 rounded-3xl border border-sky-500/30 bg-sky-500/10 p-5 text-sky-100 shadow-2xl shadow-black/20">
            <div className="flex gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                <WalletCards className="h-5 w-5" />
              </div>

              <div>
                <h2 className="font-semibold">No budget set yet</h2>
                <p className="mt-1 text-sm opacity-90">
                  Set a monthly budget to activate budget alerts.
                </p>
              </div>
            </div>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardCard
            title="Total Income"
            value={formatMoney(totalIncome)}
            icon={<ArrowDownLeft className="h-5 w-5" />}
            helper="Money received this month"
          />

          <DashboardCard
            title="Total Expenses"
            value={formatMoney(totalExpenses)}
            icon={<ArrowUpRight className="h-5 w-5" />}
            helper="Money spent this month"
          />

          <DashboardCard
            title="Remaining Balance"
            value={formatMoney(balance)}
            icon={<PiggyBank className="h-5 w-5" />}
            helper="Income minus expenses"
          />

          <DashboardCard
            title="Monthly Budget"
            value={formatMoney(monthlyBudget)}
            icon={<WalletCards className="h-5 w-5" />}
            helper={
              monthlyBudget > 0 ? `${budgetUsed.toFixed(0)}% used` : "Not set"
            }
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Budget Usage
                </h2>
                <p className="text-sm text-slate-400">
                  Monthly spending progress
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  budgetUsed >= 100
                    ? "bg-red-500/10 text-red-300"
                    : budgetUsed >= 80
                    ? "bg-amber-500/10 text-amber-300"
                    : "bg-emerald-500/10 text-emerald-300"
                }`}
              >
                {monthlyBudget > 0 ? `${budgetUsed.toFixed(0)}%` : "No budget"}
              </span>
            </div>

            <div className="h-4 overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full transition-all ${
                  budgetUsed >= 100
                    ? "bg-red-500"
                    : budgetUsed >= 80
                    ? "bg-amber-400"
                    : "bg-emerald-500"
                }`}
                style={{
                  width: `${
                    monthlyBudget > 0 ? Math.min(budgetUsed, 100) : 0
                  }%`,
                }}
              />
            </div>

            <div className="mt-4 flex justify-between text-sm text-slate-400">
              <span>{formatMoney(totalExpenses)} spent</span>
              <span>{formatMoney(monthlyBudget)} budget</span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
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
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
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
            <div className="grid grid-cols-4 bg-white/5 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">
              <span>Category</span>
              <span>Type</span>
              <span>Date</span>
              <span className="text-right">Amount</span>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                No transactions yet. Add your first income or expense.
              </div>
            ) : (
              recentTransactions.map((item: RecentTransaction) => (
                <div
                  key={item.id}
                  className="grid grid-cols-4 border-t border-white/10 px-4 py-4 text-sm"
                >
                  <span className="font-medium text-slate-200">
                    {item.category}
                  </span>

                  <span className="capitalize text-slate-400">
                    {item.type}
                  </span>

                  <span className="text-slate-400">
                    {formatDate(item.transaction_date)}
                  </span>

                  <span
                    className={`text-right font-semibold ${
                      item.type === "income"
                        ? "text-emerald-400"
                        : "text-red-300"
                    }`}
                  >
                    {item.type === "income" ? "+" : "-"}
                    {formatMoney(item.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
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
}: {
  title: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
          {icon}
        </div>
      </div>

      <p className="text-sm text-slate-400">{title}</p>
      <h2 className="mt-2 text-2xl font-bold text-white">{value}</h2>
      <p className="mt-2 text-xs text-slate-500">{helper}</p>
    </div>
  );
}