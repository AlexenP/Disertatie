import Link from "next/link";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/properties", label: "Proprietati" },
  { href: "/map", label: "Harta" },
  { href: "/analytics", label: "Analiza" },
  { href: "/forecasts", label: "Previziuni" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <aside className="fixed left-0 top-0 h-full w-64 border-r bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">GeoEstate</h1>
        <p className="mt-1 text-sm text-slate-500">Bucuresti GIS Analytics</p>
        <nav className="mt-8 flex flex-col gap-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-xl px-4 py-3 text-sm font-medium hover:bg-slate-100">
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="ml-64 p-8">{children}</main>
    </div>
  );
}
