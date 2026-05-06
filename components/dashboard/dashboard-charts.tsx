"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type IncomeExpenseData = {
  name: string;
  amount: number;
};

type ExpenseCategoryData = {
  category: string;
  amount: number;
};

type BudgetUsageData = {
  category: string;
  budget: number;
  used: number;
  remaining: number;
  percentage: number;
  status: string;
};

type Props = {
  incomeExpenseData: IncomeExpenseData[];
  expenseByCategory: ExpenseCategoryData[];
  budgetUsageByCategory: BudgetUsageData[];
  totalExpenses: number;
  monthlyBudget: number;
  budgetUsed: number;
};

const chartColors = [
  "#10b981",
  "#ef4444",
  "#f59e0b",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

function formatMoney(value: number | string | null | undefined) {
  const numberValue = Number(value ?? 0);

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(numberValue);
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    value?: number;
    name?: string;
    payload?: Record<string, unknown>;
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm shadow-2xl shadow-black">
      {label && <p className="mb-1 font-semibold text-white">{label}</p>}

      {payload.map((item, index) => (
        <p key={index} className="text-slate-300">
          {item.name}:{" "}
          <span className="font-semibold text-white">
            {formatMoney(Number(item.value ?? 0))}
          </span>
        </p>
      ))}
    </div>
  );
}

export default function DashboardCharts({
  incomeExpenseData,
  expenseByCategory,
  budgetUsageByCategory,
  totalExpenses,
  monthlyBudget,
  budgetUsed,
}: Props) {
  const hasExpenses = expenseByCategory.length > 0;
  const hasBudgets = budgetUsageByCategory.length > 0;

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Income vs Expenses
            </h2>
            <p className="text-sm text-slate-400">
              Current month comparison
            </p>
          </div>
        </div>

        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={incomeExpenseData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} />
              <YAxis
                stroke="#94a3b8"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `₱${Number(value).toLocaleString()}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="amount" name="Amount" radius={[12, 12, 0, 0]}>
                {incomeExpenseData.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={index === 0 ? "#10b981" : "#ef4444"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-white">
            Expense by Category
          </h2>
          <p className="text-sm text-slate-400">
            Donut chart of where your money goes
          </p>
        </div>

        {hasExpenses ? (
          <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseByCategory}
                    dataKey="amount"
                    nameKey="category"
                    innerRadius={65}
                    outerRadius={105}
                    paddingAngle={3}
                  >
                    {expenseByCategory.map((entry, index) => (
                      <Cell
                        key={entry.category}
                        fill={chartColors[index % chartColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3">
              {expenseByCategory.map((item, index) => {
                const percentage =
                  totalExpenses > 0 ? (item.amount / totalExpenses) * 100 : 0;

                return (
                  <div
                    key={item.category}
                    className="rounded-2xl border border-white/10 bg-white/5 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{
                            backgroundColor:
                              chartColors[index % chartColors.length],
                          }}
                        />
                        <span className="text-sm font-medium text-slate-200">
                          {item.category}
                        </span>
                      </div>

                      <span className="text-sm font-semibold text-white">
                        {percentage.toFixed(0)}%
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-slate-400">
                      {formatMoney(item.amount)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyChartState message="No expense data yet. Add expense transactions to see category breakdown." />
        )}
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl xl:col-span-2">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Budget Usage by Category
            </h2>
            <p className="text-sm text-slate-400">
              Compare planned limits against actual expense usage
            </p>
          </div>

          <span
            className={`w-fit rounded-full px-3 py-1 text-sm font-medium ${
              budgetUsed >= 100
                ? "bg-red-500/10 text-red-300"
                : budgetUsed >= 80
                  ? "bg-amber-500/10 text-amber-300"
                  : monthlyBudget > 0
                    ? "bg-emerald-500/10 text-emerald-300"
                    : "bg-slate-500/10 text-slate-300"
            }`}
          >
            {monthlyBudget > 0 ? `${budgetUsed.toFixed(0)}% total used` : "No budget"}
          </span>
        </div>

        {hasBudgets ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={budgetUsageByCategory}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="category" stroke="#94a3b8" tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `₱${Number(value).toLocaleString()}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="budget" name="Budget" fill="#334155" radius={[12, 12, 0, 0]} />
                <Bar dataKey="used" name="Used" radius={[12, 12, 0, 0]}>
                  {budgetUsageByCategory.map((entry) => (
                    <Cell
                      key={entry.category}
                      fill={
                        entry.status === "exceeded"
                          ? "#ef4444"
                          : entry.status === "warning"
                            ? "#f59e0b"
                            : "#10b981"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChartState message="No budgets set yet. Create category budgets to see usage charts." />
        )}
      </section>
    </div>
  );
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex h-72 items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
      <p className="max-w-sm text-sm text-slate-400">{message}</p>
    </div>
  );
}