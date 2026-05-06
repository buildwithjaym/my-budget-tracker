import AppShell from "@/components/app-shell";
import BudgetManager from "@/components/budgets/budget-manager";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const revalidate = 0;

export type Budget = {
  id: string;
  user_id: string;
  category: string | null;
  amount: number | string;
  month: number;
  year: number;
  created_at: string;
};

export type BudgetTransaction = {
  id: string;
  user_id: string;
  type: "income" | "expense";
  amount: number | string;
  category: string;
  transaction_date: string;
};

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

  const monthStart = formatLocalDate(new Date(year, month - 1, 1));
  const monthEnd = formatLocalDate(new Date(year, month, 0));

  return {
    month,
    year,
    monthStart,
    monthEnd,
  };
}

export default async function BudgetsPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { month, year, monthStart, monthEnd } = getCurrentMonthDetails();

  const { data: budgets, error: budgetsError } = await supabase
    .from("budgets")
    .select("id, user_id, category, amount, month, year, created_at")
    .eq("user_id", user.id)
    .eq("month", month)
    .eq("year", year)
    .order("category", { ascending: true });

  if (budgetsError) {
    throw new Error(budgetsError.message);
  }

  const { data: transactions, error: transactionsError } = await supabase
    .from("transactions")
    .select("id, user_id, type, amount, category, transaction_date")
    .eq("user_id", user.id)
    .eq("type", "expense")
    .gte("transaction_date", monthStart)
    .lte("transaction_date", monthEnd);

  if (transactionsError) {
    throw new Error(transactionsError.message);
  }

  const { data: categorySource, error: categorySourceError } = await supabase
    .from("transactions")
    .select("category")
    .eq("user_id", user.id)
    .order("category", { ascending: true });

  if (categorySourceError) {
    throw new Error(categorySourceError.message);
  }

  const categoryOptions = Array.from(
    new Set(
      [
        ...(categorySource ?? []).map((item) => item.category),
        ...(budgets ?? []).map((item) => item.category),
      ]
        .filter(Boolean)
        .map((category) => String(category))
    )
  ).sort((a, b) => a.localeCompare(b));

  return (
    <AppShell>
      <BudgetManager
        userId={user.id}
        initialBudgets={(budgets ?? []) as Budget[]}
        initialTransactions={(transactions ?? []) as BudgetTransaction[]}
        initialMonth={month}
        initialYear={year}
        initialCategoryOptions={categoryOptions}
      />
    </AppShell>
  );
}