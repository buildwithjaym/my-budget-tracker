import AppShell from "@/components/app-shell";
import BudgetManager from "@/components/budgets/budget-manager";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const revalidate = 0;

export type Budget = {
  id: string;
  user_id: string;
  category: string;
  amount: number | string;
  month: string;
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

function getCurrentMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

function getCurrentMonthEnd() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);
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

  const currentMonthStart = getCurrentMonthStart();
  const currentMonthEnd = getCurrentMonthEnd();

  const { data: budgets, error: budgetsError } = await supabase
    .from("budgets")
    .select("id, user_id, category, amount, month, created_at")
    .eq("user_id", user.id)
    .eq("month", currentMonthStart)
    .order("category", { ascending: true });

  if (budgetsError) {
    throw new Error(budgetsError.message);
  }

  const { data: transactions, error: transactionsError } = await supabase
    .from("transactions")
    .select("id, user_id, type, amount, category, transaction_date")
    .eq("user_id", user.id)
    .eq("type", "expense")
    .gte("transaction_date", currentMonthStart)
    .lte("transaction_date", currentMonthEnd);

  if (transactionsError) {
    throw new Error(transactionsError.message);
  }

  return (
    <AppShell>
      <BudgetManager
        userId={user.id}
        initialBudgets={(budgets ?? []) as Budget[]}
        initialTransactions={(transactions ?? []) as BudgetTransaction[]}
        initialMonth={currentMonthStart}
      />
    </AppShell>
  );
}