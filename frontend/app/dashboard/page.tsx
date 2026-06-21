"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, Dashboard, PropertyItem, SectorAnalytics } from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const statusLabels: Record<string, string> = {
  available: "Disponibile",
  rented: "Inchiriate",
  occupied: "Ocupate",
  sold: "Vandute",
  inactive: "Inactive",
};

const marketLabels: Record<PropertyItem["market_label"], string> = {
  sub_piata: "Sub piata",
  la_piata: "La piata",
  peste_piata: "Peste piata",
};

const marketColors: Record<PropertyItem["market_label"], string> = {
  sub_piata: "#16a34a",
  la_piata: "#eab308",
  peste_piata: "#dc2626",
};

const statusColors: Record<string, string> = {
  available: "#2563eb",
  rented: "#16a34a",
  occupied: "#4f46e5",
  sold: "#64748b",
  inactive: "#dc2626",
};

function Card({
  title,
  value,
  helper,
}: {
  title: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {helper && <p className="mt-2 text-xs text-slate-500">{helper}</p>}
    </div>
  );
}

function ChartPanel({
  title,
  children,
  helper,
}: {
  title: string;
  children: React.ReactNode;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
      {helper && <p className="mt-1 text-sm text-slate-500">{helper}</p>}
      <div className="mt-5 h-80">{children}</div>
    </div>
  );
}

function calculateGrossYield(property: PropertyItem) {
  if (!property.price || !property.monthly_rent) {
    return 0;
  }

  return (property.monthly_rent * 12 / property.price) * 100;
}

type AlertItem = {
  label: string;
  value: number;
  description: string;
  tone: string;
  properties: PropertyItem[];
};

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [analytics, setAnalytics] = useState<SectorAnalytics[]>([]);
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const dashboardData = await apiGet<Dashboard>("/dashboard");
        const analyticsData = await apiGet<SectorAnalytics[]>("/analytics/sectors");
        const propertiesData = await apiGet<PropertyItem[]>("/properties");

        setDashboard(dashboardData);
        setAnalytics(analyticsData);
        setProperties(propertiesData);
      } catch {
        setError("Nu se poate conecta la backend. Verifica daca FastAPI ruleaza pe http://127.0.0.1:8000");
      }
    }

    loadData();
  }, []);

  const statusDistribution = useMemo(() => {
    const counts = new Map<string, number>();

    properties.forEach((property) => {
      counts.set(property.status, (counts.get(property.status) ?? 0) + 1);
    });

    return Array.from(counts.entries()).map(([status, count]) => ({
      status,
      name: statusLabels[status] ?? status,
      value: count,
      color: statusColors[status] ?? "#64748b",
    }));
  }, [properties]);

  const marketDistribution = useMemo(() => {
    const labels: PropertyItem["market_label"][] = ["sub_piata", "la_piata", "peste_piata"];

    return labels.map((label) => ({
      label,
      name: marketLabels[label],
      value: properties.filter((property) => property.market_label === label).length,
      color: marketColors[label],
    }));
  }, [properties]);

  const sectorValueData = useMemo(() => {
    return analytics.map((sector) => ({
      sector_name: sector.sector_name,
      total_value: sector.total_value,
      properties_count: sector.properties_count,
      monthly_revenue: sector.monthly_revenue,
      average_price_sqm: sector.average_price_sqm,
    }));
  }, [analytics]);

  const gisScoresBySector = useMemo(() => {
    return analytics.map((sector) => {
      const sectorProperties = properties.filter((property) => property.sector_id === sector.sector_id);
      const average = (field: "location_score" | "accessibility_score" | "facilities_score" | "investment_score") => {
        const values = sectorProperties
          .map((property) => property[field])
          .filter((value): value is number => value !== null && value !== undefined);

        if (!values.length) {
          return 0;
        }

        return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
      };

      return {
        sector_name: sector.sector_name,
        locatie: average("location_score"),
        accesibilitate: average("accessibility_score"),
        facilitati: average("facilities_score"),
        investitional: average("investment_score"),
      };
    });
  }, [analytics, properties]);

  const topInvestmentProperties = useMemo(() => {
    return [...properties]
      .filter((property) => property.investment_score !== null && property.investment_score !== undefined)
      .sort((a, b) => (b.investment_score ?? 0) - (a.investment_score ?? 0))
      .slice(0, 5);
  }, [properties]);

  const alerts = useMemo<AlertItem[]>(() => {
    const missingScores = properties.filter((property) => property.location_score === null || property.location_score === undefined);
    const overMarket = properties.filter((property) => property.market_label === "peste_piata");
    const inactive = properties.filter((property) => property.status === "inactive");
    const lowYield = properties.filter((property) => calculateGrossYield(property) > 0 && calculateGrossYield(property) < 4);

    return [
      {
        label: "Proprietati fara scor GIS",
        value: missingScores.length,
        description: "Proprietati care nu au inca scoruri de locatie calculate.",
        tone: missingScores.length ? "text-amber-700 bg-amber-50 ring-amber-200" : "text-emerald-700 bg-emerald-50 ring-emerald-200",
        properties: missingScores,
      },
      {
        label: "Proprietati peste piata",
        value: overMarket.length,
        description: "Proprietati listate cu peste 10% fata de media sectorului.",
        tone: overMarket.length ? "text-red-700 bg-red-50 ring-red-200" : "text-emerald-700 bg-emerald-50 ring-emerald-200",
        properties: overMarket,
      },
      {
        label: "Proprietati inactive",
        value: inactive.length,
        description: "Proprietati marcate ca inactive in portofoliu.",
        tone: inactive.length ? "text-slate-700 bg-slate-100 ring-slate-200" : "text-emerald-700 bg-emerald-50 ring-emerald-200",
        properties: inactive,
      },
      {
        label: "Randament brut sub 4%",
        value: lowYield.length,
        description: "Proprietati cu randament brut anual calculat sub pragul de 4%.",
        tone: lowYield.length ? "text-orange-700 bg-orange-50 ring-orange-200" : "text-emerald-700 bg-emerald-50 ring-emerald-200",
        properties: lowYield,
      },
    ];
  }, [properties]);

  const averageGrossYield = useMemo(() => {
    const yields = properties
      .map(calculateGrossYield)
      .filter((value) => value > 0);

    if (!yields.length) {
      return 0;
    }

    return yields.reduce((sum, value) => sum + value, 0) / yields.length;
  }, [properties]);

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
      <div className="rounded-3xl bg-slate-900 p-8 text-white shadow-sm">
        <h2 className="text-3xl font-bold">Dashboard administrare portofoliu</h2>
        <p className="mt-2 max-w-3xl text-slate-300">
          Indicatori economici si GIS pentru portofoliul administratorului curent, fara agregare peste alti administratori.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Total proprietati" value={dashboard.total_properties} helper="Imobile din portofoliul curent" />
        <Card title="Valoare portofoliu" value={`${dashboard.total_value.toLocaleString()} EUR`} helper="Suma preturilor de listare" />
        <Card title="Pret mediu/mp" value={`${dashboard.average_price_sqm} EUR`} helper="Media proprietatilor analizate" />
        <Card title="Randament mediu" value={`${averageGrossYield.toFixed(2)}%`} helper="Chirie anuala / pret" />
        <Card title="Rata ocupare" value={`${dashboard.average_occupancy_rate}%`} />
        <Card title="Venit lunar" value={`${dashboard.monthly_revenue.toLocaleString()} EUR`} />
        <Card title="Sector top pret" value={dashboard.top_sector_by_price} />
        <Card title="Sector top interes" value={dashboard.top_sector_by_interest} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartPanel title="Pret mediu/mp pe sector" helper="Compara nivelul mediu al preturilor intre sectoare.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="sector_name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="average_price_sqm" name="Pret mediu/mp" fill="#0f172a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Valoare portofoliu pe sector" helper="Arata unde este concentrat capitalul imobiliar.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sectorValueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="sector_name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total_value" name="Valoare portofoliu EUR" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartPanel title="Clasificare fata de piata" helper="Distribuie proprietatile in functie de pretul fata de media sectorului.">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={marketDistribution} dataKey="value" nameKey="name" outerRadius={105} label>
                {marketDistribution.map((entry) => (
                  <Cell key={entry.label} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Status proprietati" helper="Monitorizeaza disponibilitatea si utilizarea portofoliului.">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={statusDistribution} dataKey="value" nameKey="name" innerRadius={55} outerRadius={105} label>
                {statusDistribution.map((entry) => (
                  <Cell key={entry.status} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartPanel title="Scoruri GIS medii pe sector" helper="Compara atractivitatea spatiala si investitionala a zonelor.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={gisScoresBySector}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="sector_name" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Bar dataKey="locatie" name="Locatie" fill="#15803d" radius={[4, 4, 0, 0]} />
              <Bar dataKey="accesibilitate" name="Accesibilitate" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="facilitati" name="Facilitati" fill="#eab308" radius={[4, 4, 0, 0]} />
              <Bar dataKey="investitional" name="Investitional" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <h3 className="text-xl font-semibold text-slate-900">Top proprietati investitionale</h3>
          <p className="mt-1 text-sm text-slate-500">Primele proprietati dupa scorul investitional calculat GIS + economic.</p>

          <div className="mt-5 space-y-3">
            {topInvestmentProperties.length ? (
              topInvestmentProperties.map((property, index) => (
                <div key={property.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {index + 1}. {property.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Sector {property.sector_id} - {property.price.toLocaleString()} EUR - {calculateGrossYield(property).toFixed(2)}% yield
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900">{property.investment_score?.toFixed(2)}</p>
                    <p className="text-xs text-slate-500">/ 100</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                Nu exista inca proprietati cu scor investitional calculat.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <h3 className="text-xl font-semibold text-slate-900">Alerte administrative</h3>
        <p className="mt-1 text-sm text-slate-500">Semnale rapide pentru intretinerea portofoliului.</p>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {alerts.map((alert) => (
            <button
              key={alert.label}
              type="button"
              onClick={() => setSelectedAlert(alert)}
              className={`rounded-2xl p-4 text-left ring-1 transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-900 ${alert.tone}`}
            >
              <p className="text-sm font-medium">{alert.label}</p>
              <p className="mt-2 text-3xl font-bold">{alert.value}</p>
              <p className="mt-3 text-xs font-medium opacity-75">Click pentru detalii</p>
            </button>
          ))}
        </div>
      </div>

      {selectedAlert && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[86vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">{selectedAlert.label}</h3>
                <p className="mt-1 text-sm text-slate-500">{selectedAlert.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAlert(null)}
                className="rounded-full border border-slate-200 px-3 py-1 text-lg font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Inchide detaliile alertei"
              >
                x
              </button>
            </div>

            <div className="max-h-[62vh] overflow-y-auto p-6">
              {selectedAlert.properties.length ? (
                <div className="space-y-3">
                  {selectedAlert.properties.map((property) => (
                    <div key={property.id} className="rounded-2xl border border-slate-100 p-4 transition hover:border-slate-300 hover:bg-slate-50">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-base font-semibold text-slate-900">{property.title}</p>
                          <p className="mt-1 text-sm text-slate-500">{property.address}</p>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                            <span className="rounded-full bg-slate-100 px-3 py-1">Cod {property.code}</span>
                            <span className="rounded-full bg-slate-100 px-3 py-1">Sector {property.sector_id}</span>
                            <span className="rounded-full bg-slate-100 px-3 py-1">{property.property_type_name}</span>
                            <span className="rounded-full bg-slate-100 px-3 py-1">{statusLabels[property.status] ?? property.status}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:min-w-[520px]">
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs text-slate-500">Pret</p>
                            <p className="mt-1 font-semibold text-slate-900">{property.price.toLocaleString()} EUR</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs text-slate-500">Chirie</p>
                            <p className="mt-1 font-semibold text-slate-900">{property.monthly_rent.toLocaleString()} EUR</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs text-slate-500">Randament</p>
                            <p className="mt-1 font-semibold text-slate-900">{calculateGrossYield(property).toFixed(2)}%</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs text-slate-500">Scor GIS</p>
                            <p className="mt-1 font-semibold text-slate-900">
                              {property.location_score !== null && property.location_score !== undefined ? property.location_score.toFixed(2) : "Lipsa"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl bg-emerald-50 p-5 text-sm font-medium text-emerald-700">
                  Nu exista proprietati pentru aceasta alerta.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
