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

export default async function TransactionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select(
      "id, user_id, type, amount, category, note, transaction_date, created_at"
    )
    .eq("user_id", user.id)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <AppShell>
      <TransactionManager
        userId={user.id}
        initialTransactions={(transactions ?? []) as Transaction[]}
      />
    </AppShell>
  );
}