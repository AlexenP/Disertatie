"use client";

import Link from "next/link";
import {usePathname, useRouter} from "next/navigation";
import {useEffect, useState} from "react";
import {
  canViewAnalytics,
  canViewDashboard,
  canViewForecasts,
  canViewMap,
  canViewProperties,
  GeoEstateUser,
  getCurrentUser,
  logoutUser,
} from "@/lib/auth";

const navItems = [
  { href: "/dashboard", label: "Dashboard", canView: canViewDashboard },
  { href: "/properties", label: "Proprietati", canView: canViewProperties },
  { href: "/map", label: "Harta", canView: canViewMap },
  { href: "/analytics", label: "Analiza", canView: canViewAnalytics },
  { href: "/forecasts", label: "Previziuni", canView: canViewForecasts },
];

function getFirstAllowedRoute(user: GeoEstateUser | null) {
  return navItems.find((item) => item.canView(user))?.href ?? "/login";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<GeoEstateUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const protectedRoutes = ["/dashboard", "/properties", "/map", "/analytics", "/forecasts"];
  const isHomePage = pathname === "/";
  const isLoginPage = pathname === "/login";
  const isProtectedRoute = protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const currentRoute = navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const visibleNavItems = user ? navItems.filter((item) => item.canView(user)) : [];

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
    setAuthChecked(true);

    if (isHomePage) {
      router.replace(currentUser ? getFirstAllowedRoute(currentUser) : "/login");
      return;
    }

    if (!currentUser && isProtectedRoute) {
      router.replace("/login");
      return;
    }

    if (currentUser && currentRoute && !currentRoute.canView(currentUser)) {
      router.replace(getFirstAllowedRoute(currentUser));
      return;
    }

    if (currentUser && isLoginPage) {
      router.replace(getFirstAllowedRoute(currentUser));
    }
  }, [currentRoute, isHomePage, isLoginPage, isProtectedRoute, router]);

  function handleLogout() {
    logoutUser();
    setUser(null);
    router.replace("/login");
  }

  if (isHomePage || (!authChecked && !isLoginPage)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">
        Se verifica autentificarea...
      </div>
    );
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (isProtectedRoute && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">
        Se redirectioneaza catre login...
      </div>
    );
  }

  if (currentRoute && user && !currentRoute.canView(user)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">
        Se redirectioneaza catre o pagina permisa rolului tau...
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <aside className="fixed left-0 top-0 h-full w-64 border-r bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">GeoEstate</h1>
        <p className="mt-1 text-sm text-slate-500">Bucuresti GIS Analytics</p>
        <nav className="mt-8 flex flex-col gap-2">
          {visibleNavItems.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-xl px-4 py-3 text-sm font-medium hover:bg-slate-100">
              {item.label}
            </Link>
          ))}
        </nav>

        {user && (
          <div className="absolute bottom-6 left-6 right-6 space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
              <p className="truncate text-sm font-semibold text-slate-900">{user.full_name}</p>
              <p className="mt-1 truncate text-xs text-slate-500">{user.role_name || user.role}</p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Logout
            </button>
          </div>
        )}
      </aside>
      <main className="ml-64 p-8">{children}</main>
    </div>
  );
}
