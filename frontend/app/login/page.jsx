"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
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
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-16">
        <div className="grid w-full items-center gap-12 md:grid-cols-2">
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <Image src="/app-icon.svg" alt="" width={40} height={40} className="border border-border" />
              <p className="animate-rise-in text-sm font-bold uppercase text-foreground">
                AAS
              </p>
            </div>
            <p className="animate-rise-in aas-kicker">
              Advance Annotation System
            </p>
            <h1 className="animate-rise-in text-[38px] font-bold leading-[1.5] text-foreground max-md:text-[28px]">
              Precision labeling for every frame, every time.
            </h1>
            <p
              className="animate-rise-in text-base leading-6 text-muted-foreground"
              style={{ animationDelay: "120ms" }}
            >
              Log in to create clean, consistent bounding boxes and keep your
              datasets ready for the next model run.
            </p>
            <div
              className="animate-rise-in space-y-3 text-sm text-muted-foreground"
              style={{ animationDelay: "200ms" }}
            >
              <div className="flex items-center gap-3">
                <span className="font-bold text-foreground">[+]</span>
                <span>Manual annotation with fast edits and snap guides.</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-foreground">[+]</span>
                <span>Export-ready labels organized for training.</span>
              </div>
            </div>
          </section>

          <section className="animate-rise-in" style={{ animationDelay: "260ms" }}>
            <div className="border border-border bg-card p-8">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-foreground">
                  Welcome back
                </h2>
                <p className="text-sm text-muted-foreground">
                  Use your credentials to access the workspace.
                </p>
              </div>

              <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                <label className="block space-y-2 text-sm font-medium text-foreground">
                  Username
                  <input
                    type="text"
                    name="username"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="w-full rounded-sm border border-input bg-muted px-4 py-3 text-base text-foreground outline-none transition focus:border-foreground focus:bg-background"
                  />
                </label>
                <label className="block space-y-2 text-sm font-medium text-foreground">
                  Password
                  <input
                    type="password"
                    name="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-sm border border-input bg-muted px-4 py-3 text-base text-foreground outline-none transition focus:border-foreground focus:bg-background"
                  />
                </label>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="mt-2 w-full rounded-sm bg-primary px-4 py-3 text-sm font-medium uppercase text-primary-foreground transition hover:bg-[#0f0000] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isLoading ? "Signing in..." : "Sign in"}
                </button>
              </form>

              <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
                <span>Need access? Contact an admin.</span>
                <span className="rounded-sm border border-border bg-secondary px-3 py-1 font-semibold text-foreground">
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
