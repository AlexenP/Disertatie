"use client";

import {Fragment, useMemo} from "react";
import {Circle, CircleMarker, Popup} from "react-leaflet";
import type {PropertyItem} from "@/lib/api";
import {
    calculateGrossYield,
    ColorMode,
    getAbsoluteScoreColor,
    getMetricLabel,
    getPropertyScore,
    getRelativeScoreColor,
    getScoreInterpretation,
    missingScoreColor,
    normalizeScore,
    ScoreMetric,
} from "@/lib/scoreMap";

type ScoreMapLayerProps = {
    properties: PropertyItem[];
    metric: ScoreMetric;
    colorMode: ColorMode;
    visible: boolean;
    canEditProperties: boolean;
    canDeleteProperties: boolean;
    onEditProperty: (property: PropertyItem) => void;
    onRequestDeleteProperty: (property: PropertyItem) => void;
    onRecalculateScore?: (property: PropertyItem) => void;
    recalculatingPropertyId?: number | null;
};

const marketLabels: Record<PropertyItem["market_label"], string> = {
    sub_piata: "Sub piata",
    la_piata: "La piata",
    peste_piata: "Peste piata",
};

const statusLabels: Record<string, string> = {
    available: "Disponibila",
    rented: "Inchiriata",
    occupied: "Ocupata",
    sold: "Vanduta",
    inactive: "Inactiva",
};

function formatScore(value?: number | null) {
    return value === null || value === undefined ? "-" : `${value.toFixed(2)} / 100`;
}

function formatDistance(value?: number | null) {
    return value === null || value === undefined ? "-" : `${Math.round(value)} m`;
}

function ScoreDetail({label, value}: { label: string; value?: number | null }) {
    return (
        <div className="flex justify-between gap-3">
            <span>{label}</span>
            <strong>{formatScore(value)}</strong>
        </div>
    );
}

function CountDetail({label, value}: { label: string; value?: number | null }) {
    return (
        <div className="flex justify-between gap-3">
            <span>{label}</span>
            <strong>{value ?? 0}</strong>
        </div>
    );
}

function MetricDetails({property, metric}: { property: PropertyItem; metric: ScoreMetric }) {
    const grossYield = calculateGrossYield(property);

    if (metric === "accessibility_score") {
        return (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <CountDetail label="Metrou" value={property.poi_metro_count}/>
                <CountDetail label="Transport public" value={property.poi_transport_count}/>
                <div>Metrou apropiat</div>
                <strong>{formatDistance(property.nearest_metro_m)}</strong>
                <div>Transport apropiat</div>
                <strong>{formatDistance(property.nearest_transport_m)}</strong>
            </div>
        );
    }

    if (metric === "facilities_score") {
        return (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <CountDetail label="Educatie" value={property.poi_education_count}/>
                <CountDetail label="Sanatate" value={property.poi_health_count}/>
                <CountDetail label="Farmacii" value={property.poi_pharmacy_count}/>
                <CountDetail label="Parcuri" value={property.poi_green_count}/>
                <CountDetail label="Servicii" value={property.poi_commercial_count}/>
            </div>
        );
    }

    if (metric === "investment_score") {
        return (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div>Scor locatie</div>
                <strong>{formatScore(property.location_score)}</strong>
                <div>Pret/mp</div>
                <strong>{property.price_sqm.toFixed(2)} EUR</strong>
                <div>Piata</div>
                <strong>{marketLabels[property.market_label] ?? property.market_label}</strong>
                <div>Randament brut</div>
                <strong>{grossYield === null ? "-" : `${grossYield.toFixed(2)}%`}</strong>
                <div>Status</div>
                <strong>{statusLabels[property.status] ?? property.status}</strong>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <ScoreDetail label="Accesibilitate" value={property.accessibility_score}/>
            <ScoreDetail label="Facilitati" value={property.facilities_score}/>
            <CountDetail label="Transport" value={property.poi_transport_count}/>
            <CountDetail label="Educatie" value={property.poi_education_count}/>
            <CountDetail label="Sanatate" value={property.poi_health_count}/>
            <CountDetail label="Parcuri" value={property.poi_green_count}/>
            <CountDetail label="Servicii" value={property.poi_commercial_count}/>
        </div>
    );
}

export default function ScoreMapLayer({
                                          properties,
                                          metric,
                                          colorMode,
                                          visible,
                                          canEditProperties,
                                          canDeleteProperties,
                                          onEditProperty,
                                          onRequestDeleteProperty,
                                          onRecalculateScore,
                                          recalculatingPropertyId,
                                      }: ScoreMapLayerProps) {
    const validScores = useMemo(
        () =>
            properties
                .map((property) => getPropertyScore(property, metric))
                .filter((score): score is number => score !== null),
        [properties, metric],
    );
    const minScore = validScores.length ? Math.min(...validScores) : 0;
    const maxScore = validScores.length ? Math.max(...validScores) : 100;

    if (!visible) {
        return null;
    }

    return (
        <>
            {properties.map((property) => {
                const score = getPropertyScore(property, metric);
                const hasScore = score !== null;
                const normalized = hasScore
                    ? colorMode === "relative"
                        ? normalizeScore(score, minScore, maxScore)
                        : Math.max(0, Math.min(1, score / 100))
                    : 0;
                const color = hasScore
                    ? colorMode === "relative"
                        ? getRelativeScoreColor(score, minScore, maxScore)
                        : getAbsoluteScoreColor(score)
                    : missingScoreColor;
                const mainRadius = hasScore ? 10 + normalized * 6 : 10;
                const auraRadius = hasScore ? 180 + normalized * 220 : 150;
                const interpretation = hasScore
                    ? getScoreInterpretation(score, metric)
                    : "Scor lipsa. Recalculeaza scorurile pentru aceasta proprietate.";

                return (
                    <Fragment key={property.id}>
                        <Circle
                            center={[property.latitude, property.longitude]}
                            radius={auraRadius}
                            pathOptions={{
                                color,
                                fillColor: color,
                                fillOpacity: hasScore ? 0.2 : 0.12,
                                opacity: hasScore ? 0.22 : 0.16,
                                weight: 1,
                            }}
                        />
                        <CircleMarker
                            center={[property.latitude, property.longitude]}
                            radius={mainRadius}
                            pathOptions={{
                                color: "#ffffff",
                                fillColor: color,
                                fillOpacity: hasScore ? 0.9 : 0.65,
                                opacity: 1,
                                weight: 2,
                            }}
                            eventHandlers={{
                                dblclick: (event) => {
                                    event.originalEvent?.preventDefault?.();
                                    event.originalEvent?.stopPropagation?.();
                                    if (canEditProperties) {
                                        onEditProperty(property);
                                    }
                                },
                            }}
                        >
                            <Popup>
                                <div className="min-w-72 max-w-sm space-y-3 text-sm text-slate-700">
                                    <div>
                                        <strong className="block text-base text-slate-900">{property.title}</strong>
                                        <p className="mt-1 text-xs text-slate-500">{property.address}</p>
                                        <p className="mt-1 text-xs text-slate-500">Sector {property.sector_id}</p>
                                    </div>

                                    <div className="rounded-xl bg-slate-50 p-3">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            {getMetricLabel(metric)}
                                        </p>
                                        <p className="mt-1 text-2xl font-bold text-slate-900">
                                            {hasScore ? `${score.toFixed(2)} / 100` : "Scor lipsa"}
                                        </p>
                                        <p className="mt-2 text-xs text-slate-600">{interpretation}</p>
                                    </div>

                                    <div className="space-y-1 rounded-xl border border-slate-100 p-3 text-xs">
                                        <ScoreDetail label="Accesibilitate" value={property.accessibility_score}/>
                                        <ScoreDetail label="Facilitati" value={property.facilities_score}/>
                                        <ScoreDetail label="Investitional" value={property.investment_score}/>
                                    </div>

                                    <div className="space-y-1 rounded-xl border border-slate-100 p-3 text-xs">
                                        <MetricDetails property={property} metric={metric}/>
                                    </div>

                                    {(canEditProperties || canDeleteProperties) && (
                                        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                                            {canEditProperties && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => onEditProperty(property)}
                                                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                                    >
                                                        Editeaza
                                                    </button>
                                                    {onRecalculateScore && (
                                                        <button
                                                            type="button"
                                                            onClick={() => onRecalculateScore(property)}
                                                            disabled={recalculatingPropertyId === property.id}
                                                            className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                                                        >
                                                            {recalculatingPropertyId === property.id
                                                                ? "Scoruri..."
                                                                : "Recalculeaza scorurile"}
                                                        </button>
                                                    )}
                                                </>
                                            )}

                                            {canDeleteProperties && (
                                                <button
                                                    type="button"
                                                    onClick={() => onRequestDeleteProperty(property)}
                                                    className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                                                >
                                                    Sterge
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </Popup>
                        </CircleMarker>
                    </Fragment>
                );
            })}
        </>
    );
}
