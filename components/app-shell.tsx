"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Wallet,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Budgets",
    href: "/budgets",
    icon: BarChart3,
  },
  {
    label: "Expenses",
    href: "/transactions",
    icon: Wallet,
  },
  {
    label: "Reports",
    href: "/reports",
    icon: FileText,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-[#020617]/90 px-4 backdrop-blur-xl lg:hidden">
        <Link
          href="/dashboard"
          onClick={() => setOpen(false)}
          className="flex items-center gap-3"
        >
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-emerald-500/15">
            <Image
              src="/logo.png"
              alt="MyBudget logo"
              width={40}
              height={40}
              priority
              className="h-full w-full object-contain p-1.5"
            />
          </div>

          <div>
            <h1 className="text-sm font-bold leading-none text-white">
              MyBudget
            </h1>
            <p className="mt-1 text-xs text-slate-400">Expense Tracker</p>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-72 border-r border-white/10 bg-[#020617] p-5 lg:flex lg:flex-col">
        <SidebarContent
          pathname={pathname}
          onClose={() => setOpen(false)}
          onLogout={handleLogout}
          showClose={false}
        />
      </aside>

      {open && (
        <button
          type="button"
          aria-label="Close menu overlay"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed right-0 top-0 z-50 h-screen w-[82%] max-w-sm border-l border-white/10 bg-[#020617] p-5 shadow-2xl shadow-black/50 transition-transform duration-300 lg:hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <SidebarContent
          pathname={pathname}
          onClose={() => setOpen(false)}
          onLogout={handleLogout}
          showClose
        />
      </aside>

      <section className="min-h-screen px-4 py-6 sm:px-6 lg:ml-72 lg:px-8 lg:py-8">
        {children}
      </section>
    </main>
  );
}

function SidebarContent({
  pathname,
  onClose,
  onLogout,
  showClose,
}: {
  pathname: string;
  onClose: () => void;
  onLogout: () => void;
  showClose: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-10 flex items-center justify-between">
        <Link
          href="/dashboard"
          onClick={onClose}
          className="flex items-center gap-3"
        >
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-emerald-500/15">
            <Image
              src="/logo.png"
              alt="MyBudget logo"
              width={48}
              height={48}
              priority
              className="h-full w-full object-contain p-1.5"
            />
          </div>

          <div>
            <h1 className="text-base font-bold leading-none text-white">
              MyBudget
            </h1>
            <p className="mt-1 text-xs text-slate-400">Expense Tracker</p>
          </div>
        </Link>

        {showClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                active
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/20"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </div>
    </div>
  );
}