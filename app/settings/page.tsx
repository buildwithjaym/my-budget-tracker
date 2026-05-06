import AppShell from "@/components/app-shell";

export default function SettingsPage() {
  return (
    <AppShell>
      <h1 className="text-3xl font-bold text-white">Settings</h1>
      <p className="mt-2 text-slate-400">
        Manage your profile and account preferences here.
      </p>
    </AppShell>
  );
}