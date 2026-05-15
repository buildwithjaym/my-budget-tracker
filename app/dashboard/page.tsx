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
  TrendingUp,
  AlertTriangle,
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

function getFinancialHealthStatus(totalIncome: number, totalExpenses: number) {
  const expensesPercentage = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 100;
  const balance = totalIncome - totalExpenses;
  
  if (balance < 0) {
    return {
      type: "deficit",
      percentage: Math.min(expensesPercentage, 100),
      message: "💸 Spending exceeds income",
      subMessage: `You're ${formatMoney(Math.abs(balance))} over budget this month`,
      icon: AlertTriangle,
      iconColor: "bg-red-500/20 text-red-400 border border-red-500/30",
      textColor: "text-red-100",
      subTextColor: "text-red-200/90",
      badgeColor: "border-red-500/30 bg-red-500/10 text-red-200",
      containerColor: "border-red-500/40 bg-gradient-to-br from-red-500/10 to-red-500/5",
      severity: "critical" as const
    };
  }
  
  if (expensesPercentage >= 90) {
    return {
      type: "warning",
      percentage: expensesPercentage,
      message: "⚠️ High spending alert",
      subMessage: `Only ${formatMoney(balance)} remaining this month`,
      icon: TrendingUp,
      iconColor: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
      textColor: "text-amber-100",
      subTextColor: "text-amber-200/90",
      badgeColor: "border-amber-500/30 bg-amber-500/10 text-amber-200",
      containerColor: "border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-amber-500/5",
      severity: "high" as const
    };
  }
  
  if (expensesPercentage >= 70) {
    return {
      type: "caution",
      percentage: expensesPercentage,
      message: "📊 Moderate spending",
      subMessage: `${Math.round(expensesPercentage)}% of income used`,
      icon: TrendingUp,
      iconColor: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20",
      textColor: "text-yellow-100",
      subTextColor: "text-yellow-200/80",
      badgeColor: "border-yellow-500/20 bg-yellow-500/5 text-yellow-200",
      containerColor: "border-yellow-500/20 bg-gradient-to-br from-yellow-500/5 to-yellow-500/2",
      severity: "medium" as const
    };
  }
  
  return {
    type: "healthy",
    percentage: expensesPercentage,
    message: "✅ Excellent financial health",
    subMessage: `Well under budget - ${formatMoney(balance)} available`,
    icon: PiggyBank,
    iconColor: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    textColor: "text-emerald-100",
    subTextColor: "text-emerald-200/90",
    badgeColor: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    containerColor: "border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5",
    severity: "low" as const
  };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");

  const { now, month, year, monthStart, monthEnd } = getCurrentMonthDetails();

  const [transactionsResult, recentTransactionsResult, budgetsResult, profileResult] = 
    await Promise.all([
      supabase
        .from("transactions")
        .select("id, user_id, type, amount, category, note, transaction_date, created_at")
        .eq("user_id", user.id)
        .gte("transaction_date", monthStart)
        .lte("transaction_date", monthEnd)
        .order("transaction_date", { ascending: false }),

      supabase
        .from("transactions")
        .select("id, type, amount, category, note, transaction_date, created_at")
        .eq("user_id", user.id)
        .order("transaction_date", { ascending: false })
        .limit(5),

      supabase
        .from("budgets")
        .select("id, user_id, category, amount, month, year, created_at")
        .eq("user_id", user.id)
        .eq("month", month)
        .eq("year", year),

      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    ]);

  if (transactionsResult.error || recentTransactionsResult.error || budgetsResult.error) {
    throw new Error("Failed to fetch dashboard data");
  }

  const transactions = (transactionsResult.data as DashboardTransaction[]) ?? [];
  const recentTransactions = (recentTransactionsResult.data as RecentTransaction[]) ?? [];
  const budgets = (budgetsResult.data as DashboardBudget[]) ?? [];

  const totalIncome = transactions
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpenses = transactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const balance = totalIncome - totalExpenses;
  const financialHealth = getFinancialHealthStatus(totalIncome, totalExpenses);

  const monthlyBudget = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
  const budgetUsed = monthlyBudget > 0 ? (totalExpenses / monthlyBudget) * 100 : 0;

  const expenseCategoryMap = new Map<string, number>();
  transactions
    .filter(t => t.type === "expense")
    .forEach(t => {
      const cat = normalizeCategory(t.category);
      expenseCategoryMap.set(cat, (expenseCategoryMap.get(cat) ?? 0) + Number(t.amount));
    });

  const expenseByCategory = Array.from(expenseCategoryMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const budgetUsageByCategory = budgets.map(budget => {
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
    { name: "Income", amount: totalIncome },
    { name: "Expenses", amount: totalExpenses },
  ];

  const fullName = profileResult.data?.full_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] || "there";

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header - Reduced spacing */}
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="flex-1">
            <p className="text-sm font-medium text-emerald-400">Personal Finance Dashboard</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Welcome back, <span className="text-emerald-300">{fullName}</span>
            </h1>
            <p className="mt-2 max-w-md text-sm/6 text-slate-400">
              Real-time monitoring of your income, expenses, and financial health for {now.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200">
            {now.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}
          </div>
        </div>

        {/* 🚨 FINANCIAL HEALTH ALERT - More compact */}
        <div className={`mb-6 overflow-hidden rounded-2xl border shadow-xl shadow-black/20 backdrop-blur-xl ${financialHealth.containerColor}`}>
          <div className="p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${financialHealth.iconColor}`}>
                  <financialHealth.icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className={`text-lg font-bold ${financialHealth.textColor}`}>
                    {financialHealth.message}
                  </h2>
                  <p className={`mt-1 text-sm ${financialHealth.subTextColor}`}>
                    {financialHealth.subMessage}
                  </p>
                </div>
              </div>
              <div className={`rounded-xl border px-4 py-2 text-base font-bold ${financialHealth.badgeColor}`}>
                {financialHealth.type === "deficit" ? "DEFICIT" :
                 financialHealth.type === "healthy" ? "EXCELLENT" :
                 `${Math.round(financialHealth.percentage)}% Used`}
              </div>
            </div>
          </div>
        </div>

        {/* 💰 KPI CARDS - Compact */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardCard
            title="Total Income"
            value={formatMoney(totalIncome)}
            change={"+12.5%"}
            icon={<ArrowDownLeft className="h-5 w-5" />}
            helper="YTD Income"
            trend="up"
          />
          
          <DashboardCard
            title="Total Expenses"
            value={formatMoney(totalExpenses)}
            change={`-${((totalExpenses / totalIncome) * 100).toFixed(0)}%`}
            icon={<ArrowUpRight className="h-5 w-5" />}
            helper="This month"
            danger={totalExpenses > totalIncome * 0.85}
            trend="down"
          />
          
          <DashboardCard
            title="Net Balance"
            value={formatMoney(balance)}
            change={balance >= 0 ? "+8.2%" : "-3.1%"}
            icon={<PiggyBank className="h-5 w-5" />}
            helper="Income - Expenses"
            danger={balance < 0}
            trend={balance >= 0 ? "up" : "down"}
          />
        </section>

        {/* 📊 Charts & Recent Activity - Tighter spacing */}
        <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="xl:col-span-2">
            <DashboardCharts
              incomeExpenseData={incomeExpenseData}
              expenseByCategory={expenseByCategory}
              budgetUsageByCategory={budgetUsageByCategory}
              totalExpenses={totalExpenses}
              monthlyBudget={monthlyBudget}
              budgetUsed={budgetUsed}
            />
          </section>

          <section className="order-first xl:order-last rounded-2xl border border-white/10 bg-white/2 p-6 shadow-xl shadow-black/20 backdrop-blur-xl xl:col-span-2">
            {/* Recent Transactions */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Recent Activity</h2>
                <p className="text-sm text-slate-400">Your latest transactions</p>
              </div>
              <Link href="/transactions" className="text-sm font-semibold text-emerald-400 hover:text-emerald-300">
                View All →
              </Link>
            </div>

            <div className="space-y-3">
              {recentTransactions.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <PiggyBank className="mx-auto h-10 w-10 text-slate-400 mb-3" />
                  <p className="text-sm">No transactions yet. Add your first one!</p>
                </div>
              ) : (
                recentTransactions.map((item) => (
                  <TransactionRow key={item.id} transaction={item} />
                ))
              )}
            </div>
          </section>
        </div>

        {/* ⚡ Quick Actions - Compact */}
        <section className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
          <ActionCard 
            icon={<Plus className="h-4 w-4" />} 
            title="Add Transaction" 
            href="/transactions"
            description="Log income or expense"
            primary
          />
          <ActionCard 
            icon={<PiggyBank className="h-4 w-4" />} 
            title="Manage Budgets" 
            href="/budgets"
            description="Set monthly limits"
          />
          <ActionCard 
            icon={<TrendingUp className="h-4 w-4" />} 
            title="View Reports" 
            href="/reports"
            description="Monthly insights"
          />
        </section>
      </div>
    </AppShell>
  );
}

// ✨ COMPACT Components
function DashboardCard({
  title,
  value,
  change,
  helper,
  icon,
  danger = false,
  trend = "up",
}: {
  title: string;
  value: string;
  change?: string;
  helper: string;
  icon: React.ReactNode;
  danger?: boolean;
  trend?: "up" | "down";
}) {
  return (
    <div className={`group relative rounded-2xl border p-6 shadow-xl shadow-black/20 backdrop-blur-xl transition-all duration-300 hover:shadow-white/10 ${
      danger 
        ? "border-red-500/40 bg-gradient-to-br from-red-500/5 to-red-500/2" 
        : "border-white/10 bg-white/2"
    }`}>
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="relative z-10 flex items-start justify-between mb-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all ${
          danger 
            ? "bg-red-500/20 text-red-400 border-2 border-red-500/40 shadow-red-500/20" 
            : "bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/40 shadow-emerald-500/20"
        }`}>
          {icon}
        </div>
        {change && (
          <span className={`text-xs font-bold ${
            trend === "up" ? "text-emerald-400" : "text-red-400"
          }`}>
            {trend === "up" ? "↗" : "↘"} {change}
          </span>
        )}
      </div>

      <p className="text-xs font-medium text-slate-400 mb-1">{title}</p>
      <h2 className="text-2xl font-bold text-white mb-2">{value}</h2>
      <p className="text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function TransactionRow({ transaction }: { transaction: RecentTransaction }) {
  return (
    <div className="group flex items-center justify-between gap-3 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
      <div className="flex items-center gap-3 flex-1">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
          transaction.type === "income" 
            ? "bg-emerald-500/20 text-emerald-400" 
            : "bg-red-500/20 text-red-400"
        }`}>
          {transaction.type === "income" ? "↓" : "↑"}
        </div>
        <div>
          <p className="font-semibold text-white text-sm">{transaction.category}</p>
          <p className="text-xs text-slate-500">{formatDate(transaction.transaction_date)}</p>
        </div>
      </div>
      <div className={`font-bold text-base ${
        transaction.type === "income" ? "text-emerald-400" : "text-red-400"
      }`}>
        {transaction.type === "income" ? "+" : "-"}{formatMoney(transaction.amount)}
      </div>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  href,
  description,
  primary = false,
}: {
  icon: React.ReactNode;
  title: string;
  href: string;
  description: string;
  primary?: boolean;
}) {
  return (
    <Link 
      href={href}
      className={`group relative rounded-2xl border p-6 shadow-lg shadow-black/20 backdrop-blur-xl transition-all hover:shadow-xl hover:shadow-white/10 ${
        primary 
          ? "border-emerald-500/40 bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 hover:from-emerald-500/30" 
          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
          primary ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-slate-300"
        }`}>
          {icon}
        </div>
      </div>
      <h3 className="text-base font-bold text-white mb-1 group-hover:translate-x-1 transition-transform">{title}</h3>
      <p className="text-xs text-slate-400">{description}</p>
    </Link>
  );
}

function getBudgetStatus(usedPercentage: number, hasBudget: boolean): string {
  if (!hasBudget) return "none";
  if (usedPercentage >= 100) return "exceeded";
  if (usedPercentage >= 80) return "warning";
  return "safe";
}