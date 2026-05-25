"use client";

import { useEffect, useState } from "react";
import { apiGet, Dashboard, SectorAnalytics } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

function Card({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [analytics, setAnalytics] = useState<SectorAnalytics[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const dashboardData = await apiGet<Dashboard>("/dashboard");
        const analyticsData = await apiGet<SectorAnalytics[]>("/analytics/sectors");

        setDashboard(dashboardData);
        setAnalytics(analyticsData);
      } catch {
        setError("Nu se poate conecta la backend. Verifica daca FastAPI ruleaza pe http://127.0.0.1:8000");
      }
    }

    loadData();
  }, []);

  if (error) {
    return (
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-red-600">Eroare conectare backend</h2>
        <p className="mt-2 text-slate-600">{error}</p>
      </section>
    );
  }

  if (!dashboard) {
    return <p>Se incarca dashboard-ul...</p>;
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Dashboard economic Bucuresti</h2>
        <p className="mt-1 text-slate-500">Indicatori pentru proprietati, venituri si sectoare.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card title="Total proprietati" value={dashboard.total_properties} />
        <Card title="Valoare portofoliu" value={`${dashboard.total_value.toLocaleString()} EUR`} />
        <Card title="Pret mediu/mp" value={`${dashboard.average_price_sqm} EUR`} />
        <Card title="Rata ocupare" value={`${dashboard.average_occupancy_rate}%`} />
        <Card title="Venit lunar" value={`${dashboard.monthly_revenue.toLocaleString()} EUR`} />
        <Card title="Sector top pret" value={dashboard.top_sector_by_price} />
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-xl font-semibold">Pret mediu/mp pe sector</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics}>
              <XAxis dataKey="sector_name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="average_price_sqm" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}