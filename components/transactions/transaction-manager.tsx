"use client";

import type { Transaction } from "@/app/transactions/page";
import { supabase } from "@/lib/supabase/client";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Edit,
  Plus,
  Search,
  Trash2,
  X,
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
  type: "income" | "expense";
  amount: string;
  category: string;
  note: string;
  transaction_date: string;
};

const emptyForm: FormState = {
  type: "expense",
  amount: "",
  category: "Food",
  note: "",
  transaction_date: new Date().toISOString().slice(0, 10),
};

function formatMoney(value: number | string) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default function TransactionManager({
  userId,
  initialTransactions,
}: {
  userId: string;
  initialTransactions: Transaction[];
}) {
  const router = useRouter();

  const [transactions, setTransactions] =
    useState<Transaction[]>(initialTransactions);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">(
    "all"
  );
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState<FormState>(emptyForm);

  const filteredTransactions = useMemo(() => {
    const searchValue = search.toLowerCase().trim();

    return transactions.filter((transaction) => {
      const matchesSearch =
        transaction.category.toLowerCase().includes(searchValue) ||
        transaction.note?.toLowerCase().includes(searchValue) ||
        String(transaction.amount).includes(searchValue);

      const matchesType =
        typeFilter === "all" || transaction.type === typeFilter;

      const matchesCategory =
        categoryFilter === "all" || transaction.category === categoryFilter;

      return matchesSearch && matchesType && matchesCategory;
    });
  }, [transactions, search, typeFilter, categoryFilter]);

  const totalIncome = transactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const totalExpenses = transactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const netBalance = totalIncome - totalExpenses;

  function openAddModal() {
    setEditingTransaction(null);
    setForm(emptyForm);
    setModalOpen(true);
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
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const amount = Number(form.amount);

    if (!amount || amount <= 0) {
      toast.error("Invalid amount", {
        description: "Amount must be greater than zero.",
      });
      return;
    }

    if (!form.category.trim()) {
      toast.error("Missing category", {
        description: "Please select a category.",
      });
      return;
    }

    if (!form.transaction_date) {
      toast.error("Missing date", {
        description: "Please select a transaction date.",
      });
      return;
    }

    setLoading(true);

    if (editingTransaction) {
      const { data, error } = await supabase
        .from("transactions")
        .update({
          type: form.type,
          amount,
          category: form.category,
          note: form.note.trim() || null,
          transaction_date: form.transaction_date,
        })
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
        current.map((item) =>
          item.id === editingTransaction.id ? (data as Transaction) : item
        )
      );

      toast.success("Transaction updated", {
        description: `${form.category} transaction was updated successfully.`,
      });
    } else {
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          type: form.type,
          amount,
          category: form.category,
          note: form.note.trim() || null,
          transaction_date: form.transaction_date,
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

      setTransactions((current) => [data as Transaction, ...current]);

      toast.success("Transaction added", {
        description: `${form.category} transaction was added successfully.`,
      });
    }

    setLoading(false);
    setModalOpen(false);
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
      description: `${deleteTarget.category} transaction was removed successfully.`,
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
            Transactions
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Add, edit, delete, categorize, and organize your financial records.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600"
        >
          <Plus className="h-4 w-4" />
          Add Transaction
        </button>
      </div>

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="Total Income"
          value={formatMoney(totalIncome)}
          helper="All income records"
          icon={<ArrowDownLeft className="h-5 w-5" />}
        />

        <SummaryCard
          title="Total Expenses"
          value={formatMoney(totalExpenses)}
          helper="All expense records"
          icon={<ArrowUpRight className="h-5 w-5" />}
        />

        <SummaryCard
          title="Net Balance"
          value={formatMoney(netBalance)}
          helper="Income minus expenses"
          icon={<CalendarDays className="h-5 w-5" />}
        />
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
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
                placeholder="Search category, note, or amount..."
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
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10">
          <div className="hidden grid-cols-7 bg-white/5 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400 md:grid">
            <span>Date</span>
            <span>Category</span>
            <span>Type</span>
            <span className="col-span-2">Note</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Actions</span>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-slate-400">
                <CalendarDays className="h-6 w-6" />
              </div>

              <h3 className="mt-4 font-semibold text-white">
                No transactions found
              </h3>

              <p className="mt-1 text-sm text-slate-400">
                Add your first income or expense record.
              </p>
            </div>
          ) : (
            filteredTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="grid gap-3 border-t border-white/10 px-4 py-4 text-sm md:grid-cols-7 md:items-center"
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
                    Category
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

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                    Actions
                  </p>

                  <div className="mt-2 flex gap-2 md:mt-0 md:justify-end">
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
            ))
          )}
        </div>
      </section>

      {modalOpen && (
        <TransactionModal
          title={editingTransaction ? "Edit Transaction" : "Add Transaction"}
          form={form}
          setForm={setForm}
          loading={loading}
          onClose={() => {
            setModalOpen(false);
            setEditingTransaction(null);
            setForm(emptyForm);
          }}
          onSubmit={handleSubmit}
        />
      )}

      {deleteTarget && (
        <DeleteModal
          transaction={deleteTarget}
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

function TransactionModal({
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
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-slate-950 p-5 shadow-2xl shadow-black">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <p className="mt-1 text-sm text-slate-400">
              Fill in the transaction details below.
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
          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-white/5 p-1">
            <button
              type="button"
              onClick={() =>
                setForm((current) => ({ ...current, type: "income" }))
              }
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                form.type === "income"
                  ? "bg-emerald-500 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Income
            </button>

            <button
              type="button"
              onClick={() =>
                setForm((current) => ({ ...current, type: "expense" }))
              }
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                form.type === "expense"
                  ? "bg-red-500 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Expense
            </button>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-300">Amount</label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={form.amount}
              onChange={(e) =>
                setForm((current) => ({ ...current, amount: e.target.value }))
              }
              placeholder="0.00"
              required
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10"
            />
          </div>

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
            <label className="text-sm font-medium text-slate-300">Date</label>
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
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-300">Note</label>
            <textarea
              value={form.note}
              onChange={(e) =>
                setForm((current) => ({ ...current, note: e.target.value }))
              }
              placeholder="Optional note"
              rows={3}
              className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10"
            />
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
              {loading ? "Saving..." : "Save Transaction"}
            </button>
          </div>
        </form>
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950 p-5 shadow-2xl shadow-black">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-300">
          <Trash2 className="h-6 w-6" />
        </div>

        <h2 className="text-xl font-bold text-white">Delete transaction?</h2>

        <p className="mt-2 text-sm text-slate-400">
          This will permanently delete the{" "}
          <span className="font-semibold text-white">
            {transaction.category}
          </span>{" "}
          transaction worth{" "}
          <span className="font-semibold text-white">
            {formatMoney(transaction.amount)}
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