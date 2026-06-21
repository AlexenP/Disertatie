"use client";

import { useMemo } from "react";
import { GeoJSON, MapContainer, Popup, TileLayer } from "react-leaflet";
import type { Layer } from "leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { SectorAnalytics } from "@/lib/api";
import { bucharestSectorPolygons } from "@/lib/bucharestSectorPolygons";

export type SectorMapMetric =
  | "average_price_sqm"
  | "monthly_revenue"
  | "occupancy_rate"
  | "interest_score"
  | "properties_count"
  | "avg_investment_score";

type SectorChoroplethMapProps = {
  sectors: SectorAnalytics[];
  metric: SectorMapMetric;
};

type SectorFeatureProperties = {
  sector_id: number;
  name?: string;
};

const metricLabels: Record<SectorMapMetric, string> = {
  average_price_sqm: "Pret mediu/mp",
  monthly_revenue: "Venit lunar",
  occupancy_rate: "Rata ocupare",
  interest_score: "Scor interes",
  properties_count: "Numar proprietati",
  avg_investment_score: "Scor investitional",
};

const metricLegendText: Record<SectorMapMetric, { low: string; high: string }> = {
  average_price_sqm: { low: "pret/mp mai mic", high: "pret/mp mai mare" },
  monthly_revenue: { low: "venit scazut", high: "venit ridicat" },
  occupancy_rate: { low: "ocupare scazuta", high: "ocupare ridicata" },
  interest_score: { low: "interes scazut", high: "interes ridicat" },
  properties_count: { low: "putine proprietati", high: "multe proprietati" },
  avg_investment_score: { low: "scor scazut", high: "scor ridicat" },
};

function normalize(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return 0;
  if (max === min) return 0.7;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export function getSectorColor(value: number, min: number, max: number) {
  const normalized = normalize(value, min, max);

  if (normalized < 0.2) return "#FEE2E2";
  if (normalized < 0.4) return "#FDBA74";
  if (normalized < 0.6) return "#FACC15";
  if (normalized < 0.8) return "#86EFAC";
  return "#16A34A";
}

function formatMetricValue(value: number | null | undefined, metric: SectorMapMetric) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Nu exista date";
  }

  if (metric === "average_price_sqm") {
    return `${value.toLocaleString("ro-RO", { maximumFractionDigits: 2 })} EUR/mp`;
  }

  if (metric === "monthly_revenue") {
    return `${value.toLocaleString("ro-RO", { maximumFractionDigits: 2 })} EUR`;
  }

  if (metric === "occupancy_rate") {
    return `${value.toLocaleString("ro-RO", { maximumFractionDigits: 2 })}%`;
  }

  if (metric === "avg_investment_score") {
    return `${value.toLocaleString("ro-RO", { maximumFractionDigits: 2 })} / 100`;
  }

  return value.toLocaleString("ro-RO", { maximumFractionDigits: 2 });
}

function getMetricValue(sector: SectorAnalytics | undefined, metric: SectorMapMetric) {
  if (!sector) return null;
  return sector[metric] ?? null;
}

export default function SectorChoroplethMap({ sectors, metric }: SectorChoroplethMapProps) {
  const sectorById = useMemo(() => new Map(sectors.map((sector) => [sector.sector_id, sector])), [sectors]);
  const values = useMemo(
    () =>
      sectors
        .map((sector) => getMetricValue(sector, metric))
        .filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value)),
    [metric, sectors],
  );
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const geoJsonData = bucharestSectorPolygons as unknown as FeatureCollection<Geometry, SectorFeatureProperties>;

  return (
    <div className="space-y-4">
      <div className="h-[450px] overflow-hidden rounded-2xl border border-slate-200">
        <MapContainer
          center={[44.4268, 26.1025]}
          zoom={11}
          minZoom={10}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <GeoJSON
            key={metric}
            data={geoJsonData}
            style={(feature) => {
              const sectorId = feature?.properties?.sector_id;
              const sector = sectorId ? sectorById.get(sectorId) : undefined;
              const value = getMetricValue(sector, metric);
              const fillColor = value === null ? "#E2E8F0" : getSectorColor(value, min, max);

              return {
                color: "#0f172a",
                weight: 1.5,
                fillColor,
                fillOpacity: value === null ? 0.35 : 0.72,
                opacity: 0.7,
              };
            }}
            onEachFeature={(feature: Feature<Geometry, SectorFeatureProperties>, layer: Layer) => {
              const sectorId = feature.properties?.sector_id;
              const sector = sectorId ? sectorById.get(sectorId) : undefined;
              const selectedValue = getMetricValue(sector, metric);
              const sectorName = sector?.sector_name ?? feature.properties?.name ?? `Sector ${sectorId}`;

              layer.bindTooltip(sectorName, {
                permanent: true,
                direction: "center",
                className: "sector-label-tooltip",
                opacity: 1,
              });

              layer.bindPopup(() => {
                const container = document.createElement("div");
                container.className = "min-w-64 space-y-2 text-sm text-slate-700";
                container.innerHTML = `
                  <div>
                    <strong class="block text-base text-slate-900">${sectorName}</strong>
                    <span class="text-xs text-slate-500">${metricLabels[metric]}: ${formatMetricValue(selectedValue, metric)}</span>
                  </div>
                  <div class="grid grid-cols-2 gap-x-4 gap-y-1">
                    <span>Proprietati</span><strong>${sector?.properties_count ?? 0}</strong>
                    <span>Pret mediu/mp</span><strong>${formatMetricValue(sector?.average_price_sqm, "average_price_sqm")}</strong>
                    <span>Venit lunar</span><strong>${formatMetricValue(sector?.monthly_revenue, "monthly_revenue")}</strong>
                    <span>Rata ocupare</span><strong>${formatMetricValue(sector?.occupancy_rate, "occupancy_rate")}</strong>
                    <span>Scor interes</span><strong>${formatMetricValue(sector?.interest_score, "interest_score")}</strong>
                    <span>Scor investitional</span><strong>${formatMetricValue(sector?.avg_investment_score, "avg_investment_score")}</strong>
                  </div>
                `;
                return container;
              });
            }}
          />
        </MapContainer>
      </div>

      <div className="rounded-2xl bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <strong className="text-slate-900">{metricLabels[metric]}: scazut - ridicat</strong>
          <span>{metricLegendText[metric].low}</span>
          <div className="h-3 min-w-48 flex-1 rounded-full bg-gradient-to-r from-[#FEE2E2] via-[#FACC15] to-[#16A34A]" />
          <span>{metricLegendText[metric].high}</span>
        </div>
        <div className="mt-2 flex justify-between text-xs text-slate-500">
          <span>Minim: {formatMetricValue(min, metric)}</span>
          <span>Mediu</span>
          <span>Maxim: {formatMetricValue(max, metric)}</span>
        </div>
      </div>
    </div>
  );
}
