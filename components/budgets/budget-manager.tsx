"use client";

import type { Budget, BudgetTransaction } from "@/app/budgets/page";
import { supabase } from "@/lib/supabase/client";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Edit,
  Plus,
  Target,
  Trash2,
  WalletCards,
  X,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const categories = [
  "Food",
  "Transportation",
  "School",
  "Bills",
  "Shopping",
  "Allowance",
  "Salary",
  "Savings",
  "Health",
  "Other",
];

type FormState = {
  category: string;
  amount: string;
};

const emptyForm: FormState = {
  category: "Food",
  amount: "",
};

function formatMoney(value: number | string) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function getMonthEnd(monthStart: string) {
  const date = new Date(monthStart);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);
}

function toMonthStartFromInput(value: string) {
  return `${value}-01`;
}

function toMonthInputValue(value: string) {
  return value.slice(0, 7);
}

function getBudgetStatus(percentage: number) {
  if (percentage >= 100) {
    return {
      label: "Exceeded",
      description: "This category has gone beyond the budget limit.",
      icon: <XCircle className="h-4 w-4" />,
      badgeClass: "bg-red-500/10 text-red-300 border-red-500/20",
      barClass: "bg-red-500",
    };
  }

  if (percentage >= 80) {
    return {
      label: "Warning",
      description: "This category is close to reaching the budget limit.",
      icon: <AlertTriangle className="h-4 w-4" />,
      badgeClass: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
      barClass: "bg-yellow-500",
    };
  }

  return {
    label: "Safe",
    description: "This category is still within the budget limit.",
    icon: <CheckCircle2 className="h-4 w-4" />,
    badgeClass: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    barClass: "bg-emerald-500",
  };
}

export default function BudgetManager({
  userId,
  initialBudgets,
  initialTransactions,
  initialMonth,
}: {
  userId: string;
  initialBudgets: Budget[];
  initialTransactions: BudgetTransaction[];
  initialMonth: string;
}) {
  const router = useRouter();

  const [budgets, setBudgets] = useState<Budget[]>(initialBudgets);
  const [transactions, setTransactions] =
    useState<BudgetTransaction[]>(initialTransactions);

  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(false);

  const budgetRows = useMemo(() => {
    return budgets.map((budget) => {
      const used = transactions
        .filter((transaction) => transaction.category === budget.category)
        .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

      const amount = Number(budget.amount);
      const remaining = amount - used;
      const percentage = amount > 0 ? (used / amount) * 100 : 0;
      const status = getBudgetStatus(percentage);

      return {
        ...budget,
        amount,
        used,
        remaining,
        percentage,
        progressValue: Math.min(percentage, 100),
        status,
      };
    });
  }, [budgets, transactions]);

  const totalBudget = budgetRows.reduce((sum, item) => sum + item.amount, 0);
  const totalUsed = budgetRows.reduce((sum, item) => sum + item.used, 0);
  const totalRemaining = totalBudget - totalUsed;

  async function loadMonth(monthStart: string) {
    setLoading(true);

    const monthEnd = getMonthEnd(monthStart);

    const { data: budgetData, error: budgetError } = await supabase
      .from("budgets")
      .select("id, user_id, category, amount, month, created_at")
      .eq("user_id", userId)
      .eq("month", monthStart)
      .order("category", { ascending: true });

    if (budgetError) {
      toast.error("Failed to load budgets", {
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
        description: transactionError.message,
      });
      setLoading(false);
      return;
    }

    setBudgets((budgetData ?? []) as Budget[]);
    setTransactions((transactionData ?? []) as BudgetTransaction[]);
    setSelectedMonth(monthStart);
    setLoading(false);
  }

  function openAddModal() {
    setEditingBudget(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEditModal(budget: Budget) {
    setEditingBudget(budget);
    setForm({
      category: budget.category,
      amount: String(budget.amount),
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const amount = Number(form.amount);

    if (!form.category.trim()) {
      toast.error("Missing category", {
        description: "Please select a budget category.",
      });
      return;
    }

    if (!amount || amount <= 0) {
      toast.error("Invalid budget amount", {
        description: "Budget amount must be greater than zero.",
      });
      return;
    }

    setLoading(true);

    if (editingBudget) {
      const { data, error } = await supabase
        .from("budgets")
        .update({
          category: form.category,
          amount,
          month: selectedMonth,
        })
        .eq("id", editingBudget.id)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) {
        toast.error("Update failed", {
          description: error.message,
        });
        setLoading(false);
        return;
      }

      setBudgets((current) =>
        current.map((item) =>
          item.id === editingBudget.id ? (data as Budget) : item
        )
      );

      toast.success("Budget updated", {
        description: `${form.category} budget was updated successfully.`,
      });
    } else {
      const existingBudget = budgets.find(
        (budget) => budget.category === form.category
      );

      if (existingBudget) {
        toast.error("Budget already exists", {
          description: `${form.category} already has a budget for ${formatMonth(
            selectedMonth
          )}.`,
        });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("budgets")
        .insert({
          user_id: userId,
          category: form.category,
          amount,
          month: selectedMonth,
        })
        .select()
        .single();

      if (error) {
        toast.error("Create failed", {
          description: error.message,
        });
        setLoading(false);
        return;
      }

      setBudgets((current) => [...current, data as Budget].sort((a, b) =>
        a.category.localeCompare(b.category)
      ));

      toast.success("Budget added", {
        description: `${form.category} budget was created for ${formatMonth(
          selectedMonth
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
      description: `${deleteTarget.category} budget was removed successfully.`,
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
            Set monthly category limits and monitor your spending progress.
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

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="Total Budget"
          value={formatMoney(totalBudget)}
          helper={`Budget limits for ${formatMonth(selectedMonth)}`}
          icon={<Target className="h-5 w-5" />}
        />

        <SummaryCard
          title="Total Used"
          value={formatMoney(totalUsed)}
          helper="Expenses recorded from transactions"
          icon={<WalletCards className="h-5 w-5" />}
        />

        <SummaryCard
          title="Remaining"
          value={formatMoney(totalRemaining)}
          helper="Budget left after expenses"
          icon={<CalendarDays className="h-5 w-5" />}
        />
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Monthly Budget Limits
            </h2>
            <p className="text-sm text-slate-400">
              {budgetRows.length} budget
              {budgetRows.length === 1 ? "" : "s"} for{" "}
              {formatMonth(selectedMonth)}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="month"
              value={toMonthInputValue(selectedMonth)}
              onChange={(e) => loadMonth(toMonthStartFromInput(e.target.value))}
              disabled={loading}
              className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-60"
            />

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

          {budgetRows.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-slate-400">
                <Target className="h-6 w-6" />
              </div>

              <h3 className="mt-4 font-semibold text-white">
                No budgets set
              </h3>

              <p className="mt-1 text-sm text-slate-400">
                Create your first category budget for this month.
              </p>
            </div>
          ) : (
            budgetRows.map((budget) => (
              <div
                key={budget.id}
                className="grid gap-4 border-t border-white/10 px-4 py-5 text-sm md:grid-cols-8 md:items-center"
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
                  <div className="mb-2 flex items-center justify-between">
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
          loading={loading}
          onClose={() => {
            setModalOpen(false);
            setEditingBudget(null);
            setForm(emptyForm);
          }}
          onSubmit={handleSubmit}
        />
      )}

      {deleteTarget && (
        <DeleteBudgetModal
          budget={deleteTarget}
          loading={loading}
          onClose={() => setDeleteTarget(null)}
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
}: {
  title: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
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
  loading,
  onClose,
  onSubmit,
}: {
  title: string;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  loading: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950 p-5 shadow-2xl shadow-black">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <p className="mt-1 text-sm text-slate-400">
              Set a monthly spending limit for a category.
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
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10"
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
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
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10"
            />
          </div>

          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-200">
            Budget alerts are based on expenses recorded in Transactions.
            Warning starts at 80%, and Exceeded starts at 100%.
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
  loading,
  onClose,
  onDelete,
}: {
  budget: Budget;
  loading: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950 p-5 shadow-2xl shadow-black">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-300">
          <Trash2 className="h-6 w-6" />
        </div>

        <h2 className="text-xl font-bold text-white">Delete budget?</h2>

        <p className="mt-2 text-sm text-slate-400">
          This will permanently delete the{" "}
          <span className="font-semibold text-white">{budget.category}</span>{" "}
          budget worth{" "}
          <span className="font-semibold text-white">
            {formatMoney(budget.amount)}
          </span>
          .
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