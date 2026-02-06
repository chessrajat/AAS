"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuthStore } from "../stores/authStore";

const PUBLIC_ROUTES = ["/login"];

export default function AuthGate({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = useAuthStore((state) => state.accessToken);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }
    if (!accessToken && !PUBLIC_ROUTES.includes(pathname)) {
      router.replace("/login");
    }
  }, [accessToken, hasHydrated, pathname, router]);

  if (!hasHydrated) {
    return null;
  }

  if (!accessToken && !PUBLIC_ROUTES.includes(pathname)) {
    return null;
  }

  return children;
}
