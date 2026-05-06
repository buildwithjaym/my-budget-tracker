import AppShell from "@/components/app-shell";

export default function BudgetsPage() {
  return (
    <AppShell>
      <h1 className="text-3xl font-bold text-white">Budgets</h1>
      <p className="mt-2 text-slate-400">
        Set monthly overall or category-based budgets here.
      </p>
    </AppShell>
  );
}