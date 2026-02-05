"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuthStore } from "../stores/authStore";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoading, error, clearError, accessToken } = useAuthStore();

  useEffect(() => {
    if (!error) {
      return;
    }
    toast.error("Login failed", {
      description: error,
    });
    clearError();
  }, [error, clearError]);

  useEffect(() => {
    if (accessToken) {
      router.replace("/");
    }
  }, [accessToken, router]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const ok = await login(username, password);
    if (ok) {
      toast.success("Signed in", {
        description: "Welcome back to AAS.",
      });
    }
  };

  if (accessToken) {
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900">
      <div className="pointer-events-none absolute -left-32 top-16 h-72 w-72 animate-float-soft rounded-full bg-amber-200/70 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-cyan-200/70 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_55%)]" />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-16">
        <div className="grid w-full items-center gap-12 md:grid-cols-2">
          <section className="space-y-6">
            <p className="animate-rise-in text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
              Advance Annotation System
            </p>
            <h1 className="animate-rise-in text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
              Precision labeling for every frame, every time.
            </h1>
            <p
              className="animate-rise-in text-lg leading-7 text-slate-600"
              style={{ animationDelay: "120ms" }}
            >
              Log in to create clean, consistent bounding boxes and keep your
              datasets ready for the next model run.
            </p>
            <div
              className="animate-rise-in space-y-3 text-sm text-slate-600"
              style={{ animationDelay: "200ms" }}
            >
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <span>Manual annotation with fast edits and snap guides.</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-cyan-400" />
                <span>Export-ready labels organized for training.</span>
              </div>
            </div>
          </section>

          <section className="animate-rise-in" style={{ animationDelay: "260ms" }}>
            <div className="rounded-3xl border border-slate-200/60 bg-white/80 p-8 shadow-xl shadow-slate-900/5 backdrop-blur">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-slate-900">
                  Welcome back
                </h2>
                <p className="text-sm text-slate-500">
                  Use your credentials to access the workspace.
                </p>
              </div>

              <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                <label className="block space-y-2 text-sm font-medium text-slate-700">
                  Username
                  <input
                    type="text"
                    name="username"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  />
                </label>
                <label className="block space-y-2 text-sm font-medium text-slate-700">
                  Password
                  <input
                    type="password"
                    name="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  />
                </label>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="mt-2 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isLoading ? "Signing in..." : "Sign in"}
                </button>
              </form>

              <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
                <span>Need access? Contact an admin.</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">
                  Secure JWT
                </span>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
