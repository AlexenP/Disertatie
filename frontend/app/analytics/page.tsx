import { apiGet, SectorAnalytics } from "@/lib/api";

export default async function AnalyticsPage() {
  const rows = await apiGet<SectorAnalytics[]>("/analytics/sectors");

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Analiza pe sectoare</h2>
        <p className="mt-1 text-slate-500">Comparatie economica pentru cele 6 sectoare din Bucuresti.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {rows.map((row) => (
          <div key={row.sector_id} className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="text-xl font-semibold">{row.sector_name}</h3>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <p>Proprietati: <strong>{row.properties_count}</strong></p>
              <p>Pret mediu/mp: <strong>{row.average_price_sqm} EUR</strong></p>
              <p>Valoare totala: <strong>{row.total_value.toLocaleString()} EUR</strong></p>
              <p>Venit lunar: <strong>{row.monthly_revenue.toLocaleString()} EUR</strong></p>
              <p>Rata ocupare: <strong>{row.occupancy_rate}%</strong></p>
              <p>Scor interes: <strong>{row.interest_score}</strong></p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
