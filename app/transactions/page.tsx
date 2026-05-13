import AppShell from "@/components/app-shell";
import TransactionManager from "@/components/transactions/transaction-manager";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const revalidate = 0;

export type Transaction = {
  id: string;
  user_id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  note: string | null;
  transaction_date: string;
  created_at: string;
};

export type TransactionBudget = {
  id: string;
  user_id: string;
  category: string | null;
  amount: number | string;
  month: number;
  year: number;
  created_at: string | null;
};

export default async function TransactionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const [transactionsResult, budgetsResult] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id, user_id, type, amount, category, note, transaction_date, created_at"
      )
      .eq("user_id", user.id)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false }),

    supabase
      .from("budgets")
      .select("id, user_id, category, amount, month, year, created_at")
      .eq("user_id", user.id)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .order("category", { ascending: true }),
  ]);

  if (transactionsResult.error) {
    throw new Error(transactionsResult.error.message);
  }

  if (budgetsResult.error) {
    throw new Error(budgetsResult.error.message);
  }

  return (
    <AppShell>
      <TransactionManager
        userId={user.id}
        initialTransactions={(transactionsResult.data ?? []) as Transaction[]}
        initialBudgets={(budgetsResult.data ?? []) as TransactionBudget[]}
      />
    </AppShell>
  );
}