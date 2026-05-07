"use client";

import type { Budget, BudgetTransaction } from "@/app/budgets/page";
import { supabase } from "@/lib/supabase/client";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Edit,
  Plus,
  Search,
  Target,
  Trash2,
  WalletCards,
  X,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import type {
  Dispatch,
  FormEvent,
  ReactNode,
  SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type BudgetStatus = "all" | "safe" | "warning" | "exceeded";

type FormState = {
  category: string;
  amount: string;
};

const categories = [
  "Food",
  "Transportation",
  "School",
  "Bills",
  "Shopping",
  "Allowance",
  "Salary",
  "Health",
  "Other",
];

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

const emptyForm: FormState = {
  category: categories[0],
  amount: "",
};

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

function getCurrentYear() {
  return new Date().getFullYear();
}

function getStatusDetails(percentage: number) {
  if (percentage >= 100) {
    return {
      key: "exceeded" as const,
      label: "Exceeded",
      description: "Spending is already over the budget limit.",
      icon: <XCircle className="h-4 w-4" />,
      badgeClass: "border-red-500/20 bg-red-500/10 text-red-300",
      barClass: "bg-red-500",
      cardClass: "border-red-500/20 bg-red-500/[0.04]",
    };
  }

  if (percentage >= 80) {
    return {
      key: "warning" as const,
      label: "Warning",
      description: "Spending has reached at least 80% of the budget.",
      icon: <AlertTriangle className="h-4 w-4" />,
      badgeClass: "border-yellow-500/20 bg-yellow-500/10 text-yellow-300",
      barClass: "bg-yellow-500",
      cardClass: "border-yellow-500/20 bg-yellow-500/[0.04]",
    };
  }

  return {
    key: "safe" as const,
    label: "Safe",
    description: "Spending is still within the safe budget range.",
    icon: <CheckCircle2 className="h-4 w-4" />,
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    barClass: "bg-emerald-500",
    cardClass: "border-white/10 bg-white/[0.04]",
  };
}

export default function BudgetManager({
  userId,
  initialBudgets,
  initialTransactions,
  initialMonth,
  initialYear,
}: {
  userId: string;
  initialBudgets: Budget[];
  initialTransactions: BudgetTransaction[];
  initialMonth: number;
  initialYear: number;
  initialCategoryOptions?: string[];
}) {
  const router = useRouter();

  const [budgets, setBudgets] = useState<Budget[]>(initialBudgets);
  const [transactions, setTransactions] =
    useState<BudgetTransaction[]>(initialTransactions);

  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedYear, setSelectedYear] = useState(initialYear);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BudgetStatus>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(false);

  const currentYear = getCurrentYear();

  const yearOptions = useMemo(() => {
    const years = new Set<number>();

    years.add(currentYear);
    years.add(initialYear);
    years.add(selectedYear);

    budgets.forEach((budget) => years.add(Number(budget.year)));

    return Array.from(years).sort((a, b) => b - a);
  }, [budgets, currentYear, initialYear, selectedYear]);

  const budgetRows = useMemo(() => {
    return budgets.map((budget) => {
      const category = normalizeCategory(budget.category);

      const used = transactions
        .filter(
          (transaction) =>
            transaction.type === "expense" &&
            normalizeCategory(transaction.category) === category
        )
        .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

      const amount = Number(budget.amount);
      const remaining = amount - used;
      const percentage = amount > 0 ? (used / amount) * 100 : 0;
      const status = getStatusDetails(percentage);

      return {
        ...budget,
        category,
        amount,
        used,
        remaining,
        percentage,
        progressValue: Math.min(percentage, 100),
        status,
      };
    });
  }, [budgets, transactions]);

  const filteredBudgetRows = useMemo(() => {
    const searchValue = search.toLowerCase().trim();

    return budgetRows.filter((budget) => {
      const matchesSearch =
        budget.category.toLowerCase().includes(searchValue) ||
        String(budget.amount).includes(searchValue) ||
        String(budget.used).includes(searchValue);

      const matchesStatus =
        statusFilter === "all" || budget.status.key === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [budgetRows, search, statusFilter]);

  const totalBudget = budgetRows.reduce((sum, item) => sum + item.amount, 0);
  const totalUsed = budgetRows.reduce((sum, item) => sum + item.used, 0);
  const totalRemaining = totalBudget - totalUsed;
  const totalUsagePercentage =
    totalBudget > 0 ? Math.min((totalUsed / totalBudget) * 100, 100) : 0;

  const warningCount = budgetRows.filter(
    (item) => item.status.key === "warning"
  ).length;

  const exceededCount = budgetRows.filter(
    (item) => item.status.key === "exceeded"
  ).length;

  async function loadMonth(month: number, year: number) {
    setLoading(true);

    const toastId = toast.loading("Loading budgets...", {
      description: `Checking budgets and expenses for ${formatMonth(
        month,
        year
      )}.`,
    });

    const { monthStart, monthEnd } = getMonthRange(month, year);

    const { data: budgetData, error: budgetError } = await supabase
      .from("budgets")
      .select("id, user_id, category, amount, month, year, created_at")
      .eq("user_id", userId)
      .eq("month", month)
      .eq("year", year)
      .order("category", { ascending: true });

    if (budgetError) {
      toast.error("Failed to load budgets", {
        id: toastId,
        description: budgetError.message,
      });
      setLoading(false);
      return;
    }

    const { data: transactionData, error: transactionError } = await supabase
      .from("transactions")
      .select("id, user_id, type, amount, category, transaction_date")
      .eq("user_id", userId)
      .eq("type", "expense")
      .gte("transaction_date", monthStart)
      .lte("transaction_date", monthEnd);

    if (transactionError) {
      toast.error("Failed to load expenses", {
        id: toastId,
        description: transactionError.message,
      });
      setLoading(false);
      return;
    }

    setBudgets((budgetData ?? []) as Budget[]);
    setTransactions((transactionData ?? []) as BudgetTransaction[]);
    setSelectedMonth(month);
    setSelectedYear(year);
    setSearch("");
    setStatusFilter("all");

    toast.success("Budgets loaded", {
      id: toastId,
      description: `${formatMonth(month, year)} budget data is ready.`,
    });

    setLoading(false);
  }

  function openAddModal() {
    setEditingBudget(null);
    setForm({
      category: categories[0],
      amount: "",
    });
    setModalOpen(true);
  }

  function openEditModal(budget: Budget) {
    setEditingBudget(budget);
    setForm({
      category: normalizeCategory(budget.category),
      amount: String(budget.amount),
    });
    setModalOpen(true);
  }

  function closeModal() {
    if (loading) return;

    setModalOpen(false);
    setEditingBudget(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const category = form.category.trim();
    const amount = Number(form.amount);

    if (!category) {
      toast.error("Missing category", {
        description: "Please select a budget category.",
      });
      return;
    }

    if (!categories.includes(category)) {
      toast.error("Invalid category", {
        description: "Please choose a category from the dropdown.",
      });
      return;
    }

    if (!amount || amount <= 0) {
      toast.error("Invalid budget amount", {
        description: "Budget amount must be greater than zero.",
      });
      return;
    }

    const duplicateBudget = budgets.find(
      (budget) =>
        budget.id !== editingBudget?.id &&
        normalizeCategory(budget.category).toLowerCase() ===
          category.toLowerCase() &&
        budget.month === selectedMonth &&
        budget.year === selectedYear
    );

    if (duplicateBudget) {
      toast.error("Budget already exists", {
        description: `${category} already has a budget for ${formatMonth(
          selectedMonth,
          selectedYear
        )}.`,
      });
      return;
    }

    setLoading(true);

    if (editingBudget) {
      const { data, error } = await supabase
        .from("budgets")
        .update({
          category,
          amount,
          month: selectedMonth,
          year: selectedYear,
        })
        .eq("id", editingBudget.id)
        .eq("user_id", userId)
        .select("id, user_id, category, amount, month, year, created_at")
        .single();

      if (error) {
        toast.error("Update failed", {
          description: error.message,
        });
        setLoading(false);
        return;
      }

      setBudgets((current) =>
        current
          .map((item) =>
            item.id === editingBudget.id ? (data as Budget) : item
          )
          .sort((a, b) =>
            normalizeCategory(a.category).localeCompare(
              normalizeCategory(b.category)
            )
          )
      );

      toast.success("Budget updated", {
        description: `${category} budget was updated for ${formatMonth(
          selectedMonth,
          selectedYear
        )}.`,
      });
    } else {
      const { data, error } = await supabase
        .from("budgets")
        .insert({
          user_id: userId,
          category,
          amount,
          month: selectedMonth,
          year: selectedYear,
        })
        .select("id, user_id, category, amount, month, year, created_at")
        .single();

      if (error) {
        toast.error("Create failed", {
          description: error.message,
        });
        setLoading(false);
        return;
      }

      setBudgets((current) =>
        [...current, data as Budget].sort((a, b) =>
          normalizeCategory(a.category).localeCompare(
            normalizeCategory(b.category)
          )
        )
      );

      toast.success("Budget added", {
        description: `${category} budget was created for ${formatMonth(
          selectedMonth,
          selectedYear
        )}.`,
      });
    }

    setLoading(false);
    setModalOpen(false);
    setEditingBudget(null);
    setForm(emptyForm);
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    const category = normalizeCategory(deleteTarget.category);

    setLoading(true);

    const { error } = await supabase
      .from("budgets")
      .delete()
      .eq("id", deleteTarget.id)
      .eq("user_id", userId);

    if (error) {
      toast.error("Delete failed", {
        description: error.message,
      });
      setLoading(false);
      return;
    }

    setBudgets((current) =>
      current.filter((item) => item.id !== deleteTarget.id)
    );

    toast.success("Budget deleted", {
      description: `${category} budget was removed successfully.`,
    });

    setLoading(false);
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-emerald-400">
            Budget Management
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Budgets
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Set planned monthly spending limits. Expenses from Transactions will
            be compared against these limits.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600"
        >
          <Plus className="h-4 w-4" />
          Add Budget
        </button>
      </div>

      {(warningCount > 0 || exceededCount > 0) && (
        <div className="mb-6 rounded-3xl border border-yellow-500/20 bg-yellow-500/10 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-yellow-500/10 text-yellow-300">
              <AlertTriangle className="h-5 w-5" />
            </div>

            <div>
              <h2 className="font-semibold text-yellow-100">
                Budget attention needed
              </h2>
              <p className="mt-1 text-sm text-yellow-200/80">
                {warningCount > 0 && `${warningCount} budget near the limit. `}
                {exceededCount > 0 &&
                  `${exceededCount} budget already exceeded. `}
                Review your spending for {formatMonth(selectedMonth, selectedYear)}.
              </p>
            </div>
          </div>
        </div>
      )}

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="Total Budget"
          value={formatMoney(totalBudget)}
          helper={`Planned limits for ${formatMonth(
            selectedMonth,
            selectedYear
          )}`}
          icon={<Target className="h-5 w-5" />}
        />

        <SummaryCard
          title="Total Used"
          value={formatMoney(totalUsed)}
          helper={`${totalUsagePercentage.toFixed(0)}% of total budget used`}
          icon={<WalletCards className="h-5 w-5" />}
        />

        <SummaryCard
          title="Remaining"
          value={formatMoney(totalRemaining)}
          helper={
            totalRemaining < 0
              ? "You are over the total budget"
              : "Budget left after expenses"
          }
          icon={<CalendarDays className="h-5 w-5" />}
          danger={totalRemaining < 0}
        />
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Monthly Budget Limits
            </h2>
            <p className="text-sm text-slate-400">
              {filteredBudgetRows.length} of {budgetRows.length} budget
              {budgetRows.length === 1 ? "" : "s"} shown for{" "}
              {formatMonth(selectedMonth, selectedYear)}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <select
              value={selectedMonth}
              onChange={(e) => loadMonth(Number(e.target.value), selectedYear)}
              disabled={loading}
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
              onChange={(e) => loadMonth(selectedMonth, Number(e.target.value))}
              disabled={loading}
              className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-60"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>

            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search budget..."
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-10 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as BudgetStatus)}
              className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10"
            >
              <option value="all">All Status</option>
              <option value="safe">Safe</option>
              <option value="warning">Warning</option>
              <option value="exceeded">Exceeded</option>
            </select>

            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              <Plus className="h-4 w-4" />
              New Limit
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10">
          <div className="hidden grid-cols-8 bg-white/5 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400 md:grid">
            <span>Category</span>
            <span className="text-right">Budget</span>
            <span className="text-right">Used</span>
            <span className="text-right">Remaining</span>
            <span className="col-span-2">Progress</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>

          {filteredBudgetRows.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-slate-400">
                <Target className="h-6 w-6" />
              </div>

              <h3 className="mt-4 font-semibold text-white">No budgets set</h3>

              <p className="mt-1 text-sm text-slate-400">
                Create a planned budget first. Transactions can be added before
                or after.
              </p>
            </div>
          ) : (
            filteredBudgetRows.map((budget) => (
              <div
                key={budget.id}
                className={`grid gap-4 border-t px-4 py-5 text-sm md:grid-cols-8 md:items-center ${budget.status.cardClass} border-white/10`}
              >
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                    Category
                  </p>
                  <p className="font-semibold text-white">{budget.category}</p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                    Budget
                  </p>
                  <p className="font-medium text-slate-200 md:text-right">
                    {formatMoney(budget.amount)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                    Used
                  </p>
                  <p className="font-medium text-slate-200 md:text-right">
                    {formatMoney(budget.used)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                    Remaining
                  </p>
                  <p
                    className={`font-medium md:text-right ${
                      budget.remaining < 0 ? "text-red-300" : "text-emerald-300"
                    }`}
                  >
                    {formatMoney(budget.remaining)}
                  </p>
                </div>

                <div className="md:col-span-2">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                      Progress
                    </p>
                    <p className="text-xs font-semibold text-slate-300">
                      {budget.percentage.toFixed(0)}%
                    </p>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all ${budget.status.barClass}`}
                      style={{ width: `${budget.progressValue}%` }}
                    />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                    Status
                  </p>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${budget.status.badgeClass}`}
                    title={budget.status.description}
                  >
                    {budget.status.icon}
                    {budget.status.label}
                  </span>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                    Actions
                  </p>

                  <div className="mt-2 flex gap-2 md:mt-0 md:justify-end">
                    <button
                      type="button"
                      onClick={() => openEditModal(budget)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
                      aria-label="Edit budget"
                    >
                      <Edit className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(budget)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 transition hover:bg-red-500/20"
                      aria-label="Delete budget"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {modalOpen && (
        <BudgetModal
          title={editingBudget ? "Edit Budget" : "Add Budget"}
          form={form}
          setForm={setForm}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          loading={loading}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      )}

      {deleteTarget && (
        <DeleteBudgetModal
          budget={deleteTarget}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          loading={loading}
          onClose={() => {
            if (!loading) setDeleteTarget(null);
          }}
          onDelete={handleDelete}
        />
      )}
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
  icon: ReactNode;
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

function BudgetModal({
  title,
  form,
  setForm,
  selectedMonth,
  selectedYear,
  loading,
  onClose,
  onSubmit,
}: {
  title: string;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  selectedMonth: number;
  selectedYear: number;
  loading: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950 p-5 shadow-2xl shadow-black">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <p className="mt-1 text-sm text-slate-400">
              Set a planned limit for {formatMonth(selectedMonth, selectedYear)}.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-300">
              Category
            </label>

            <select
              value={form.category}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  category: e.target.value,
                }))
              }
              required
              disabled={loading}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-60"
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <p className="mt-2 text-xs text-slate-500">
              Budgets use the same categories as Transactions for accurate
              matching.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-300">
              Budget Amount
            </label>

            <input
              type="number"
              min="1"
              step="0.01"
              value={form.amount}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  amount: e.target.value,
                }))
              }
              placeholder="0.00"
              required
              disabled={loading}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-60"
            />
          </div>

          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-200">
            You can create a budget before adding transactions. Later expense
            transactions in the same category will update this budget progress.
          </div>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Saving..." : "Save Budget"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteBudgetModal({
  budget,
  selectedMonth,
  selectedYear,
  loading,
  onClose,
  onDelete,
}: {
  budget: Budget;
  selectedMonth: number;
  selectedYear: number;
  loading: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  const category = normalizeCategory(budget.category);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950 p-5 shadow-2xl shadow-black">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-300">
          <Trash2 className="h-6 w-6" />
        </div>

        <h2 className="text-xl font-bold text-white">Delete budget?</h2>

        <p className="mt-2 text-sm text-slate-400">
          This will permanently delete the{" "}
          <span className="font-semibold text-white">{category}</span> budget
          worth{" "}
          <span className="font-semibold text-white">
            {formatMoney(budget.amount)}
          </span>{" "}
          for {formatMonth(selectedMonth, selectedYear)}.
        </p>

        <p className="mt-3 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-sm text-yellow-200">
          This will only delete the budget limit. Your transaction records will
          stay unchanged.
        </p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onDelete}
            disabled={loading}
            className="rounded-2xl bg-red-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}