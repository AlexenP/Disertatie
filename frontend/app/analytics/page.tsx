"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { apiGet, SectorAnalytics } from "@/lib/api";
import type { SectorMapMetric } from "@/components/analytics/SectorChoroplethMap";

const SectorChoroplethMap = dynamic(
  () => import("@/components/analytics/SectorChoroplethMap"),
  { ssr: false },
);

type ComparisonMetric = {
  key: keyof SectorAnalytics;
  label: string;
  format: (value: number | null | undefined) => string;
  differenceLabel?: (difference: number) => string;
  higherIsBetter?: boolean;
  neutral?: boolean;
  showWhen?: (sectorA?: SectorAnalytics, sectorB?: SectorAnalytics) => boolean;
};

const mapMetrics: { value: SectorMapMetric; label: string }[] = [
  { value: "average_price_sqm", label: "Pret mediu/mp" },
  { value: "monthly_revenue", label: "Venit lunar" },
  { value: "occupancy_rate", label: "Rata ocupare" },
  { value: "interest_score", label: "Scor interes" },
  { value: "properties_count", label: "Numar proprietati" },
  { value: "avg_investment_score", label: "Scor investitional" },
];

function formatNumber(value: number | null | undefined, maximumFractionDigits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return value.toLocaleString("ro-RO", { maximumFractionDigits });
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return `${formatNumber(value)} EUR`;
}

function formatPriceSqm(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return `${formatNumber(value)} EUR/mp`;
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return `${formatNumber(value)}%`;
}

function formatDifference(value: number, suffix = "") {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)}${suffix}`;
}

const comparisonMetrics: ComparisonMetric[] = [
  {
    key: "properties_count",
    label: "Numar proprietati",
    format: (value) => formatNumber(value, 0),
    differenceLabel: (difference) => formatDifference(difference),
    higherIsBetter: true,
  },
  {
    key: "total_value",
    label: "Valoare totala",
    format: formatCurrency,
    differenceLabel: (difference) => formatDifference(difference, " EUR"),
    higherIsBetter: true,
  },
  {
    key: "average_price_sqm",
    label: "Pret mediu/mp",
    format: formatPriceSqm,
    differenceLabel: (difference) =>
      difference === 0
        ? "Pret similar"
        : difference > 0
          ? `Sector mai scump cu ${formatNumber(Math.abs(difference))} EUR/mp`
          : `Sector mai accesibil cu ${formatNumber(Math.abs(difference))} EUR/mp`,
    neutral: true,
  },
  {
    key: "monthly_revenue",
    label: "Venit lunar",
    format: formatCurrency,
    differenceLabel: (difference) => formatDifference(difference, " EUR"),
    higherIsBetter: true,
  },
  {
    key: "occupancy_rate",
    label: "Rata ocupare",
    format: formatPercent,
    differenceLabel: (difference) => formatDifference(difference, " pp"),
    higherIsBetter: true,
  },
  {
    key: "interest_score",
    label: "Scor interes",
    format: (value) => formatNumber(value, 0),
    differenceLabel: (difference) => formatDifference(difference),
    higherIsBetter: true,
  },
  {
    key: "avg_location_score",
    label: "Scor locatie mediu",
    format: (value) => (value === null || value === undefined ? "-" : `${formatNumber(value)} / 100`),
    differenceLabel: (difference) => formatDifference(difference),
    higherIsBetter: true,
    showWhen: (sectorA, sectorB) => sectorA?.avg_location_score !== null && sectorA?.avg_location_score !== undefined
      || sectorB?.avg_location_score !== null && sectorB?.avg_location_score !== undefined,
  },
  {
    key: "avg_investment_score",
    label: "Scor investitional mediu",
    format: (value) => (value === null || value === undefined ? "-" : `${formatNumber(value)} / 100`),
    differenceLabel: (difference) => formatDifference(difference),
    higherIsBetter: true,
    showWhen: (sectorA, sectorB) => sectorA?.avg_investment_score !== null && sectorA?.avg_investment_score !== undefined
      || sectorB?.avg_investment_score !== null && sectorB?.avg_investment_score !== undefined,
  },
];

function getNumericValue(sector: SectorAnalytics | undefined, key: keyof SectorAnalytics) {
  const value = sector?.[key];
  return typeof value === "number" ? value : null;
}

function getDifferenceTone(metric: ComparisonMetric, difference: number) {
  if (metric.neutral || difference === 0) {
    return "text-slate-600";
  }

  if (metric.higherIsBetter) {
    return difference > 0 ? "text-emerald-700" : "text-red-700";
  }

  return difference < 0 ? "text-emerald-700" : "text-red-700";
}

function buildSectorComparisonVerdict(sectorA?: SectorAnalytics, sectorB?: SectorAnalytics) {
  if (!sectorA || !sectorB) {
    return "";
  }

  const sentences = [];
  const priceDifference = sectorA.average_price_sqm - sectorB.average_price_sqm;
  const revenueDifference = sectorA.monthly_revenue - sectorB.monthly_revenue;
  const occupancyDifference = sectorA.occupancy_rate - sectorB.occupancy_rate;
  const interestDifference = sectorA.interest_score - sectorB.interest_score;

  if (priceDifference > 0) {
    sentences.push(`${sectorA.sector_name} este mai scump ca pret/mp decat ${sectorB.sector_name}`);
  } else if (priceDifference < 0) {
    sentences.push(`${sectorA.sector_name} pare mai accesibil ca pret/mp decat ${sectorB.sector_name}`);
  }

  if (revenueDifference > 0) {
    sentences.push(`genereaza venit lunar mai mare`);
  } else if (revenueDifference < 0) {
    sentences.push(`${sectorB.sector_name} genereaza venit lunar mai mare`);
  }

  if (occupancyDifference >= 10) {
    sentences.push(`are o rata de ocupare mai buna`);
  } else if (occupancyDifference <= -10) {
    sentences.push(`${sectorB.sector_name} are o rata de ocupare mai buna`);
  }

  if (interestDifference > 0) {
    sentences.push(`si are scor de interes mai ridicat`);
  } else if (interestDifference < 0) {
    sentences.push(`iar ${sectorB.sector_name} atrage mai mult interes`);
  }

  if (sectorA.avg_investment_score !== null && sectorA.avg_investment_score !== undefined && sectorB.avg_investment_score !== null && sectorB.avg_investment_score !== undefined) {
    const investmentDifference = sectorA.avg_investment_score - sectorB.avg_investment_score;

    if (investmentDifference > 0) {
      sentences.push(`Scorul investitional avantajeaza ${sectorA.sector_name}`);
    } else if (investmentDifference < 0) {
      sentences.push(`Scorul investitional avantajeaza ${sectorB.sector_name}`);
    }
  }

  if (!sentences.length) {
    return "Cele doua sectoare au indicatori apropiati si necesita analiza suplimentara.";
  }

  return `${sentences.join(", ")}.`;
}

function InsightCard({ title, value, helper }: { title: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const [rows, setRows] = useState<SectorAnalytics[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sectorAId, setSectorAId] = useState<number | null>(null);
  const [sectorBId, setSectorBId] = useState<number | null>(null);
  const [mapMetric, setMapMetric] = useState<SectorMapMetric>("average_price_sqm");

  useEffect(() => {
    async function loadAnalytics() {
      try {
        setLoading(true);
        const data = await apiGet<SectorAnalytics[]>("/analytics/sectors");
        const sortedData = [...data].sort((a, b) => a.sector_id - b.sector_id);
        setRows(sortedData);
        setSectorAId((current) => current ?? sortedData[0]?.sector_id ?? null);
        setSectorBId((current) => current ?? sortedData[1]?.sector_id ?? sortedData[0]?.sector_id ?? null);
        setError("");
      } catch {
        setError("Nu se poate incarca analiza pe sectoare. Verifica daca esti autentificat si backend-ul FastAPI ruleaza.");
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, []);

  const sectorA = rows.find((row) => row.sector_id === sectorAId);
  const sectorB = rows.find((row) => row.sector_id === sectorBId);
  const selectedSameSector = sectorAId !== null && sectorAId === sectorBId;

  const insights = useMemo(() => {
    const topPrice = rows.length ? [...rows].sort((a, b) => b.average_price_sqm - a.average_price_sqm)[0] : null;
    const topRevenue = rows.length ? [...rows].sort((a, b) => b.monthly_revenue - a.monthly_revenue)[0] : null;
    const topOccupancy = rows.length ? [...rows].sort((a, b) => b.occupancy_rate - a.occupancy_rate)[0] : null;
    const topInterest = rows.length ? [...rows].sort((a, b) => b.interest_score - a.interest_score)[0] : null;

    return { topPrice, topRevenue, topOccupancy, topInterest };
  }, [rows]);

  const visibleComparisonMetrics = comparisonMetrics.filter((metric) => !metric.showWhen || metric.showWhen(sectorA, sectorB));
  const verdict = buildSectorComparisonVerdict(sectorA, sectorB);

  if (loading) {
    return <p>Se incarca analiza pe sectoare...</p>;
  }

  if (error) {
    return (
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-red-600">Eroare incarcare analiza</h2>
        <p className="mt-2 text-slate-600">{error}</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-slate-900 p-8 text-white shadow-sm">
        <h2 className="text-3xl font-bold">Analiza pe sectoare</h2>
        <p className="mt-2 text-slate-300">Comparatie economica pentru cele 6 sectoare din Bucuresti.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InsightCard
          title="Cel mai scump sector"
          value={insights.topPrice?.sector_name ?? "-"}
          helper={insights.topPrice ? `${formatPriceSqm(insights.topPrice.average_price_sqm)}` : "Nu exista date"}
        />
        <InsightCard
          title="Cel mai bun venit lunar"
          value={insights.topRevenue?.sector_name ?? "-"}
          helper={insights.topRevenue ? `${formatCurrency(insights.topRevenue.monthly_revenue)}` : "Nu exista date"}
        />
        <InsightCard
          title="Cea mai buna ocupare"
          value={insights.topOccupancy?.sector_name ?? "-"}
          helper={insights.topOccupancy ? `${formatPercent(insights.topOccupancy.occupancy_rate)}` : "Nu exista date"}
        />
        <InsightCard
          title="Cel mai mare scor interes"
          value={insights.topInterest?.sector_name ?? "-"}
          helper={insights.topInterest ? `${formatNumber(insights.topInterest.interest_score, 0)} puncte` : "Nu exista date"}
        />
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-2xl font-bold text-slate-900">Comparare sectoare</h3>
            <p className="mt-1 text-sm text-slate-500">Alege doua sectoare si compara indicatorii economici principali.</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Primul sector
              <select
                value={sectorAId ?? ""}
                onChange={(event) => setSectorAId(Number(event.target.value))}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900"
              >
                {rows.map((row) => (
                  <option key={row.sector_id} value={row.sector_id}>
                    {row.sector_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Al doilea sector
              <select
                value={sectorBId ?? ""}
                onChange={(event) => setSectorBId(Number(event.target.value))}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900"
              >
                {rows.map((row) => (
                  <option key={row.sector_id} value={row.sector_id}>
                    {row.sector_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {selectedSameSector ? (
          <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm font-medium text-amber-800 ring-1 ring-amber-200">
            Selecteaza doua sectoare diferite pentru comparatie.
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-100">
            <div className="grid grid-cols-4 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
              <span>Indicator</span>
              <span>{sectorA?.sector_name}</span>
              <span>{sectorB?.sector_name}</span>
              <span>Diferenta</span>
            </div>

            {visibleComparisonMetrics.map((metric) => {
              const valueA = getNumericValue(sectorA, metric.key);
              const valueB = getNumericValue(sectorB, metric.key);
              const difference = (valueA ?? 0) - (valueB ?? 0);

              return (
                <div key={metric.key} className="grid grid-cols-4 gap-3 border-t border-slate-100 px-4 py-3 text-sm">
                  <span className="font-medium text-slate-700">{metric.label}</span>
                  <span className="text-slate-900">{metric.format(valueA)}</span>
                  <span className="text-slate-900">{metric.format(valueB)}</span>
                  <span className={`font-semibold ${getDifferenceTone(metric, difference)}`}>
                    {metric.differenceLabel ? metric.differenceLabel(difference) : formatDifference(difference)}
                  </span>
                </div>
              );
            })}

            <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              <strong className="text-slate-900">Verdict: </strong>
              {verdict}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-2xl font-bold text-slate-900">Harta comparativa pe sectoare</h3>
            <p className="mt-1 text-sm text-slate-500">Sectoarele sunt colorate in functie de indicatorul selectat.</p>
          </div>

          <label className="text-sm font-medium text-slate-700">
            Indicator harta
            <select
              value={mapMetric}
              onChange={(event) => setMapMetric(event.target.value as SectorMapMetric)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 lg:w-72"
            >
              {mapMetrics.map((metric) => (
                <option key={metric.value} value={metric.value}>
                  {metric.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6">
          <SectorChoroplethMap sectors={rows} metric={mapMetric} />
        </div>
      </div>

      <div>
        <h3 className="text-2xl font-bold text-slate-900">Carduri pe sectoare</h3>
        <p className="mt-1 text-sm text-slate-500">Detalii economice pentru fiecare sector din portofoliul curent.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {rows.map((row) => (
          <div key={row.sector_id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <h3 className="text-xl font-semibold text-slate-900">{row.sector_name}</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <p>Proprietati: <strong>{row.properties_count}</strong></p>
              <p>Pret mediu/mp: <strong>{formatPriceSqm(row.average_price_sqm)}</strong></p>
              <p>Valoare totala: <strong>{formatCurrency(row.total_value)}</strong></p>
              <p>Venit lunar: <strong>{formatCurrency(row.monthly_revenue)}</strong></p>
              <p>Rata ocupare: <strong>{formatPercent(row.occupancy_rate)}</strong></p>
              <p>Scor interes: <strong>{formatNumber(row.interest_score, 0)}</strong></p>
              <p>Scor locatie mediu: <strong>{row.avg_location_score === null || row.avg_location_score === undefined ? "-" : `${formatNumber(row.avg_location_score)} / 100`}</strong></p>
              <p>Scor investitional mediu: <strong>{row.avg_investment_score === null || row.avg_investment_score === undefined ? "-" : `${formatNumber(row.avg_investment_score)} / 100`}</strong></p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
