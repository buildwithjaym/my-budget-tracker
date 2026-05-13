import AppShell from "@/components/app-shell";
import ReportManager from "@/components/reports/report-manager";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const revalidate = 0;

export type ReportTransaction = {
  id: string;
  user_id: string;
  type: "income" | "expense";
  amount: number | string;
  category: string;
  note: string | null;
  transaction_date: string;
  created_at: string;
};

export type ReportBudget = {
  id: string;
  user_id: string;
  category: string | null;
  amount: number | string;
  month: number;
  year: number;
  created_at: string;
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

export default async function ReportsPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { month, year, monthStart, monthEnd } = getCurrentMonthDetails();

  const [transactionsResult, budgetsResult, profileResult] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id, user_id, type, amount, category, note, transaction_date, created_at"
      )
      .eq("user_id", user.id)
      .gte("transaction_date", monthStart)
      .lte("transaction_date", monthEnd)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false }),

    supabase
      .from("budgets")
      .select("id, user_id, category, amount, month, year, created_at")
      .eq("user_id", user.id)
      .eq("month", month)
      .eq("year", year)
      .order("category", { ascending: true }),

    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (transactionsResult.error) {
    throw new Error(transactionsResult.error.message);
  }

  if (budgetsResult.error) {
    throw new Error(budgetsResult.error.message);
  }

  const userDisplayName =
    profileResult.data?.full_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "user";

  return (
    <AppShell>
      <ReportManager
        userId={user.id}
        userDisplayName={userDisplayName}
        initialMonth={month}
        initialYear={year}
        initialTransactions={
          (transactionsResult.data ?? []) as ReportTransaction[]
        }
        initialBudgets={(budgetsResult.data ?? []) as ReportBudget[]}
      />
    </AppShell>
  );
}