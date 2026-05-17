"use client";

import type {
  Transaction,
  TransactionBudget,
} from "@/app/transactions/page";
import { supabase } from "@/lib/supabase/client";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Edit,
  Eye,
  Lock,
  Plus,
  Search,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const defaultExpenseCategories = [
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

const incomeSources = ["Monthly Salary", "Allowance", "Other Income"];

type FormState = {
  type: "income" | "expense";
  amount: string;
  category: string;
  note: string;
  transaction_date: string;
};

type DailySummary = {
  dateKey: string;
  income: number;
  expenses: number;
  count: number;
  hasIncome: boolean;
  hasExpense: boolean;
};

type TransactionLimitState = {
  totalIncome: number;
  totalExpenses: number;
  adjustedIncome: number;
  adjustedExpenses: number;
  projectedIncome: number;
  projectedExpenses: number;
  availableBeforeTransaction: number;
  projectedBalance: number;
  isAmountEntered: boolean;
  isLimitExceeded: boolean;
  title: string;
  description: string;
};

const emptyForm: FormState = {
  type: "expense",
  amount: "",
  category: "Food",
  note: "",
  transaction_date: getTodayDate(),
};

function formatMoney(value: number | string) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatLongDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Intl.DateTimeFormat("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatMonth(month: number, year: number) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function getTodayDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeCategory(category: string | null | undefined) {
  return category?.trim() || "Uncategorized";
}

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonthYearFromDate(value: string) {
  const [year, month] = value.split("-").map(Number);

  return {
    month,
    year,
  };
}

function sortTransactions(items: Transaction[]) {
  return [...items].sort((a, b) => {
    const dateCompare =
      new Date(b.transaction_date).getTime() -
      new Date(a.transaction_date).getTime();

    if (dateCompare !== 0) return dateCompare;

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function buildMonthDays(month: number, year: number) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const leadingBlankDays = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  return [
    ...Array.from({ length: leadingBlankDays }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const date = new Date(year, month - 1, day);

      return {
        day,
        dateKey: getDateKey(date),
      };
    }),
  ];
}

export default function TransactionManager({
  userId,
  initialTransactions,
  initialBudgets,
}: {
  userId: string;
  initialTransactions: Transaction[];
  initialBudgets: TransactionBudget[];
}) {
  const router = useRouter();

  const [transactions, setTransactions] =
    useState<Transaction[]>(initialTransactions);

  const [budgets] = useState<TransactionBudget[]>(initialBudgets);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">(
    "all"
  );
  const [categoryFilter, setCategoryFilter] = useState("all");

  const currentDate = new Date();
  const [calendarMonth, setCalendarMonth] = useState(
    currentDate.getMonth() + 1
  );
  const [calendarYear, setCalendarYear] = useState(currentDate.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [budgetHistoryTarget, setBudgetHistoryTarget] =
    useState<Transaction | null>(null);

  const [loading, setLoading] = useState(false);

  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [customCategoryModalOpen, setCustomCategoryModalOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const [form, setForm] = useState<FormState>(emptyForm);

  const budgetCategories = useMemo(() => {
    return budgets
      .map((budget) => normalizeCategory(budget.category))
      .filter((category) => category !== "Uncategorized");
  }, [budgets]);

  const expenseCategories = useMemo(() => {
    return Array.from(
      new Set(
        [...defaultExpenseCategories, ...budgetCategories, ...customCategories]
          .filter(Boolean)
          .map((category) => String(category).trim())
      )
    ).sort((a, b) => {
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return a.localeCompare(b);
    });
  }, [budgetCategories, customCategories]);

  const allCategories = useMemo(() => {
    return Array.from(new Set([...expenseCategories, ...incomeSources])).sort(
      (a, b) => a.localeCompare(b)
    );
  }, [expenseCategories]);

  const totalIncome = useMemo(() => {
    return transactions
      .filter((transaction) => transaction.type === "income")
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  }, [transactions]);

  const totalExpenses = useMemo(() => {
    return transactions
      .filter((transaction) => transaction.type === "expense")
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  }, [transactions]);

  const transactionLimitState = useMemo<TransactionLimitState>(() => {
    const amount = Number(form.amount);
    const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;

    const oldIncomeAmount =
      editingTransaction?.type === "income"
        ? Number(editingTransaction.amount)
        : 0;

    const oldExpenseAmount =
      editingTransaction?.type === "expense"
        ? Number(editingTransaction.amount)
        : 0;

    const adjustedIncome = totalIncome - oldIncomeAmount;
    const adjustedExpenses = totalExpenses - oldExpenseAmount;

    const projectedIncome =
      adjustedIncome + (form.type === "income" ? safeAmount : 0);

    const projectedExpenses =
      adjustedExpenses + (form.type === "expense" ? safeAmount : 0);

    const availableBeforeTransaction = adjustedIncome - adjustedExpenses;
    const projectedBalance = projectedIncome - projectedExpenses;
    const isAmountEntered = form.amount.trim().length > 0 && safeAmount > 0;
    const isLimitExceeded = isAmountEntered && projectedExpenses > projectedIncome;

    let title = "Transaction allowed";
    let description =
      "This transaction keeps your total expenses within your total income.";

    if (form.type === "expense") {
      title = isLimitExceeded
        ? "Expense limit exceeded"
        : "Expense is within your income limit";

      description = isLimitExceeded
        ? `You can only spend ${formatMoney(
            Math.max(availableBeforeTransaction, 0)
          )}. This expense would make your total expenses exceed your total income.`
        : `Available spending balance before this transaction: ${formatMoney(
            Math.max(availableBeforeTransaction, 0)
          )}.`;
    }

    if (form.type === "income" && editingTransaction?.type === "income") {
      title = isLimitExceeded
        ? "Income change not allowed"
        : "Income change is allowed";

      description = isLimitExceeded
        ? `Reducing this income would make your total expenses exceed your total income. Projected balance: ${formatMoney(
            projectedBalance
          )}.`
        : `Projected balance after this update: ${formatMoney(
            projectedBalance
          )}.`;
    }

    if (form.type === "income" && editingTransaction?.type === "expense") {
      title = "Converting expense to income";
      description = `Projected balance after this update: ${formatMoney(
        projectedBalance
      )}.`;
    }

    if (form.type === "expense" && editingTransaction?.type === "income") {
      title = isLimitExceeded
        ? "Conversion not allowed"
        : "Conversion is allowed";

      description = isLimitExceeded
        ? `Changing this income into an expense would make your total expenses exceed your total income. Projected balance: ${formatMoney(
            projectedBalance
          )}.`
        : `Projected balance after this update: ${formatMoney(
            projectedBalance
          )}.`;
    }

    return {
      totalIncome,
      totalExpenses,
      adjustedIncome,
      adjustedExpenses,
      projectedIncome,
      projectedExpenses,
      availableBeforeTransaction,
      projectedBalance,
      isAmountEntered,
      isLimitExceeded,
      title,
      description,
    };
  }, [form.amount, form.type, totalIncome, totalExpenses, editingTransaction]);

  const matchingBudget = useMemo(() => {
    if (form.type !== "expense" || !form.transaction_date) return null;

    const { month, year } = getMonthYearFromDate(form.transaction_date);

    return (
      budgets.find(
        (budget) =>
          normalizeCategory(budget.category).toLowerCase() ===
            form.category.toLowerCase() &&
          Number(budget.month) === month &&
          Number(budget.year) === year
      ) ?? null
    );
  }, [form.type, form.category, form.transaction_date, budgets]);

  const filteredTransactions = useMemo(() => {
    const searchValue = search.toLowerCase().trim();

    return transactions.filter((transaction) => {
      const matchesSearch =
        transaction.category.toLowerCase().includes(searchValue) ||
        transaction.note?.toLowerCase().includes(searchValue) ||
        String(transaction.amount).includes(searchValue) ||
        transaction.transaction_date.includes(searchValue);

      const matchesType =
        typeFilter === "all" || transaction.type === typeFilter;

      const matchesCategory =
        categoryFilter === "all" || transaction.category === categoryFilter;

      return matchesSearch && matchesType && matchesCategory;
    });
  }, [transactions, search, typeFilter, categoryFilter]);

  const calendarDays = useMemo(() => {
    return buildMonthDays(calendarMonth, calendarYear);
  }, [calendarMonth, calendarYear]);

  const dailySummaries = useMemo(() => {
    const map = new Map<string, DailySummary>();

    transactions.forEach((transaction) => {
      const dateKey = transaction.transaction_date;
      const existing = map.get(dateKey) ?? {
        dateKey,
        income: 0,
        expenses: 0,
        count: 0,
        hasIncome: false,
        hasExpense: false,
      };

      if (transaction.type === "income") {
        existing.income += Number(transaction.amount);
        existing.hasIncome = true;
      } else {
        existing.expenses += Number(transaction.amount);
        existing.hasExpense = true;
      }

      existing.count += 1;
      map.set(dateKey, existing);
    });

    return map;
  }, [transactions]);

  const selectedDateTransactions = useMemo(() => {
    if (!selectedDate) return [];

    return sortTransactions(
      transactions.filter(
        (transaction) => transaction.transaction_date === selectedDate
      )
    );
  }, [selectedDate, transactions]);

  const selectedDateSummary = useMemo(() => {
    if (!selectedDate) return null;

    return (
      dailySummaries.get(selectedDate) ?? {
        dateKey: selectedDate,
        income: 0,
        expenses: 0,
        count: 0,
        hasIncome: false,
        hasExpense: false,
      }
    );
  }, [selectedDate, dailySummaries]);

  function getBudgetForTransaction(transaction: Transaction) {
    if (transaction.type !== "expense") return null;

    const { month, year } = getMonthYearFromDate(transaction.transaction_date);

    return (
      budgets.find(
        (budget) =>
          normalizeCategory(budget.category).toLowerCase() ===
            transaction.category.toLowerCase() &&
          Number(budget.month) === month &&
          Number(budget.year) === year
      ) ?? null
    );
  }

  function getBudgetUsedAmount(budget: TransactionBudget) {
    return transactions
      .filter((transaction) => {
        const { month, year } = getMonthYearFromDate(
          transaction.transaction_date
        );

        return (
          transaction.type === "expense" &&
          transaction.category.toLowerCase() ===
            normalizeCategory(budget.category).toLowerCase() &&
          month === Number(budget.month) &&
          year === Number(budget.year)
        );
      })
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  }

  function goToPreviousMonth() {
    if (calendarMonth === 1) {
      setCalendarMonth(12);
      setCalendarYear((current) => current - 1);
      return;
    }

    setCalendarMonth((current) => current - 1);
  }

  function goToNextMonth() {
    if (calendarMonth === 12) {
      setCalendarMonth(1);
      setCalendarYear((current) => current + 1);
      return;
    }

    setCalendarMonth((current) => current + 1);
  }

  function goToCurrentMonth() {
    const today = new Date();

    setCalendarMonth(today.getMonth() + 1);
    setCalendarYear(today.getFullYear());
  }

  function openAddIncomeModal() {
    setEditingTransaction(null);
    setForm({
      type: "income",
      amount: "",
      category: incomeSources[0],
      note: "",
      transaction_date: getTodayDate(),
    });
    setExpenseModalOpen(false);
    setIncomeModalOpen(true);
  }

  function openAddExpenseModal() {
    setEditingTransaction(null);
    setForm({
      type: "expense",
      amount: "",
      category: expenseCategories[0] ?? "Food",
      note: "",
      transaction_date: getTodayDate(),
    });
    setIncomeModalOpen(false);
    setExpenseModalOpen(true);
  }

  function openEditModal(transaction: Transaction) {
    setEditingTransaction(transaction);
    setForm({
      type: transaction.type,
      amount: String(transaction.amount),
      category: transaction.category,
      note: transaction.note ?? "",
      transaction_date: transaction.transaction_date,
    });

    if (transaction.type === "income") {
      setExpenseModalOpen(false);
      setIncomeModalOpen(true);
      return;
    }

    setIncomeModalOpen(false);
    setExpenseModalOpen(true);
  }

  function closeModal() {
    if (loading) return;

    setIncomeModalOpen(false);
    setExpenseModalOpen(false);
    setEditingTransaction(null);
    setForm(emptyForm);
  }

  function handleCategoryChange(category: string) {
    if (category === "Other") {
      setCustomCategoryModalOpen(true);
      return;
    }

    setForm((current) => ({
      ...current,
      category,
    }));
  }

  function addCustomCategory() {
    const category = newCategory.trim();

    if (!category) {
      toast.error("Missing category", {
        description: "Please enter a custom category name.",
      });
      return;
    }

    const alreadyExists = expenseCategories.some(
      (item) => item.toLowerCase() === category.toLowerCase()
    );

    if (alreadyExists) {
      toast.error("Category already exists", {
        description: `${category} is already available.`,
      });
      return;
    }

    setCustomCategories((current) =>
      [...current, category].sort((a, b) => a.localeCompare(b))
    );

    setForm((current) => ({
      ...current,
      type: "expense",
      category,
    }));

    setNewCategory("");
    setCustomCategoryModalOpen(false);

    toast.success("Category added", {
      description: `${category} can now be used for expense transactions.`,
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();

  // Global expense lock check
  const isExpenseLockedGlobally = totalIncome <= totalExpenses;
  if (form.type === "expense" && isExpenseLockedGlobally) {
    toast.error("Expenses Locked", {
      description: `Total income (${formatMoney(totalIncome)}) ≤ total expenses (${formatMoney(totalExpenses)}). Add income first.`,
      duration: 6000,
    });
    return;
  }

  const amount = Number(form.amount);
  const category = form.category.trim();

  if (!amount || amount <= 0) {
    toast.error("Invalid amount", {
      description: "Amount must be greater than zero.",
    });
    return;
  }

    if (!category || category === "Other") {
      toast.error("Missing category", {
        description:
          form.type === "income"
            ? "Please select an income source."
            : "Please select or create an expense category.",
      });
      return;
    }

    const validCategories =
      form.type === "income" ? incomeSources : expenseCategories;

    if (!validCategories.includes(category)) {
      toast.error("Invalid category", {
        description: "Please choose a valid option from the dropdown.",
      });
      return;
    }

    if (!form.transaction_date) {
      toast.error("Missing date", {
        description: "Please select a transaction date.",
      });
      return;
    }

    if (transactionLimitState.isLimitExceeded) {
      toast.error(transactionLimitState.title, {
        description: `${transactionLimitState.description} Current income: ${formatMoney(
          transactionLimitState.projectedIncome
        )}. Projected expenses: ${formatMoney(
          transactionLimitState.projectedExpenses
        )}.`,
        duration: 6000,
      });
      return;
    }

    setLoading(true);

    const payload = {
      type: form.type,
      amount,
      category,
      note: form.note.trim() || null,
      transaction_date: form.transaction_date,
    };

    if (editingTransaction) {
      const { data, error } = await supabase
        .from("transactions")
        .update(payload)
        .eq("id", editingTransaction.id)
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

      setTransactions((current) =>
        sortTransactions(
          current.map((item) =>
            item.id === editingTransaction.id ? (data as Transaction) : item
          )
        )
      );

      toast.success("Transaction updated", {
        description: `Projected balance is now ${formatMoney(
          transactionLimitState.projectedBalance
        )}.`,
      });
    } else {
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          ...payload,
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

      setTransactions((current) =>
        sortTransactions([data as Transaction, ...current])
      );

      toast.success("Transaction added", {
        description:
          form.type === "expense"
            ? `Expense saved. Remaining balance is ${formatMoney(
                transactionLimitState.projectedBalance
              )}.`
            : `Income saved. Projected balance is ${formatMoney(
                transactionLimitState.projectedBalance
              )}.`,
      });
    }

    setLoading(false);
    setIncomeModalOpen(false);
    setExpenseModalOpen(false);
    setEditingTransaction(null);
    setForm(emptyForm);
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    setLoading(true);

    const { error } = await supabase
      .from("transactions")
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

    setTransactions((current) =>
      current.filter((item) => item.id !== deleteTarget.id)
    );

    toast.success("Transaction deleted", {
      description:
        deleteTarget.type === "expense"
          ? `${deleteTarget.category} expense was removed. Your available balance will increase.`
          : `${deleteTarget.category} income was removed from your records.`,
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
            Income & Expense Tracking
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Expenses
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Record income and expenses. Expenses are locked when they would make
            your total expenses exceed your total income.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={openAddIncomeModal}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600"
          >
            <Plus className="h-4 w-4" />
            Add Income
          </button>

          <button
            type="button"
            onClick={openAddExpenseModal}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-red-500/20 transition hover:bg-red-600"
          >
            <Plus className="h-4 w-4" />
            Add Expense
          </button>
        </div>
      </div>

      <TransactionCalendarSummary
        month={calendarMonth}
        year={calendarYear}
        days={calendarDays}
        summaries={dailySummaries}
        onPreviousMonth={goToPreviousMonth}
        onNextMonth={goToNextMonth}
        onCurrentMonth={goToCurrentMonth}
        onSelectDate={setSelectedDate}
      />

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-5">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Transaction Records
            </h2>
            <p className="text-sm text-slate-400">
              {filteredTransactions.length} record
              {filteredTransactions.length === 1 ? "" : "s"} found
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:flex">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search category, note, amount, or date..."
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-10 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 lg:w-80"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as "all" | "income" | "expense")
              }
              className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10"
            >
              <option value="all">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10"
            >
              <option value="all">All Categories</option>
              {allCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10">
          <div className="hidden grid-cols-8 bg-white/5 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400 md:grid">
            <span>Date</span>
            <span>Category / Source</span>
            <span>Type</span>
            <span className="col-span-2">Note</span>
            <span className="text-right">Amount</span>
            <span className="col-span-2 text-right">Actions</span>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-slate-400">
                <WalletCards className="h-6 w-6" />
              </div>

              <h3 className="mt-4 font-semibold text-white">
                No transactions found
              </h3>

              <p className="mt-1 text-sm text-slate-400">
                Add your first income or expense record.
              </p>
            </div>
          ) : (
            filteredTransactions.map((transaction) => {
              const connectedBudget = getBudgetForTransaction(transaction);

              return (
                <div
                  key={transaction.id}
                  className="grid gap-3 border-t border-white/10 px-4 py-4 text-sm md:grid-cols-8 md:items-center"
                >
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                      Date
                    </p>
                    <p className="text-slate-400">
                      {formatDate(transaction.transaction_date)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                      Category / Source
                    </p>
                    <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                      {transaction.category}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                      Type
                    </p>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                        transaction.type === "income"
                          ? "bg-emerald-500/10 text-emerald-300"
                          : "bg-red-500/10 text-red-300"
                      }`}
                    >
                      {transaction.type}
                    </span>
                  </div>

                  <div className="md:col-span-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                      Note
                    </p>
                    <p className="line-clamp-2 text-slate-400">
                      {transaction.note || "No note"}
                    </p>

                    {transaction.type === "expense" && (
                      <p
                        className={`mt-1 text-xs ${
                          connectedBudget
                            ? "text-emerald-300"
                            : "text-yellow-300"
                        }`}
                      >
                        {connectedBudget
                          ? "Connected to budget"
                          : "No matching budget"}
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                      Amount
                    </p>
                    <p
                      className={`font-semibold md:text-right ${
                        transaction.type === "income"
                          ? "text-emerald-400"
                          : "text-red-300"
                      }`}
                    >
                      {transaction.type === "income" ? "+" : "-"}
                      {formatMoney(transaction.amount)}
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                      Actions
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2 md:mt-0 md:justify-end">
                      {transaction.type === "expense" && (
                        <button
                          type="button"
                          onClick={() => setBudgetHistoryTarget(transaction)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
                        >
                          <Eye className="h-4 w-4" />
                          Budget
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openEditModal(transaction)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
                        aria-label="Edit transaction"
                      >
                        <Edit className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(transaction)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 transition hover:bg-red-500/20"
                        aria-label="Delete transaction"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {selectedDate && selectedDateSummary && (
        <DailyTransactionModal
          date={selectedDate}
          summary={selectedDateSummary}
          transactions={selectedDateTransactions}
          onClose={() => setSelectedDate(null)}
        />
      )}

      {incomeModalOpen && (
        <TransactionModal
          title={editingTransaction ? "Edit Income" : "Add Income"}
          isEditing={Boolean(editingTransaction)}
          form={form}
          setForm={setForm}
          loading={loading}
          matchingBudget={matchingBudget}
          expenseCategories={expenseCategories}
          transactionLimitState={transactionLimitState}
          onClose={closeModal}
          onSubmit={handleSubmit}
          onCategoryChange={handleCategoryChange}
        />
      )}

      {expenseModalOpen && (
        <TransactionModal
          title={editingTransaction ? "Edit Expense" : "Add Expense"}
          isEditing={Boolean(editingTransaction)}
          form={form}
          setForm={setForm}
          loading={loading}
          matchingBudget={matchingBudget}
          expenseCategories={expenseCategories}
          transactionLimitState={transactionLimitState}
          onClose={closeModal}
          onSubmit={handleSubmit}
          onCategoryChange={handleCategoryChange}
        />
      )}

      {budgetHistoryTarget && (
        <BudgetConnectionModal
          transaction={budgetHistoryTarget}
          budget={getBudgetForTransaction(budgetHistoryTarget)}
          usedAmount={
            getBudgetForTransaction(budgetHistoryTarget)
              ? getBudgetUsedAmount(getBudgetForTransaction(budgetHistoryTarget)!)
              : 0
          }
          relatedTransactions={transactions.filter((transaction) => {
            const budget = getBudgetForTransaction(budgetHistoryTarget);
            if (!budget) return false;

            const { month, year } = getMonthYearFromDate(
              transaction.transaction_date
            );

            return (
              transaction.type === "expense" &&
              transaction.category.toLowerCase() ===
                budgetHistoryTarget.category.toLowerCase() &&
              month === Number(budget.month) &&
              year === Number(budget.year)
            );
          })}
          onClose={() => setBudgetHistoryTarget(null)}
        />
      )}

      {customCategoryModalOpen && (
        <CustomCategoryModal
          value={newCategory}
          loading={loading}
          onChange={setNewCategory}
          onClose={() => {
            setNewCategory("");
            setCustomCategoryModalOpen(false);
          }}
          onAdd={addCustomCategory}
        />
      )}

      {deleteTarget && (
        <DeleteModal
          transaction={deleteTarget}
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

function TransactionCalendarSummary({
  month,
  year,
  days,
  summaries,
  onPreviousMonth,
  onNextMonth,
  onCurrentMonth,
  onSelectDate,
}: {
  month: number;
  year: number;
  days: ({ day: number; dateKey: string } | null)[];
  summaries: Map<string, DailySummary>;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onCurrentMonth: () => void;
  onSelectDate: (date: string) => void;
}) {
  const today = getTodayDate();
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const activeDaysCount = Array.from(summaries.values()).filter((summary) => {
    const { month: summaryMonth, year: summaryYear } = getMonthYearFromDate(
      summary.dateKey
    );

    return summaryMonth === month && summaryYear === year;
  }).length;

  return (
    <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
            <CalendarDays className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white">
              Transaction Calendar Summary
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Click any date to review that day’s income, expenses, and net
              balance.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={onPreviousMonth}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <p className="min-w-40 text-center text-sm font-semibold text-white">
              {formatMonth(month, year)}
            </p>

            <button
              type="button"
              onClick={onNextMonth}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={onCurrentMonth}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
          >
            Today
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-slate-500">Month</p>
          <p className="mt-1 font-semibold text-white">
            {formatMonth(month, year)}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-slate-500">Days with Records</p>
          <p className="mt-1 font-semibold text-white">
            {activeDaysCount} day{activeDaysCount === 1 ? "" : "s"}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-slate-500">Legend</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-300">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              Income
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
              Expense
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <div className="grid grid-cols-7 bg-white/5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
          {weekDays.map((day) => (
            <div key={day} className="px-2 py-3">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            if (!day) {
              return (
                <div
                  key={`blank-${index}`}
                  className="min-h-20 border-t border-white/10 bg-white/[0.02] p-2 sm:min-h-24"
                />
              );
            }

            const summary = summaries.get(day.dateKey);
            const isToday = day.dateKey === today;

            return (
              <button
                key={day.dateKey}
                type="button"
                onClick={() => onSelectDate(day.dateKey)}
                className={`group min-h-20 border-t border-white/10 p-2 text-left transition hover:bg-white/10 sm:min-h-24 ${
                  isToday ? "bg-emerald-500/10" : "bg-white/[0.03]"
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                      isToday
                        ? "bg-emerald-500 text-white"
                        : "text-slate-300 group-hover:bg-white/10 group-hover:text-white"
                    }`}
                  >
                    {day.day}
                  </span>

                  {summary && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                      {summary.count}
                    </span>
                  )}
                </div>

                {summary && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-1.5">
                      {summary.hasIncome && (
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                      )}
                      {summary.hasExpense && (
                        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                      )}
                    </div>

                    <p className="hidden truncate text-[11px] text-slate-400 sm:block">
                      Net{" "}
                      <span
                        className={
                          summary.income - summary.expenses >= 0
                            ? "text-emerald-300"
                            : "text-red-300"
                        }
                      >
                        {formatMoney(summary.income - summary.expenses)}
                      </span>
                    </p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DailyTransactionModal({
  date,
  summary,
  transactions,
  onClose,
}: {
  date: string;
  summary: DailySummary;
  transactions: Transaction[];
  onClose: () => void;
}) {
  const incomeTransactions = transactions.filter(
    (transaction) => transaction.type === "income"
  );
  const expenseTransactions = transactions.filter(
    (transaction) => transaction.type === "expense"
  );
  const netBalance = summary.income - summary.expenses;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm sm:flex sm:items-center sm:justify-center">
      <div className="mx-auto my-4 w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-950 p-5 shadow-2xl shadow-black">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-emerald-400">
              Daily Financial Review
            </p>
            <h2 className="mt-1 text-xl font-bold text-white">
              {formatLongDate(date)}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Showing income and expense records for this date only.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <p className="text-xs text-emerald-200/80">Daily Income</p>
            <p className="mt-1 text-lg font-bold text-emerald-300">
              {formatMoney(summary.income)}
            </p>
          </div>

          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
            <p className="text-xs text-red-200/80">Daily Expenses</p>
            <p className="mt-1 text-lg font-bold text-red-300">
              {formatMoney(summary.expenses)}
            </p>
          </div>

          <div
            className={`rounded-2xl border p-4 ${
              netBalance >= 0
                ? "border-emerald-500/20 bg-emerald-500/10"
                : "border-red-500/20 bg-red-500/10"
            }`}
          >
            <p
              className={`text-xs ${
                netBalance >= 0 ? "text-emerald-200/80" : "text-red-200/80"
              }`}
            >
              Daily Net Balance
            </p>
            <p
              className={`mt-1 text-lg font-bold ${
                netBalance >= 0 ? "text-emerald-300" : "text-red-300"
              }`}
            >
              {formatMoney(netBalance)}
            </p>
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-slate-400">
              <CalendarDays className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-semibold text-white">
              No records for this date
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              Add a transaction using this date to see it here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <DailyTransactionGroup
              title="Income Transactions"
              type="income"
              items={incomeTransactions}
            />

            <DailyTransactionGroup
              title="Expense Transactions"
              type="expense"
              items={expenseTransactions}
            />
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DailyTransactionGroup({
  title,
  type,
  items,
}: {
  title: string;
  type: "income" | "expense";
  items: Transaction[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <div className="border-b border-white/10 bg-white/5 px-4 py-3">
        <h3 className="font-semibold text-white">{title}</h3>
        <p className="text-xs text-slate-400">
          {items.length} record{items.length === 1 ? "" : "s"}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-slate-400">
          No {type} records for this date.
        </div>
      ) : (
        <div className="max-h-[40vh] overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-2 border-t border-white/10 px-4 py-4 first:border-t-0 sm:flex-row sm:items-start sm:justify-between"
            >
              <div>
                <p className="font-semibold text-white">{item.category}</p>
                <p className="mt-1 text-sm text-slate-400">
                  {item.note || "No note"}
                </p>
              </div>

              <p
                className={`font-bold ${
                  type === "income" ? "text-emerald-300" : "text-red-300"
                }`}
              >
                {type === "income" ? "+" : "-"}
                {formatMoney(item.amount)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function TransactionModal({
  title,
  isEditing,
  form,
  setForm,
  loading,
  matchingBudget,
  expenseCategories,
  transactionLimitState,
  onClose,
  onSubmit,
  onCategoryChange,
}: {
  title: string;
  isEditing: boolean;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  loading: boolean;
  matchingBudget: TransactionBudget | null;
  expenseCategories: string[];
  transactionLimitState: TransactionLimitState;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCategoryChange: (category: string) => void;
}) {
  const activeCategories =
    form.type === "income" ? incomeSources : expenseCategories;

  const saveDisabled =
    loading || transactionLimitState.isLimitExceeded;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6">
      <div className="relative flex w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl shadow-black max-h-[95vh]">

        {/* HEADER */}
        <div className="flex shrink-0 items-start justify-between border-b border-white/10 px-5 py-4 sm:px-6">
          <div className="pr-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              {title}
            </h2>

            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              {form.type === "income"
                ? "Record salary, allowance, or other income."
                : "Record expenses only when they fit within your available balance."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          <form onSubmit={onSubmit} className="space-y-5">

            {/* FIXED TRANSACTION TYPE */}
            <div
              className={`rounded-2xl border p-4 ${
                form.type === "income"
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                  : "border-red-500/20 bg-red-500/10 text-red-200"
              }`}
            >
              <p className="text-sm font-semibold">
                {form.type === "income" ? "Income Form" : "Expense Form"}
              </p>
              <p className="mt-1 text-xs opacity-90">
                {form.type === "income"
                  ? "This modal is only for income records. Use Add Expense for expenses."
                  : "This modal is only for expense records. Use Add Income for income."}
              </p>
            </div>

            {/* MAIN GRID */}
            <div className="grid gap-5 xl:grid-cols-[1fr_420px]">

              {/* LEFT SIDE */}
              <div className="space-y-5">

                {/* FORM GRID */}
                <div className="grid gap-5 md:grid-cols-2">

                  {/* AMOUNT */}
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-slate-300">
                      Amount
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
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-60"
                    />
                  </div>

                  {/* CATEGORY */}
                  <div>
                    <label className="text-sm font-medium text-slate-300">
                      {form.type === "income"
                        ? "Income Source"
                        : "Expense Category"}
                    </label>

                    <select
                      value={form.category}
                      onChange={(e) =>
                        onCategoryChange(e.target.value)
                      }
                      required
                      disabled={loading}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-4 text-sm text-white outline-none transition focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-60"
                    >
                      {activeCategories.map((category) => (
                        <option
                          key={category}
                          value={category}
                        >
                          {category === "Other"
                            ? "Other / Add custom category"
                            : category}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* DATE */}
                  <div>
                    <label className="text-sm font-medium text-slate-300">
                      Date
                    </label>

                    <input
                      type="date"
                      value={form.transaction_date}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          transaction_date: e.target.value,
                        }))
                      }
                      required
                      disabled={loading}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white outline-none transition focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-60"
                    />
                  </div>

                  {/* NOTE */}
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-slate-300">
                      Note
                    </label>

                    <textarea
                      value={form.note}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          note: e.target.value,
                        }))
                      }
                      placeholder="Optional note..."
                      rows={5}
                      disabled={loading}
                      className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-60"
                    />
                  </div>
                </div>

                {/* WARNING */}
                {transactionLimitState.isLimitExceeded && (
                  <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />

                    <p>
                      Save is locked because this transaction would
                      make your total expenses higher than your total
                      income.
                    </p>
                  </div>
                )}
              </div>

              {/* RIGHT SIDE */}
              <div className="space-y-5">

                {/* LIMIT CARD */}
                <div
                  className={`rounded-3xl border p-5 text-sm ${
                    transactionLimitState.isLimitExceeded
                      ? "border-red-500/20 bg-red-500/10 text-red-200"
                      : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                  }`}
                >
                  <div className="flex gap-4">

                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                        transactionLimitState.isLimitExceeded
                          ? "bg-red-500/20"
                          : "bg-emerald-500/20"
                      }`}
                    >
                      {transactionLimitState.isLimitExceeded ? (
                        <Lock className="h-5 w-5" />
                      ) : (
                        <WalletCards className="h-5 w-5" />
                      )}
                    </div>

                    <div className="flex-1">
                      <p className="text-base font-semibold">
                        {transactionLimitState.title}
                      </p>

                      <p className="mt-1 text-sm opacity-90">
                        {transactionLimitState.description}
                      </p>

                      <div className="mt-4 grid grid-cols-3 gap-3">

                        <div className="rounded-2xl bg-black/10 p-3">
                          <p className="text-xs opacity-70">
                            Income
                          </p>

                          <p className="mt-1 font-semibold">
                            {formatMoney(
                              transactionLimitState.projectedIncome
                            )}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-black/10 p-3">
                          <p className="text-xs opacity-70">
                            Expenses
                          </p>

                          <p className="mt-1 font-semibold">
                            {formatMoney(
                              transactionLimitState.projectedExpenses
                            )}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-black/10 p-3">
                          <p className="text-xs opacity-70">
                            Balance
                          </p>

                          <p className="mt-1 font-semibold">
                            {formatMoney(
                              transactionLimitState.projectedBalance
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* BUDGET CARD */}
                {form.type === "expense" && (
                  <div
                    className={`rounded-3xl border p-5 text-sm ${
                      matchingBudget
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                        : "border-yellow-500/20 bg-yellow-500/10 text-yellow-200"
                    }`}
                  >
                    {matchingBudget ? (
                      <div>
                        <p className="font-semibold">
                          Budget Match Found
                        </p>

                        <p className="mt-2 leading-relaxed">
                          This expense matches your{" "}
                          <span className="font-semibold">
                            {normalizeCategory(
                              matchingBudget.category
                            )}
                          </span>{" "}
                          budget worth{" "}
                          <span className="font-semibold">
                            {formatMoney(
                              matchingBudget.amount
                            )}
                          </span>
                          .
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-semibold">
                          No Matching Budget
                        </p>

                        <p className="mt-2 leading-relaxed">
                          No budget was found for this category and
                          date. You can still save this transaction if
                          it stays within your available balance.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* FOOTER */}
            <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">

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
                disabled={saveDisabled}
                className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  transactionLimitState.isLimitExceeded
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-emerald-500 hover:bg-emerald-600"
                }`}
              >
                {loading ? (
                  "Saving..."
                ) : transactionLimitState.isLimitExceeded ? (
                  <>
                    <Lock className="h-4 w-4" />
                    Save Locked
                  </>
                ) : isEditing ? (
                  `Update ${form.type === "income" ? "Income" : "Expense"}`
                ) : (
                  `Save ${form.type === "income" ? "Income" : "Expense"}`
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function BudgetConnectionModal({
  transaction,
  budget,
  usedAmount,
  relatedTransactions,
  onClose,
}: {
  transaction: Transaction;
  budget: TransactionBudget | null;
  usedAmount: number;
  relatedTransactions: Transaction[];
  onClose: () => void;
}) {
  const budgetAmount = Number(budget?.amount ?? 0);
  const remaining = budgetAmount - usedAmount;
  const percentage = budgetAmount > 0 ? (usedAmount / budgetAmount) * 100 : 0;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm sm:flex sm:items-center sm:justify-center">
      <div className="mx-auto my-4 w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-950 p-5 shadow-2xl shadow-black">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-emerald-400">
              Budget Connection
            </p>
            <h2 className="mt-1 text-xl font-bold text-white">
              {transaction.category}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              This shows how this transaction connects to its matching budget.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!budget ? (
          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-200">
            No matching budget was found for this transaction category and
            month. Create a budget for {transaction.category} to track this
            expense.
          </div>
        ) : (
          <>
            <div className="mb-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-slate-500">Budget Month</p>
                <p className="mt-1 font-semibold text-white">
                  {formatMonth(Number(budget.month), Number(budget.year))}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-slate-500">Budget Limit</p>
                <p className="mt-1 font-semibold text-white">
                  {formatMoney(budgetAmount)}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-slate-500">Remaining</p>
                <p
                  className={`mt-1 font-semibold ${
                    remaining < 0 ? "text-red-300" : "text-emerald-300"
                  }`}
                >
                  {formatMoney(remaining)}
                </p>
              </div>
            </div>

            <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-white">
                  Budget Usage
                </p>
                <p className="text-sm font-semibold text-slate-300">
                  {percentage.toFixed(0)}%
                </p>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full ${
                    percentage >= 100
                      ? "bg-red-500"
                      : percentage >= 80
                        ? "bg-yellow-500"
                        : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>

              <p className="mt-2 text-sm text-slate-400">
                Used {formatMoney(usedAmount)} out of{" "}
                {formatMoney(budgetAmount)}.
              </p>
            </div>

            <div className="max-h-[45vh] overflow-y-auto rounded-2xl border border-white/10">
              {relatedTransactions.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 border-t border-white/10 px-4 py-4 first:border-t-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-white">{item.category}</p>
                    <p className="text-sm text-slate-400">
                      {formatDate(item.transaction_date)}
                    </p>
                  </div>

                  <p className="font-bold text-red-300">
                    -{formatMoney(item.amount)}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomCategoryModal({
  value,
  loading,
  onChange,
  onClose,
  onAdd,
}: {
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[110] overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm sm:flex sm:items-center sm:justify-center">
      <div className="mx-auto my-4 w-full max-w-md rounded-3xl border border-white/10 bg-slate-950 p-5 shadow-2xl shadow-black">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">
              Add Custom Category
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Create a new expense category for this transaction.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Example: Laundry, Pets, Travel"
          disabled={loading}
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-60"
        />

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
            onClick={onAdd}
            disabled={loading}
            className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Add Category
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({
  transaction,
  loading,
  onClose,
  onDelete,
}: {
  transaction: Transaction;
  loading: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm sm:flex sm:items-center sm:justify-center">
      <div className="mx-auto my-4 w-full max-w-md rounded-3xl border border-white/10 bg-slate-950 p-5 shadow-2xl shadow-black">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-300">
          <Trash2 className="h-6 w-6" />
        </div>

        <h2 className="text-xl font-bold text-white">Delete transaction?</h2>

        <p className="mt-2 text-sm text-slate-400">
          This will permanently delete the{" "}
          <span className="font-semibold text-white">
            {transaction.category}
          </span>{" "}
          {transaction.type} worth{" "}
          <span className="font-semibold text-white">
            {formatMoney(transaction.amount)}
          </span>
          .
        </p>

        {transaction.type === "expense" && (
          <p className="mt-3 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-sm text-yellow-200">
            Removing this expense will also reduce the used amount shown in
            Budgets.
          </p>
        )}

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