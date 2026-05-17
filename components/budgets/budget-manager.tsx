"use client";

import type { Budget, BudgetTransaction } from "@/app/budgets/page";
import { supabase } from "@/lib/supabase/client";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Edit,
  Eye,
  Plus,
  Search,
  Target,
  Trash2,
  X,
  XCircle,
  DollarSign,
} from "lucide-react";
import { useMemo, useState, useEffect, useCallback } from "react";
import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type BudgetStatus = "all" | "safe" | "warning" | "exceeded";

type FormState = {
  category: string;
  amount: string;
};

type BudgetRow = Budget & {
  category: string;
  amount: number;
  used: number;
  remaining: number;
  percentage: number;
  progressValue: number;
  status: ReturnType<typeof getStatusDetails>;
};

const defaultCategories = [
  "Food",
  "Transportation",
  "School",
  "Bills",
  "Shopping",
  "Health",
  "Groceries",
  "Rent",
  "Utilities",
  "Internet",
  "Phone",
  "Entertainment",
  "Personal Care",
  "Savings",
  "Emergency",
  "Family",
  "Subscriptions",
  "Travel",
  "Pets",
  "Laundry",
  "Other",
];

const incomeCategories = ["Allowance", "Monthly Salary", "Other Income"];

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
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
  initialCategoryOptions = [],
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
  const [allTransactions, setAllTransactions] = useState<BudgetTransaction[]>(initialTransactions);
  const [incomeTransactions, setIncomeTransactions] = useState<BudgetTransaction[]>([]);

  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedYear, setSelectedYear] = useState(initialYear);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BudgetStatus>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null);
  const [historyTarget, setHistoryTarget] = useState<BudgetRow | null>(null);

  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [customCategoryModalOpen, setCustomCategoryModalOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(false);

  const currentYear = getCurrentYear();

  const { monthStart, monthEnd } = getMonthRange(selectedMonth, selectedYear);

  // Calculate totals
  const totalIncome = useMemo(() => {
    return incomeTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
  }, [incomeTransactions]);

  const totalBudgetAllocation = useMemo(() => {
    return budgets.reduce((sum, b) => sum + Number(b.amount), 0);
  }, [budgets]);

  const remainingBudgetAllocation = useMemo(() => {
    return Math.max(0, totalIncome - totalBudgetAllocation);
  }, [totalIncome, totalBudgetAllocation]);

  const canAddBudget = useMemo(() => {
    return totalIncome > 0 && remainingBudgetAllocation > 0;
  }, [totalIncome, remainingBudgetAllocation]);

  const categoryOptions = useMemo(() => {
    return Array.from(
      new Set(
        [...defaultCategories, ...initialCategoryOptions, ...customCategories]
          .filter(Boolean)
          .map((category) => String(category).trim())
          .filter((category) => !incomeCategories.includes(category))
      )
    ).sort((a, b) => {
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return a.localeCompare(b);
    });
  }, [initialCategoryOptions, customCategories]);

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    years.add(currentYear);
    years.add(initialYear);
    years.add(selectedYear);
    budgets.forEach((budget) => years.add(Number(budget.year)));
    return Array.from(years).sort((a, b) => b - a);
  }, [budgets, currentYear, initialYear, selectedYear]);

  const expenseTransactions = useMemo(() => {
    return allTransactions.filter((t) => t.type === "expense");
  }, [allTransactions]);

  const budgetRows = useMemo<BudgetRow[]>(() => {
    return budgets.map((budget) => {
      const category = normalizeCategory(budget.category);
      const used = expenseTransactions
        .filter(
          (transaction) =>
            normalizeCategory(transaction.category).toLowerCase() === category.toLowerCase()
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
  }, [budgets, expenseTransactions]);

  const filteredBudgetRows = useMemo(() => {
    const searchValue = search.toLowerCase().trim();
    return budgetRows.filter((budget) => {
      const matchesSearch =
        budget.category.toLowerCase().includes(searchValue) ||
        String(budget.amount).includes(searchValue) ||
        String(budget.used).includes(searchValue);
      const matchesStatus = statusFilter === "all" || budget.status.key === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [budgetRows, search, statusFilter]);

  const historyTransactions = useMemo(() => {
    if (!historyTarget) return [];
    return expenseTransactions
      .filter(
        (transaction) =>
          normalizeCategory(transaction.category).toLowerCase() === historyTarget.category.toLowerCase()
      )
      .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
  }, [historyTarget, expenseTransactions]);

  const warningCount = useMemo(() => budgetRows.filter((item) => item.status.key === "warning").length, [budgetRows]);
  const exceededCount = useMemo(() => budgetRows.filter((item) => item.status.key === "exceeded").length, [budgetRows]);

  // Load complete month data
  const loadMonth = useCallback(async (month: number, year: number) => {
    setLoading(true);
    const toastId = toast.loading("Loading data...", {
      description: `Fetching budgets, income, and expenses for ${formatMonth(month, year)}.`,
    });

    const { monthStart, monthEnd } = getMonthRange(month, year);

    try {
      // Load budgets
      const { data: budgetData, error: budgetError } = await supabase
        .from("budgets")
        .select("id, user_id, category, amount, month, year, created_at")
        .eq("user_id", userId)
        .eq("month", month)
        .eq("year", year)
        .order("category", { ascending: true });

      if (budgetError) throw budgetError;

      // Load ALL transactions for the month
      const { data: transactionData, error: transactionError } = await supabase
        .from("transactions")
        .select("id, user_id, type, amount, category, transaction_date, note")
        .eq("user_id", userId)
        .gte("transaction_date", monthStart)
        .lte("transaction_date", monthEnd)
        .order("transaction_date", { ascending: false });

      if (transactionError) throw transactionError;

      setBudgets((budgetData ?? []) as Budget[]);
      setAllTransactions((transactionData ?? []) as BudgetTransaction[]);
      setIncomeTransactions(transactionData?.filter((t) => t.type === "income") ?? []);

      setSelectedMonth(month);
      setSelectedYear(year);
      setSearch("");
      setStatusFilter("all");
      setHistoryTarget(null);

      toast.success("Data loaded", {
        id: toastId,
        description: `${formatMonth(month, year)} budget data is ready.`,
      });
    } catch (error: any) {
      toast.error("Failed to load data", { id: toastId, description: error.message });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Initial load
  useEffect(() => {
    loadMonth(selectedMonth, selectedYear);
  }, [loadMonth, selectedMonth, selectedYear]);

  function openAddModal() {
    if (!canAddBudget) {
      toast.error("No budget capacity", {
        description: `No remaining allocation. Total income: ${formatMoney(totalIncome)}, Allocated: ${formatMoney(totalBudgetAllocation)}`,
      });
      return;
    }
    setEditingBudget(null);
    setForm({
      category: categoryOptions[0] ?? "Food",
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

  function handleCategoryChange(category: string) {
    if (category === "Other") {
      setCustomCategoryModalOpen(true);
      return;
    }
    setForm((current) => ({ ...current, category }));
  }

  function addCustomCategory() {
    const category = newCategory.trim();
    if (!category) {
      toast.error("Missing category");
      return;
    }
    if (categoryOptions.some((item) => item.toLowerCase() === category.toLowerCase())) {
      toast.error("Category already exists");
      return;
    }
    setCustomCategories((current) => [...current, category].sort((a, b) => a.localeCompare(b)));
    setForm((current) => ({ ...current, category }));
    setNewCategory("");
    setCustomCategoryModalOpen(false);
    toast.success("Category added");
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const category = form.category.trim();
    const amount = Number(form.amount);

    if (!category || category === "Other") {
      toast.error("Please select a valid category");
      return;
    }

    if (!amount || amount <= 0) {
      toast.error("Budget amount must be greater than zero");
      return;
    }

    // STRICT INCOME VALIDATION
    const currentAllocationExcludingEdit = budgets.reduce((sum, budget) => {
      if (editingBudget && budget.id === editingBudget.id) return sum;
      return sum + Number(budget.amount);
    }, 0);

    const newTotalAllocation = currentAllocationExcludingEdit + amount;
    
    if (newTotalAllocation > totalIncome) {
      const overBy = newTotalAllocation - totalIncome;
      toast.error("Budget exceeds income limit", {
        description: `This budget would exceed your income by ${formatMoney(overBy)}. Maximum available: ${formatMoney(totalIncome - currentAllocationExcludingEdit)}`,
      });
      return;
    }

    // Check for duplicate
    const duplicateBudget = budgets.find(
      (budget) =>
        budget.id !== editingBudget?.id &&
        normalizeCategory(budget.category).toLowerCase() === category.toLowerCase() &&
        budget.month === selectedMonth &&
        budget.year === selectedYear
    );

    if (duplicateBudget) {
      toast.error("Budget already exists for this category");
      return;
    }

    setLoading(true);

    try {
      if (editingBudget) {
        const { data, error } = await supabase
          .from("budgets")
          .update({ category, amount, month: selectedMonth, year: selectedYear })
          .eq("id", editingBudget.id)
          .eq("user_id", userId)
          .select()
          .single();

        if (error) throw error;

        setBudgets((current) =>
          current
            .map((item) => (item.id === editingBudget.id ? data : item))
            .sort((a, b) => normalizeCategory(a.category).localeCompare(normalizeCategory(b.category)))
        );
        toast.success("Budget updated successfully");
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
          .select()
          .single();

        if (error) throw error;

        setBudgets((current) =>
          [...current, data].sort((a, b) => normalizeCategory(a.category).localeCompare(normalizeCategory(b.category)))
        );
        toast.success("Budget created successfully");
      }

      closeModal();
      router.refresh();
    } catch (error: any) {
      toast.error("Failed to save budget", { description: error.message });
    } finally {
      setLoading(false);
    }
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
      toast.error("Failed to delete budget");
      setLoading(false);
      return;
    }

    setBudgets((current) => current.filter((item) => item.id !== deleteTarget.id));
    toast.success("Budget deleted successfully");
    setLoading(false);
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-emerald-400">Budget Management</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Budgets</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Allocate your income to spending categories. Total budgets cannot exceed monthly income.
          </p>
        </div>
       
      </div>

      {/* Warnings */}
      {(warningCount > 0 || exceededCount > 0) && (
        <div className="rounded-3xl border border-yellow-500/20 bg-yellow-500/10 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-yellow-500/10 text-yellow-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-yellow-100">Budget attention needed</h2>
              <p className="mt-1 text-sm text-yellow-200/80">
                {warningCount > 0 && `${warningCount} budget${warningCount > 1 ? 's' : ''} near limit. `}
                {exceededCount > 0 && `${exceededCount} budget${exceededCount > 1 ? 's' : ''} exceeded. `}
                Review spending for {formatMonth(selectedMonth, selectedYear)}.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3 KPIs */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard
          title="Total Income"
          value={formatMoney(totalIncome)}
          helper={`All income for ${formatMonth(selectedMonth, selectedYear)}`}
          icon={<DollarSign className="h-5 w-5" />}
          emphasis
        />
        <SummaryCard
          title="Expenses"
          value={formatMoney(totalBudgetAllocation)}
          helper={`${((totalBudgetAllocation / totalIncome) * 100 || 0).toFixed(1)}% of income allocated`}
          icon={<Target className="h-5 w-5" />}
        />
        <SummaryCard
          title="Remaining Budget Allocation"
          value={formatMoney(remainingBudgetAllocation)}
          helper={`Available to allocate from ${formatMoney(totalIncome)}`}
          icon={<CalendarDays className="h-5 w-5" />}
          emphasis={remainingBudgetAllocation > 0}
          warning={remainingBudgetAllocation === 0}
        />
      </section>

      {/* Budget Table */}
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Monthly Budget Limits</h2>
            <p className="text-sm text-slate-400">
              {filteredBudgetRows.length} of {budgetRows.length} shown •{" "}
              <span className="font-semibold text-emerald-400">
                {formatMoney(remainingBudgetAllocation)} remaining to allocate
              </span>
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
                placeholder="Search budgets..."
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
              disabled={!canAddBudget || loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
              title={!canAddBudget ? "No remaining allocation" : ""}
            >
              <Plus className="h-4 w-4" />
              New
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10">
          <div className="hidden grid-cols-9 bg-white/5 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400 md:grid">
            <span>Category</span>
            <span className="text-right">Allocated</span>
            <span className="text-right">Spent</span>
            <span className="text-right">Remaining</span>
            <span className="col-span-2">Progress</span>
            <span>Status</span>
            <span className="col-span-2 text-right">Actions</span>
          </div>

          {filteredBudgetRows.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-slate-400">
                <Target className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-semibold text-white">
                {totalIncome === 0 ? "No income found" : "No budgets set"}
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                {totalIncome === 0
                  ? "Add income transactions first to create budgets."
                  : "You have " + formatMoney(remainingBudgetAllocation) + " available to allocate."}
              </p>
            </div>
          ) : (
            filteredBudgetRows.map((budget) => (
              <div
                key={budget.id}
                className={`grid gap-4 border-t px-4 py-5 text-sm md:grid-cols-9 md:items-center md:gap-6 ${budget.status.cardClass} border-white/10 hover:bg-white/5`}
              >
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">Category</p>
                  <p className="font-semibold text-white">{budget.category}</p>
                </div>
                <div className="text-right md:text-right">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">Allocated</p>
                  <p className="font-medium text-slate-200">{formatMoney(budget.amount)}</p>
                </div>
                <div className="text-right md:text-right">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">Spent</p>
                  <p className="font-medium text-slate-200">{formatMoney(budget.used)}</p>
                </div>
                <div className="text-right md:text-right">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">Remaining</p>
                  <p className={`font-semibold ${budget.remaining < 0 ? "text-red-300" : "text-emerald-300"}`}>
                    {formatMoney(budget.remaining)}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                      Progress
                    </p>
                    <p className="text-xs font-semibold text-slate-300">{budget.percentage.toFixed(0)}%</p>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${budget.status.barClass}`}
                      style={{ width: `${budget.progressValue}%` }}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">Status</p>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${budget.status.badgeClass}`}
                    title={budget.status.description}
                  >
                    {budget.status.icon}
                    {budget.status.label}
                  </span>
                </div>
                <div className="md:col-span-2 flex flex-wrap items-center justify-end gap-2 md:justify-end">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">Actions</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setHistoryTarget(budget)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-all hover:bg-white/10 hover:text-white"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      History
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(budget)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-all hover:bg-white/10 hover:text-white"
                      aria-label="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(budget)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 transition-all hover:border-red-500/50 hover:bg-red-500/20"
                      aria-label="Delete"
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

      {/* Modals */}
      {modalOpen && (
        <BudgetModal
          title={editingBudget ? "Edit Budget" : "Add Budget"}
          form={form}
          setForm={setForm}
          categoryOptions={categoryOptions}
          totalIncome={totalIncome}
          totalBudgetAllocation={totalBudgetAllocation}
          remainingBudgetAllocation={remainingBudgetAllocation}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          loading={loading}
          onClose={closeModal}
          onSubmit={handleSubmit}
          onCategoryChange={handleCategoryChange}
        />
      )}

      {historyTarget && (
        <ExpenseHistoryModal
          budget={historyTarget}
          transactions={historyTransactions}
          onClose={() => setHistoryTarget(null)}
        />
      )}

      {customCategoryModalOpen && (
        <CustomCategoryModal
          value={newCategory}
          onChange={setNewCategory}
          onClose={() => {
            setNewCategory("");
            setCustomCategoryModalOpen(false);
          }}
          onAdd={addCustomCategory}
        />
      )}

      {deleteTarget && (
        <DeleteBudgetModal
          budget={deleteTarget}
          onClose={() => !loading && setDeleteTarget(null)}
          onDelete={handleDelete}
          loading={loading}
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
  emphasis = false,
  warning = false,
}: {
  title: string;
  value: string;
  helper: string;
  icon: ReactNode;
  danger?: boolean;
  emphasis?: boolean;
  warning?: boolean;
}) {
  return (
    <div
      className={`group rounded-3xl border p-6 shadow-2xl shadow-black/20 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:shadow-emerald-500/20 ${
        danger
          ? "border-red-500/30 bg-red-500/5"
          : warning
          ? "border-yellow-500/30 bg-yellow-500/5"
          : emphasis
          ? "border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5"
          : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <div
        className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl transition-all ${
          danger
            ? "bg-red-500/15 text-red-400 group-hover:bg-red-500/25"
            : warning
            ? "bg-yellow-500/15 text-yellow-400 group-hover:bg-yellow-500/25"
            : emphasis
            ? "bg-emerald-500/25 text-emerald-400 group-hover:bg-emerald-500/40"
            : "bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20"
        }`}
      >
        {icon}
      </div>
      <p className="text-sm font-medium text-slate-400">{title}</p>
      <h2 className={`mt-1 text-3xl font-bold tracking-tight ${
        danger ? "text-red-400" : 
        warning ? "text-yellow-400" : 
        emphasis ? "bg-gradient-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent" : 
        "text-white"
      }`}>
        {value}
      </h2>
      <p className="mt-2 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function BudgetModal({
  title,
  form,
  setForm,
  categoryOptions,
  totalIncome,
  totalBudgetAllocation,
  remainingBudgetAllocation,
  selectedMonth,
  selectedYear,
  loading,
  onClose,
  onSubmit,
  onCategoryChange,
}: {
  title: string;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  categoryOptions: string[];
  totalIncome: number;
  totalBudgetAllocation: number;
  remainingBudgetAllocation: number;
  selectedMonth: number;
  selectedYear: number;
  loading: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCategoryChange: (category: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm transition-opacity">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black/30">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">{title}</h2>
              <p className="mt-1 text-sm text-slate-400">
                {formatMonth(selectedMonth, selectedYear)} • Max available: {formatMoney(remainingBudgetAllocation)}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="grid h-10 w-10 place-items-center rounded-2xl text-slate-400 transition-all hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Category</label>
              <select
                value={form.category}
                onChange={(e) => onCategoryChange(e.target.value)}
                disabled={loading}
                required
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white transition-all focus:border-emerald-500/50 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 disabled:opacity-50"
              >
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category === "Other" ? "➕ Other / Custom category" : category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Amount</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                max={remainingBudgetAllocation}
                value={form.amount}
                onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
                disabled={loading}
                required
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white placeholder:text-slate-500 transition-all focus:border-emerald-500/50 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 disabled:opacity-50"
              />
            </div>

            {/* Income Summary */}
            <div className="space-y-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-emerald-300">Income Summary</span>
                <span className="text-sm font-semibold text-emerald-400">{formatMoney(totalIncome)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Allocated</span>
                <span>{formatMoney(totalBudgetAllocation)}</span>
              </div>
              <div className={`flex items-center justify-between text-sm font-semibold ${
                remainingBudgetAllocation === 0 ? "text-yellow-400" : "text-emerald-400"
              }`}>
                <span>Remaining to allocate</span>
                <span>{formatMoney(remainingBudgetAllocation)}</span>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-300 transition-all hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || Number(form.amount) > remainingBudgetAllocation}
                className="rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:bg-emerald-600 hover:shadow-emerald-500/40 disabled:cursor-not-allowed disabled:bg-emerald-500/50 disabled:shadow-none"
              >
                {loading ? "Saving..." : "Save Budget"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function ExpenseHistoryModal({
  budget,
  transactions,
  onClose,
}: {
  budget: BudgetRow;
  transactions: BudgetTransaction[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black/30 max-h-[90vh] overflow-hidden">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-400">Expense History</p>
              <h2 className="mt-1 text-2xl font-bold text-white">{budget.category}</h2>
            </div>
            <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-2xl text-slate-400 hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-slate-500">Allocated</p>
              <p className="font-semibold text-white">{formatMoney(budget.amount)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-slate-500">Spent</p>
              <p className="font-semibold text-white">{formatMoney(budget.used)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-slate-500">Balance</p>
              <p className={`font-semibold ${budget.remaining < 0 ? "text-red-400" : "text-emerald-400"}`}>
                {formatMoney(budget.remaining)}
              </p>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto rounded-2xl border border-white/10">
            {transactions.length === 0 ? (
              <div className="p-12 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-slate-400">
                  <CalendarDays className="h-8 w-8" />
                </div>
                <h3 className="mt-4 font-semibold text-white">No expenses</h3>
                <p className="mt-1 text-sm text-slate-400">No transactions found for this category.</p>
              </div>
            ) : (
              transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-4 border-t border-white/10 px-6 py-4 first:border-t-0 hover:bg-white/5">
                  <div className="flex-1">
                    <p className="font-semibold text-white">{normalizeCategory(t.category)}</p>
                    <p className="text-sm text-slate-400">{formatDate(t.transaction_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-red-400">-{formatMoney(t.amount)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomCategoryModal({
  value,
  onChange,
  onClose,
  onAdd,
}: {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">New Category</h2>
            <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-2xl text-slate-400 hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g. Gifts, Gym, Coffee"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
          />
          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-300 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onAdd}
              disabled={!value.trim()}
              className="rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600 hover:shadow-emerald-500/40 disabled:cursor-not-allowed disabled:bg-emerald-500/50"
            >
              Add Category
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteBudgetModal({
  budget,
  onClose,
  onDelete,
  loading,
}: {
  budget: Budget;
  onClose: () => void;
  onDelete: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
            <Trash2 className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Delete Budget?</h2>
          <p className="text-sm text-slate-400 mb-6">
            Remove <span className="font-semibold text-white">{normalizeCategory(budget.category)}</span> budget of{" "}
            <span className="font-semibold text-white">{formatMoney(budget.amount)}</span>?
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              onClick={onClose}
              disabled={loading}
              className="rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-300 hover:bg-white/10 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onDelete}
              disabled={loading}
              className="rounded-2xl bg-red-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-red-500/25 hover:bg-red-600 hover:shadow-red-500/40 disabled:cursor-not-allowed disabled:bg-red-500/50"
            >
              {loading ? "Deleting..." : "Delete Budget"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}