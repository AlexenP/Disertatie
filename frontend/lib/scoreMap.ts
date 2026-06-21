import type {PropertyItem} from "@/lib/api";

export type ScoreMetric =
    | "location_score"
    | "accessibility_score"
    | "facilities_score"
    | "investment_score";

export type ColorMode = "relative" | "absolute";

export const missingScoreColor = "#64748B";

export function getMetricLabel(metric: ScoreMetric): string {
    const labels: Record<ScoreMetric, string> = {
        location_score: "Scor locatie",
        accessibility_score: "Accesibilitate",
        facilities_score: "Facilitati",
        investment_score: "Investitional",
    };

    return labels[metric];
}

export function getPropertyScore(property: PropertyItem, metric: ScoreMetric): number | null {
    const value = property[metric];

    if (value === null || value === undefined || !Number.isFinite(value)) {
        return null;
    }

    return value;
}

export function getAbsoluteScoreColor(score: number): string {
    if (score < 40) {
        return "#DC2626";
    }
    if (score < 60) {
        return "#F97316";
    }
    if (score < 75) {
        return "#EAB308";
    }
    if (score < 90) {
        return "#22C55E";
    }
    return "#15803D";
}

export function normalizeScore(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }

    if (max === min) {
        return 0.7;
    }

    return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export function getRelativeScoreColor(value: number, min: number, max: number): string {
    const relative = normalizeScore(value, min, max);

    if (relative < 0.2) {
        return "#DC2626";
    }
    if (relative < 0.4) {
        return "#F97316";
    }
    if (relative < 0.6) {
        return "#EAB308";
    }
    if (relative < 0.8) {
        return "#22C55E";
    }
    return "#15803D";
}

export function getScoreInterpretation(score: number, metric: ScoreMetric): string {
    if (metric === "accessibility_score") {
        return "Scorul reflecta accesul la metrou, statii STB, tramvai si distanta pana la cele mai apropiate puncte de transport.";
    }

    if (metric === "facilities_score") {
        return "Scorul reflecta accesul la scoli, spitale, farmacii, spatii verzi, restaurante si servicii comerciale.";
    }

    if (metric === "investment_score") {
        return "Scorul combina atractivitatea locatiei cu indicatorii economici ai proprietatii.";
    }

    if (score >= 90) {
        return "Locatie excelenta pentru locuire si investitie.";
    }
    if (score >= 75) {
        return "Locatie foarte buna, cu acces bun la facilitati.";
    }
    if (score >= 60) {
        return "Locatie buna, dar cu potential de imbunatatire.";
    }
    if (score >= 40) {
        return "Locatie medie, necesita analiza suplimentara.";
    }
    return "Locatie slaba fata de restul portofoliului.";
}

export function calculateGrossYield(property: PropertyItem): number | null {
    if (!property.price || !property.monthly_rent) {
        return null;
    }

    return (property.monthly_rent * 12 / property.price) * 100;
}
