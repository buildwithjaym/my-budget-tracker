"use client";

import Image from "next/image";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";

function isValidGmail(email: string) {
  return /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email);
}

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (loading) return;

    setMessage("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanFullName = fullName.trim();
    const cleanPassword = password.trim();

    if (!cleanFullName) {
      const errorMessage = "Full name is required.";

      setMessage(errorMessage);

      toast.error("Missing full name", {
        description: errorMessage,
      });

      return;
    }

    if (!isValidGmail(cleanEmail)) {
      const errorMessage =
        "Please enter a valid Gmail address ending with @gmail.com.";

      setMessage(errorMessage);

      toast.error("Invalid email", {
        description: errorMessage,
      });

      return;
    }

    if (cleanPassword.length < 6) {
      const errorMessage = "Password must be at least 6 characters.";

      setMessage(errorMessage);

      toast.error("Weak password", {
        description: errorMessage,
      });

      return;
    }

    setLoading(true);

    const loadingToast = toast.loading("Creating account...", {
      description: "Setting up your personal budget account.",
    });

    const { error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: cleanPassword,
      options: {
        data: {
          full_name: cleanFullName,
        },
      },
    });

    if (error) {
      toast.dismiss(loadingToast);

      setMessage(error.message);

      toast.error("Registration failed", {
        description: error.message,
      });

      setLoading(false);
      return;
    }

    toast.dismiss(loadingToast);

    toast.success("Account created", {
      description: "You can now log in to your account.",
    });

    setLoading(false);
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020617] px-4 py-8 text-white">
      <div className="pointer-events-none absolute -left-32 top-10 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-10 h-72 w-72 rounded-full bg-teal-500/10 blur-3xl" />

      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl border border-emerald-400/20 bg-emerald-500/10 shadow-lg shadow-emerald-500/10">
            <Image
              src="/logo.png"
              alt="MyBudget logo"
              width={64}
              height={64}
              priority
              className="h-full w-full object-contain p-2"
            />
          </div>

          <h1 className="text-2xl font-bold text-emerald-300">MyBudget</h1>

          <h2 className="mt-6 text-3xl font-bold tracking-tight text-white">
            Create account
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Start tracking your income, expenses, and budget alerts.
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label
              htmlFor="fullName"
              className="text-sm font-medium text-slate-300"
            >
              Full Name
            </label>

            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setMessage("");
              }}
              disabled={loading}
              required
              autoComplete="name"
              placeholder="Juan Dela Cruz"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400/60 focus:bg-slate-950 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-70"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="text-sm font-medium text-slate-300"
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
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400/60 focus:bg-slate-950 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-70"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="text-sm font-medium text-slate-300"
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
                minLength={6}
                autoComplete="new-password"
                placeholder="Minimum 6 characters"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 pr-12 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400/60 focus:bg-slate-950 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-70"
              />

              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                disabled={loading}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-emerald-300 disabled:cursor-not-allowed"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Use at least 6 characters for your password.
            </p>
          </div>

          {message && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-emerald-300 transition hover:text-emerald-200"
          >
            Login
          </Link>
        </p>
      </div>
    </main>
  );
}