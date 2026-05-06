"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";

function isValidGmail(email: string) {
  return /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email);
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (loading) return;

    setMessage("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!isValidGmail(cleanEmail)) {
      const errorMessage = "Please enter a valid Gmail address ending with @gmail.com.";
      setMessage(errorMessage);
      toast.error("Invalid email", {
        description: errorMessage,
      });
      return;
    }

    if (!cleanPassword) {
      const errorMessage = "Password is required.";
      setMessage(errorMessage);
      toast.error("Missing password", {
        description: errorMessage,
      });
      return;
    }

    setLoading(true);

    const loadingToast = toast.loading("Logging in...", {
      description: "Checking your account credentials.",
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword,
    });

    if (error || !data.session) {
      toast.dismiss(loadingToast);

      setMessage("Invalid email or password.");
      toast.error("Login failed", {
        description: "Please check your email and password.",
      });

      setLoading(false);
      return;
    }

    toast.dismiss(loadingToast);

    toast.success("Login successful", {
      description: "Redirecting to your dashboard...",
    });

    window.location.href = "/dashboard";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-100 px-4 py-8">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl shadow-emerald-900/10 ring-1 ring-emerald-100 sm:p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700 shadow-inner">
            <Wallet className="h-8 w-8" />
          </div>

          <h1 className="text-2xl font-bold text-emerald-800">MyBudget</h1>

          <h2 className="mt-6 text-3xl font-bold tracking-tight text-slate-950">
            Welcome back
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Login to continue managing your personal expenses and budgets.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="text-sm font-medium text-slate-700"
            >
              Email Address
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setMessage("");
              }}
              disabled={loading}
              required
              autoComplete="email"
              placeholder="yourname@gmail.com"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-70"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="text-sm font-medium text-slate-700"
            >
              Password
            </label>

            <div className="relative mt-2">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setMessage("");
                }}
                disabled={loading}
                required
                autoComplete="current-password"
                placeholder="Enter your password"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-70"
              />

              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                disabled={loading}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-emerald-700 disabled:cursor-not-allowed"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {message && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-600">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Create account
          </Link>
        </p>
      </div>
    </main>
  );
}