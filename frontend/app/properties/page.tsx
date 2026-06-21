"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import {apiGet, getAuthHeaders} from "@/lib/api";
import dynamic from "next/dynamic";
import {Check, ChevronDown, Download, RotateCcw, SlidersHorizontal} from "lucide-react";
import {
    canCreateProperty,
    canDeleteProperty,
    canEditProperty,
    canExportReports,
    GeoEstateUser,
    getCurrentUser,
} from "@/lib/auth";
import {detectBucharestSector} from "@/lib/bucharestSectors";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";

const LocationPicker = dynamic(
    () => import("@/components/map/LocationPicker"),
    {
        ssr: false,
    }
);


type PropertyItem = {
    id: number;
    code: string;
    title: string;
    address: string;
    sector_id: number;
    sector_name?: string;
    property_type_id: number;
    property_type_name?: string;
    latitude: number;
    longitude: number;
    surface_sqm: number;
    price: number;
    price_sqm: number;
    market_average_sqm: number | null;
    market_difference_percent: number | null;
    market_label: "sub_piata" | "la_piata" | "peste_piata";
    accessibility_score?: number | null;
    facilities_score?: number | null;
    location_score?: number | null;
    investment_score?: number | null;
    poi_metro_count?: number;
    poi_transport_count?: number;
    poi_education_count?: number;
    poi_health_count?: number;
    poi_pharmacy_count?: number;
    poi_green_count?: number;
    poi_commercial_count?: number;
    nearest_metro_m?: number | null;
    nearest_transport_m?: number | null;
    nearest_school_m?: number | null;
    nearest_health_m?: number | null;
    nearest_green_m?: number | null;
    nearest_commercial_m?: number | null;
    poi_last_updated_at?: string | null;
    monthly_rent: number;
    status: string;
    owner_admin_id?: number;
};

type PropertyForm = {
    title: string;
    address: string;
    sector_id: number;
    property_type_id: number;
    latitude: number;
    longitude: number;
    surface_sqm: number;
    price: number;
    monthly_rent: number;
    status: string;
};

type ExportFilters = {
    title_query: string;
    address_query: string;
    sector_ids: string[];
    property_type_ids: string[];
    surface_min: string;
    surface_max: string;
    price_min: string;
    price_max: string;
    market_labels: string[];
    rent_min: string;
    rent_max: string;
    statuses: string[];
};

type MultiSelectOption = {
    id: string;
    label: string;
};

const emptyForm: PropertyForm = {
    title: "",
    address: "",
    sector_id: 1,
    property_type_id: 1,
    latitude: 44.4268,
    longitude: 26.1025,
    surface_sqm: 50,
    price: 100000,
    monthly_rent: 500,
    status: "available",
};

const emptyExportFilters: ExportFilters = {
    title_query: "",
    address_query: "",
    sector_ids: ["1", "2", "3", "4", "5", "6"],
    property_type_ids: ["1", "2", "3", "4", "5"],
    surface_min: "",
    surface_max: "",
    price_min: "",
    price_max: "",
    market_labels: ["sub_piata", "la_piata", "peste_piata"],
    rent_min: "",
    rent_max: "",
    statuses: ["available", "rented", "occupied", "sold", "inactive"],
};

const exportSectorOptions = [
    {id: "1", label: "Sector 1"},
    {id: "2", label: "Sector 2"},
    {id: "3", label: "Sector 3"},
    {id: "4", label: "Sector 4"},
    {id: "5", label: "Sector 5"},
    {id: "6", label: "Sector 6"},
];

const exportPropertyTypeOptions = [
    {id: "1", label: "Apartament"},
    {id: "2", label: "Garsoniera"},
    {id: "3", label: "Casa"},
    {id: "4", label: "Spatiu comercial"},
    {id: "5", label: "Birou"},
];

const statuses = {
    available: {
        label: "Disponibila",
        className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    },
    rented: {
        label: "Inchiriata",
        className: "bg-blue-50 text-blue-700 ring-blue-200",
    },
    occupied: {
        label: "Ocupata",
        className: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    },
    sold: {
        label: "Vanduta",
        className: "bg-slate-100 text-slate-700 ring-slate-300",
    },
    inactive: {
        label: "Inactiva",
        className: "bg-red-50 text-red-700 ring-red-200",
    },
};

const exportStatusOptions = Object.entries(statuses).map(([id, config]) => ({
    id,
    label: config.label,
}));

const exportMarketOptions = [
    {id: "sub_piata", label: "Sub piata"},
    {id: "la_piata", label: "La piata"},
    {id: "peste_piata", label: "Peste piata"},
];

const marketLabels = {
    sub_piata: {
        label: "Sub piata",
        className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    },
    la_piata: {
        label: "La piata",
        className: "bg-amber-50 text-amber-700 ring-amber-200",
    },
    peste_piata: {
        label: "Peste piata",
        className: "bg-red-50 text-red-700 ring-red-200",
    },
};

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
    try {
        const response = await fetch(`http://127.0.0.1:8000${path}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaders(),
                ...(options?.headers as Record<string, string> | undefined),
            },
        });

        if (!response.ok) {
            let message = "Serverul a refuzat salvarea proprietatii.";

            try {
                const data = await response.json();

                if (typeof data.detail === "string") {
                    message = data.detail;
                }

                if (Array.isArray(data.detail)) {
                    message = data.detail
                        .map((item: { loc?: string[]; msg?: string }) => {
                            const field = item.loc?.[item.loc.length - 1] ?? "camp";
                            return `${field}: ${item.msg}`;
                        })
                        .join(" | ");
                }
            } catch {
                message = `Serverul a returnat eroarea ${response.status}.`;
            }

            throw new Error(message);
        }

        return response.json();
    } catch (err) {
        if (err instanceof TypeError) {
            throw new Error(
                "Nu se poate face conexiunea cu serverul. Verifica daca backend-ul FastAPI ruleaza pe http://127.0.0.1:8000."
            );
        }

        throw err;
    }
}

function FieldLabel({children}: { children: React.ReactNode }) {
    return <label className="text-sm font-semibold text-slate-700">{children}</label>;
}

function getSelectionSummary(selectedIds: string[], options: MultiSelectOption[], allLabel: string) {
    if (selectedIds.length === options.length) {
        return allLabel;
    }

    const selectedLabels = options
        .filter((option) => selectedIds.includes(option.id))
        .map((option) => option.label);

    if (selectedLabels.length <= 2) {
        return selectedLabels.join(", ");
    }

    return `${selectedLabels.length} selectate`;
}

function MultiSelectDropdown({
                                 allLabel,
                                 isOpen,
                                 onToggle,
                                 onToggleOption,
                                 options,
                                 selectedIds,
                             }: {
    allLabel: string;
    isOpen: boolean;
    onToggle: () => void;
    onToggleOption: (id: string) => void;
    options: MultiSelectOption[];
    selectedIds: string[];
}) {
    return (
        <div className="relative">
            <button
                type="button"
                onClick={onToggle}
                className={`flex min-h-[52px] w-full items-center justify-between rounded-2xl border bg-white px-4 py-3 text-left shadow-sm outline-none transition hover:border-slate-300 hover:bg-slate-50 focus:border-slate-900 ${
                    isOpen ? "border-slate-900 ring-4 ring-slate-100" : "border-slate-200"
                }`}
            >
                <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-slate-900">
                        {getSelectionSummary(selectedIds, options, allLabel)}
                    </span>
                    <span className="mt-0.5 text-xs text-slate-500">
                        {selectedIds.length} din {options.length} selectate
                    </span>
                </span>
                <span className="text-slate-400">{isOpen ? "▲" : "▼"}</span>
            </button>

            {isOpen && (
                <div className="absolute left-0 right-0 top-full z-[10020] mt-2 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                    {options.map((option) => {
                        const selected = selectedIds.includes(option.id);

                        return (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => onToggleOption(option.id)}
                                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                                    selected
                                        ? "bg-slate-900 font-semibold text-white"
                                        : "text-slate-700 hover:bg-slate-100"
                                }`}
                            >
                                <span>{option.label}</span>
                                <span className={selected ? "text-xs text-slate-200" : "text-xs text-slate-400"}>
                                    {selected ? "selectat" : "selecteaza"}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function PrettyMultiSelectDropdown({
                                       allLabel,
                                       isOpen,
                                       onToggle,
                                       onToggleOption,
                                       onSelectAll,
                                       options,
                                       selectedIds,
                                   }: {
    allLabel: string;
    isOpen: boolean;
    onToggle: () => void;
    onToggleOption: (id: string) => void;
    onSelectAll: () => void;
    options: MultiSelectOption[];
    selectedIds: string[];
}) {
    const allSelected = selectedIds.length === options.length;

    return (
        <div className="relative">
            <button
                type="button"
                onClick={onToggle}
                className={`flex min-h-[54px] w-full items-center justify-between rounded-2xl border bg-white px-4 py-3 text-left shadow-sm outline-none transition hover:border-slate-300 hover:bg-slate-50 focus:border-slate-900 ${
                    isOpen ? "border-slate-900 ring-4 ring-slate-100" : "border-slate-200"
                }`}
            >
                <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-slate-900">
                        {getSelectionSummary(selectedIds, options, allLabel)}
                    </span>
                    <span className="mt-0.5 text-xs text-slate-500">
                        {selectedIds.length} din {options.length} selectate
                    </span>
                </span>
                <ChevronDown
                    className={`h-5 w-5 shrink-0 text-slate-400 transition ${isOpen ? "rotate-180 text-slate-700" : ""}`}
                />
            </button>

            {isOpen && (
                <div className="absolute left-0 right-0 top-full z-[10020] mt-2 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/15">
                    <button
                        type="button"
                        onClick={onSelectAll}
                        className={`mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                            allSelected
                                ? "bg-slate-900 text-white shadow-sm hover:bg-slate-800"
                                : "bg-slate-50 text-slate-500 ring-1 ring-slate-200 hover:bg-slate-100 hover:text-slate-800"
                        }`}
                    >
                        <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                allSelected
                                    ? "border-white bg-white text-slate-900"
                                    : "border-slate-300 bg-white text-transparent"
                            }`}
                        >
                            {allSelected && <Check className="h-3.5 w-3.5"/>}
                        </span>
                        <span>Select all</span>
                    </button>

                    {options.map((option) => {
                        const selected = selectedIds.includes(option.id);

                        return (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => onToggleOption(option.id)}
                                className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition last:mb-0 ${
                                    selected
                                        ? "bg-slate-50 font-semibold text-slate-950 ring-1 ring-slate-200"
                                        : "text-slate-700 hover:bg-slate-50"
                                }`}
                            >
                                <span
                                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                        selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300"
                                    }`}
                                >
                                    {selected && <Check className="h-3.5 w-3.5"/>}
                                </span>
                                <span>{option.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function StatusBadge({status}: { status: string }) {
    const config = statuses[status as keyof typeof statuses] ?? statuses.available;

    return (
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${config.className}`}>
      {config.label}
    </span>
    );
}

function MarketBadge({label}: { label: PropertyItem["market_label"] }) {
    const config = marketLabels[label] ?? marketLabels.la_piata;

    return (
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${config.className}`}>
      {config.label}
    </span>
    );
}

function ScoreLine({label, value}: { label: string; value?: number | null }) {
    return (
        <div className="flex justify-between gap-3 text-xs text-slate-600">
            <span>{label}</span>
            <strong className="text-slate-900">
                {value === null || value === undefined ? "-" : `${value.toFixed(2)} / 100`}
            </strong>
        </div>
    );
}

function LocationScoresSummary({property}: { property: PropertyItem }) {
    const hasScores = property.location_score !== null && property.location_score !== undefined;

    if (!hasScores) {
        return (
            <div className="mt-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                Scorurile de locatie nu au fost calculate.
            </div>
        );
    }

    return (
        <div className="mt-2 space-y-2 rounded-xl bg-slate-50 p-3">
            <ScoreLine label="Scor locatie" value={property.location_score}/>
            <ScoreLine label="Accesibilitate" value={property.accessibility_score}/>
            <ScoreLine label="Facilitati" value={property.facilities_score}/>
            <ScoreLine label="Investitional" value={property.investment_score}/>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-slate-200 pt-2 text-xs text-slate-500">
                <span>Metrou: {property.poi_metro_count ?? 0}</span>
                <span>Transport: {property.poi_transport_count ?? 0}</span>
                <span>Educatie: {property.poi_education_count ?? 0}</span>
                <span>Sanatate: {property.poi_health_count ?? 0}</span>
                <span>Parcuri: {property.poi_green_count ?? 0}</span>
                <span>Servicii: {property.poi_commercial_count ?? 0}</span>
            </div>
        </div>
    );
}

function SummaryCard({title, value}: { title: string; value: string | number }) {
    return (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <p className="text-sm text-slate-500">{title}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
        </div>
    );
}

export default function PropertiesPage() {
    const [properties, setProperties] = useState<PropertyItem[]>([]);
    const [form, setForm] = useState<PropertyForm>(emptyForm);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [search, setSearch] = useState("");
    const [formError, setFormError] = useState("");
    const [sectorFilter, setSectorFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [saving, setSaving] = useState(false);
    const [propertyToDelete, setPropertyToDelete] = useState<PropertyItem | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [scoreLoadingId, setScoreLoadingId] = useState<number | null>(null);
    const [portfolioScoreLoading, setPortfolioScoreLoading] = useState(false);
    const [showLocationPicker, setShowLocationPicker] = useState(false);
    const [locationSelected, setLocationSelected] = useState(false);
    const [locationMustBeReselected, setLocationMustBeReselected] = useState(false);
    const [locationMessage, setLocationMessage] = useState("");
    const [showExportFilters, setShowExportFilters] = useState(false);
    const [exportFilters, setExportFilters] = useState<ExportFilters>(emptyExportFilters);
    const [exporting, setExporting] = useState(false);
    const [openExportDropdown, setOpenExportDropdown] = useState<"sectors" | "types" | "market" | "statuses" | null>(null);
    const [currentUser, setCurrentUser] = useState<GeoEstateUser | null>(null);
    const surfaceSliderRef = useRef<HTMLDivElement | null>(null);
    const priceSliderRef = useRef<HTMLDivElement | null>(null);
    const rentSliderRef = useRef<HTMLDivElement | null>(null);
    const canCreate = canCreateProperty(currentUser);
    const canEdit = canEditProperty(currentUser);
    const canDelete = canDeleteProperty(currentUser);
    const canExport = canExportReports(currentUser);
    const canUseRowActions = canEdit || canDelete;

    async function loadProperties() {
        try {
            const data = await apiGet<PropertyItem[]>("/properties");
            setProperties(data);
            setError("");
        } catch {
            setError("Nu se pot incarca proprietatile. Verifica daca backend-ul FastAPI ruleaza.");
        }
    }

    useEffect(() => {
        setCurrentUser(getCurrentUser());
        loadProperties();
    }, []);

    const filteredProperties = useMemo(() => {
        return properties.filter((property) => {
            const text = `${property.title} ${property.address} ${property.code}`.toLowerCase();
            const matchesSearch = text.includes(search.toLowerCase());
            const matchesSector =
                sectorFilter === "all" || property.sector_id === Number(sectorFilter);
            const matchesStatus =
                statusFilter === "all" || property.status === statusFilter;

            return matchesSearch && matchesSector && matchesStatus;
        });
    }, [properties, search, sectorFilter, statusFilter]);

    const totalValue = useMemo(() => {
        return filteredProperties.reduce((sum, property) => sum + property.price, 0);
    }, [filteredProperties]);

    const averagePriceSqm = useMemo(() => {
        if (filteredProperties.length === 0) {
            return 0;
        }

        const total = filteredProperties.reduce((sum, property) => {
            return sum + property.price / property.surface_sqm;
        }, 0);

        return total / filteredProperties.length;
    }, [filteredProperties]);

    const surfaceBounds = useMemo(() => {
        if (properties.length === 0) {
            return {
                min: 0,
                max: 300,
            };
        }

        const surfaces = properties.map((property) => property.surface_sqm);

        return {
            min: Math.floor(Math.min(...surfaces)),
            max: Math.ceil(Math.max(...surfaces)),
        };
    }, [properties]);
    const selectedSurfaceMin = exportFilters.surface_min ? Number(exportFilters.surface_min) : surfaceBounds.min;
    const selectedSurfaceMax = exportFilters.surface_max ? Number(exportFilters.surface_max) : surfaceBounds.max;
    const surfaceRangeSpan = Math.max(surfaceBounds.max - surfaceBounds.min, 1);
    const surfaceRangeLeft = ((selectedSurfaceMin - surfaceBounds.min) / surfaceRangeSpan) * 100;
    const surfaceRangeRight = 100 - ((selectedSurfaceMax - surfaceBounds.min) / surfaceRangeSpan) * 100;

    const priceBounds = useMemo(() => {
        if (properties.length === 0) {
            return {
                min: 0,
                max: 1000000,
            };
        }

        const prices = properties.map((property) => property.price);

        return {
            min: Math.floor(Math.min(...prices)),
            max: Math.ceil(Math.max(...prices)),
        };
    }, [properties]);
    const selectedPriceMin = exportFilters.price_min ? Number(exportFilters.price_min) : priceBounds.min;
    const selectedPriceMax = exportFilters.price_max ? Number(exportFilters.price_max) : priceBounds.max;
    const priceRangeSpan = Math.max(priceBounds.max - priceBounds.min, 1);
    const priceRangeLeft = ((selectedPriceMin - priceBounds.min) / priceRangeSpan) * 100;
    const priceRangeRight = 100 - ((selectedPriceMax - priceBounds.min) / priceRangeSpan) * 100;
    const rentBounds = useMemo(() => {
        if (properties.length === 0) {
            return {
                min: 0,
                max: 10000,
            };
        }

        const rents = properties.map((property) => property.monthly_rent);

        return {
            min: Math.floor(Math.min(...rents)),
            max: Math.ceil(Math.max(...rents)),
        };
    }, [properties]);
    const selectedRentMin = exportFilters.rent_min ? Number(exportFilters.rent_min) : rentBounds.min;
    const selectedRentMax = exportFilters.rent_max ? Number(exportFilters.rent_max) : rentBounds.max;
    const rentRangeSpan = Math.max(rentBounds.max - rentBounds.min, 1);
    const rentRangeLeft = ((selectedRentMin - rentBounds.min) / rentRangeSpan) * 100;
    const rentRangeRight = 100 - ((selectedRentMax - rentBounds.min) / rentRangeSpan) * 100;

    function updateField(field: keyof PropertyForm, value: string) {
        if (field === "sector_id") {
            const nextSectorId = Number(value);

            if (locationSelected && nextSectorId !== form.sector_id) {
                setLocationSelected(false);
                setLocationMustBeReselected(true);
                setLocationMessage("Sectorul a fost schimbat. Selecteaza din nou locatia de pe harta.");
                setForm((prev) => ({
                    ...prev,
                    sector_id: nextSectorId,
                    latitude: 0,
                    longitude: 0,
                }));
                return;
            }
        }

        setForm((prev) => ({
            ...prev,
            [field]:
                field === "title" || field === "address" || field === "status"
                    ? value
                    : Number(value),
        }));
    }

    function handleLocationSelect(latitude: number, longitude: number) {
        const roundedLatitude = Number(latitude.toFixed(6));
        const roundedLongitude = Number(longitude.toFixed(6));
        const detectedSector = detectBucharestSector(roundedLatitude, roundedLongitude);

        setForm((prev) => ({
            ...prev,
            latitude: roundedLatitude,
            longitude: roundedLongitude,
            sector_id: detectedSector ?? prev.sector_id,
            address:
                prev.address.trim() ||
                "Locatie selectata pe harta, Bucuresti",
        }));
        setLocationSelected(true);
        setLocationMustBeReselected(false);
        setFormError("");
        setLocationMessage(
            detectedSector
                ? `Sectorul a fost detectat automat: Sector ${detectedSector}.`
                : "Locatia selectata nu a putut fi incadrata intr-un sector. Selecteaza un punct din Bucuresti."
        );
    }

    function startAdd() {
        if (!canCreate) {
            return;
        }

        setForm(emptyForm);
        setEditingId(null);
        setShowForm(true);
        setError("");
        setFormError("");
        setLocationSelected(false);
        setLocationMustBeReselected(false);
        setLocationMessage("");
    }

    function startEdit(property: PropertyItem) {
        if (!canEdit) {
            return;
        }

        setForm({
            title: property.title,
            address: property.address,
            sector_id: property.sector_id,
            property_type_id: property.property_type_id,
            latitude: property.latitude,
            longitude: property.longitude,
            surface_sqm: property.surface_sqm,
            price: property.price,
            monthly_rent: property.monthly_rent,
            status: property.status,
        });

        setEditingId(property.id);
        setShowForm(true);
        setError("");
        setFormError("");
        setLocationSelected(true);
        setLocationMustBeReselected(false);
        setLocationMessage("");
    }

    function validateForm() {
        if (!form.title.trim()) {
            return "Titlul proprietatii este obligatoriu.";
        }

        if (form.title.trim().length < 3) {
            return "Titlul proprietatii trebuie sa aiba minimum 3 caractere.";
        }

        if (!form.address.trim()) {
            return "Adresa proprietatii este obligatorie. Completeaza adresa sau selecteaza locatia de pe harta.";
        }

        if (form.sector_id < 1 || form.sector_id > 6) {
            return "Sectorul trebuie sa fie intre 1 si 6.";
        }

        if (!locationSelected) {
            return "Selecteaza locatia pe harta pentru sectorul ales.";
        }

        if (locationMustBeReselected) {
            return "Selecteaza locatia pe harta pentru sectorul ales.";
        }

        const detectedSector = detectBucharestSector(form.latitude, form.longitude);

        if (!detectedSector || detectedSector !== form.sector_id) {
            return "Locatia selectata nu corespunde sectorului ales. Selecteaza din nou locatia pe harta.";
        }

        if (form.property_type_id < 1) {
            return "Tipul proprietatii este obligatoriu.";
        }

        if (form.surface_sqm <= 0) {
            return "Suprafata trebuie sa fie mai mare decat 0 mp.";
        }

        if (form.surface_sqm < 10) {
            return "Suprafata pare prea mica. Introdu o valoare de minimum 10 mp.";
        }

        if (form.price <= 0) {
            return "Pretul trebuie sa fie mai mare decat 0 EUR.";
        }

        if (form.price < 1000) {
            return "Pretul pare prea mic. Introdu o valoare realista pentru piata imobiliara.";
        }

        if (form.monthly_rent < 0) {
            return "Chiria lunara nu poate fi negativa.";
        }

        if (form.latitude < -90 || form.latitude > 90) {
            return "Locatia selectata nu are o latitudine valida.";
        }

        if (form.longitude < -180 || form.longitude > 180) {
            return "Locatia selectata nu are o longitudine valida.";
        }

        if (form.latitude < 44.2 || form.latitude > 44.6 || form.longitude < 25.8 || form.longitude > 26.4) {
            return "Locatia selectata pare in afara Bucurestiului. Alege o locatie din zona Bucuresti.";
        }

        const validStatuses = ["available", "rented", "occupied", "sold", "inactive"];

        if (!validStatuses.includes(form.status)) {
            return "Statusul proprietatii nu este valid.";
        }

        return "";
    }

    async function saveProperty() {
        const validationError = validateForm();

        if (validationError) {
            setFormError(validationError);
            return;
        }

        try {
            setSaving(true);
            setFormError("");

            if (editingId) {
                await apiRequest(`/properties/${editingId}`, {
                    method: "PUT",
                    body: JSON.stringify(form),
                });
            } else {
                await apiRequest("/properties", {
                    method: "POST",
                    body: JSON.stringify(form),
                });
            }

            setShowForm(false);
            setEditingId(null);
            setForm(emptyForm);
            setError("");
            setFormError("");
            setLocationSelected(false);
            setLocationMustBeReselected(false);
            setLocationMessage("");
            await loadProperties();
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "A aparut o eroare la salvarea proprietatii.";

            setFormError(message);
        } finally {
            setSaving(false);
        }
    }

    function requestDeleteProperty(property: PropertyItem) {
        if (!canDelete) {
            return;
        }

        setPropertyToDelete(property);
    }

    async function confirmDeleteProperty() {
        if (!propertyToDelete || !canDelete) {
            return;
        }

        try {
            setDeleteLoading(true);
            setError("");

            const response = await fetch(`http://127.0.0.1:8000/properties/${propertyToDelete.id}`, {
                method: "DELETE",
                headers: getAuthHeaders(),
            });

            if (!response.ok) {
                throw new Error("Delete failed");
            }

            setPropertyToDelete(null);
            await loadProperties();
        } catch {
            setError("Proprietatea nu a putut fi stearsa.");
        } finally {
            setDeleteLoading(false);
        }
    }

    async function recalculateLocationScores(property: PropertyItem) {
        if (!canEdit) {
            return;
        }

        try {
            setScoreLoadingId(property.id);
            setError("");

            const updatedProperty = await apiRequest<PropertyItem>(
                `/properties/${property.id}/recalculate-location-score`,
                {
                    method: "POST",
                }
            );

            setProperties((current) =>
                current.map((item) =>
                    item.id === updatedProperty.id ? updatedProperty : item
                )
            );
        } catch {
            setError("Scorurile locatiei nu au putut fi recalculate momentan.");
        } finally {
            setScoreLoadingId(null);
        }
    }

    async function recalculatePortfolioLocationScores() {
        if (!canEdit) {
            return;
        }

        try {
            setPortfolioScoreLoading(true);
            setError("");
            setNotice("Se recalculeaza scorurile. Operatia poate dura cateva secunde.");

            const result = await apiRequest<{
                processed: number;
                updated: number;
                skipped: number;
                failed: number;
                errors?: Array<{ property_id: number; title: string; error: string }>;
                message: string;
            }>("/properties/recalculate-location-scores", {
                method: "POST",
            });

            if (result.updated > 0) {
                await loadProperties();
            }

            if (result.failed > 0 && result.updated > 0) {
                setNotice("Scorurile au fost recalculate partial. Unele proprietati nu au putut fi actualizate.");
            } else if (result.failed > 0 && result.updated === 0) {
                setNotice("");
                setError("Nu s-a putut face conexiunea la serviciul Overpass. Incearca mai tarziu.");
            } else {
                setNotice(
                    `${result.message} Actualizate: ${result.updated}, sarite: ${result.skipped}, esuate: ${result.failed}.`
                );
            }
        } catch {
            setNotice("");
            setError("Scorurile portofoliului nu au putut fi recalculate momentan.");
        } finally {
            setPortfolioScoreLoading(false);
        }
    }

    function updateExportFilter(field: keyof ExportFilters, value: string) {
        setExportFilters((prev) => ({
            ...prev,
            [field]: value,
        }));
    }

    function toggleExportFilterValue(field: "sector_ids" | "property_type_ids" | "market_labels" | "statuses", value: string) {
        setExportFilters((prev) => {
            const currentValues = prev[field];

            if (currentValues.includes(value) && currentValues.length === 1) {
                return prev;
            }

            const nextValues = currentValues.includes(value)
                ? currentValues.filter((item) => item !== value)
                : [...currentValues, value];

            return {
                ...prev,
                [field]: nextValues,
            };
        });
    }

    function selectAllExportFilterValues(field: "sector_ids" | "property_type_ids" | "market_labels" | "statuses", options: MultiSelectOption[]) {
        setExportFilters((prev) => ({
            ...prev,
            [field]: options.map((option) => option.id),
        }));
    }

    function updateExportSurfaceMin(value: string) {
        const numericValue = Number(value);

        if (value === "") {
            updateExportFilter("surface_min", "");
            return;
        }

        const clampedValue = Math.min(
            Math.max(numericValue, surfaceBounds.min),
            selectedSurfaceMax,
        );
        updateExportFilter("surface_min", String(clampedValue));
    }

    function updateExportSurfaceMax(value: string) {
        const numericValue = Number(value);

        if (value === "") {
            updateExportFilter("surface_max", "");
            return;
        }

        const clampedValue = Math.max(
            Math.min(numericValue, surfaceBounds.max),
            selectedSurfaceMin,
        );
        updateExportFilter("surface_max", String(clampedValue));
    }

    function getSurfaceFromPointer(clientX: number) {
        const slider = surfaceSliderRef.current;

        if (!slider) {
            return surfaceBounds.min;
        }

        const rect = slider.getBoundingClientRect();
        const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
        const rawValue = surfaceBounds.min + ratio * surfaceRangeSpan;

        return Math.round(rawValue);
    }

    function dragSurfaceMin(clientX: number) {
        const nextValue = Math.min(getSurfaceFromPointer(clientX), selectedSurfaceMax);
        updateExportFilter("surface_min", String(nextValue));
    }

    function dragSurfaceMax(clientX: number) {
        const nextValue = Math.max(getSurfaceFromPointer(clientX), selectedSurfaceMin);
        updateExportFilter("surface_max", String(nextValue));
    }

    function updateExportPriceMin(value: string) {
        const numericValue = Number(value);

        if (value === "") {
            updateExportFilter("price_min", "");
            return;
        }

        const clampedValue = Math.min(
            Math.max(numericValue, priceBounds.min),
            selectedPriceMax,
        );
        updateExportFilter("price_min", String(clampedValue));
    }

    function updateExportPriceMax(value: string) {
        const numericValue = Number(value);

        if (value === "") {
            updateExportFilter("price_max", "");
            return;
        }

        const clampedValue = Math.max(
            Math.min(numericValue, priceBounds.max),
            selectedPriceMin,
        );
        updateExportFilter("price_max", String(clampedValue));
    }

    function getPriceFromPointer(clientX: number) {
        const slider = priceSliderRef.current;

        if (!slider) {
            return priceBounds.min;
        }

        const rect = slider.getBoundingClientRect();
        const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
        const rawValue = priceBounds.min + ratio * priceRangeSpan;

        return Math.round(rawValue / 1000) * 1000;
    }

    function dragPriceMin(clientX: number) {
        const nextValue = Math.min(getPriceFromPointer(clientX), selectedPriceMax);
        updateExportFilter("price_min", String(nextValue));
    }

    function dragPriceMax(clientX: number) {
        const nextValue = Math.max(getPriceFromPointer(clientX), selectedPriceMin);
        updateExportFilter("price_max", String(nextValue));
    }

    function updateExportRentMin(value: string) {
        const numericValue = Number(value);

        if (value === "") {
            updateExportFilter("rent_min", "");
            return;
        }

        const clampedValue = Math.min(
            Math.max(numericValue, rentBounds.min),
            selectedRentMax,
        );
        updateExportFilter("rent_min", String(clampedValue));
    }

    function updateExportRentMax(value: string) {
        const numericValue = Number(value);

        if (value === "") {
            updateExportFilter("rent_max", "");
            return;
        }

        const clampedValue = Math.max(
            Math.min(numericValue, rentBounds.max),
            selectedRentMin,
        );
        updateExportFilter("rent_max", String(clampedValue));
    }

    function getRentFromPointer(clientX: number) {
        const slider = rentSliderRef.current;

        if (!slider) {
            return rentBounds.min;
        }

        const rect = slider.getBoundingClientRect();
        const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
        const rawValue = rentBounds.min + ratio * rentRangeSpan;

        return Math.round(rawValue / 50) * 50;
    }

    function dragRentMin(clientX: number) {
        const nextValue = Math.min(getRentFromPointer(clientX), selectedRentMax);
        updateExportFilter("rent_min", String(nextValue));
    }

    function dragRentMax(clientX: number) {
        const nextValue = Math.max(getRentFromPointer(clientX), selectedRentMin);
        updateExportFilter("rent_max", String(nextValue));
    }

    function buildExportQuery() {
        const params = new URLSearchParams();

        Object.entries(exportFilters).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                value.forEach((item) => params.append(key, item));
                return;
            }

            if (value && value !== "all") {
                params.set(key, value);
            }
        });

        return params.toString();
    }

    async function exportExcel() {
        if (!canExport) {
            return;
        }

        try {
            setExporting(true);
            const query = buildExportQuery();
            const path = query
                ? `http://127.0.0.1:8000/reports/properties/excel?${query}`
                : "http://127.0.0.1:8000/reports/properties/excel";
            const response = await fetch(path, {
                headers: getAuthHeaders(),
            });

            if (!response.ok) {
                throw new Error("Raportul Excel nu a putut fi generat.");
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "raport_proprietati_geoestate.xlsx";
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            setShowExportFilters(false);
            setError("");
        } catch {
            setError("Raportul Excel nu a putut fi descarcat. Verifica daca backend-ul FastAPI ruleaza.");
        } finally {
            setExporting(false);
        }
    }

    return (
        <section className="space-y-6">
            <div className="rounded-3xl bg-slate-900 p-8 text-white shadow-sm">
                <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
                    <div>
                        <p className="text-sm font-medium uppercase tracking-wide text-slate-300">
                            Modul administrare
                        </p>
                        <h2 className="mt-2 text-3xl font-bold">Proprietati Bucuresti</h2>
                        <p className="mt-2 max-w-2xl text-slate-300">
                            Gestioneaza proprietatile analizate in aplicatia GIS, filtreaza datele si actualizeaza
                            informatiile economice.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                        {canEdit && (
                            <button
                                type="button"
                                onClick={recalculatePortfolioLocationScores}
                                disabled={portfolioScoreLoading}
                                className="rounded-2xl border border-white/25 px-5 py-3 font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {portfolioScoreLoading
                                    ? "Se recalculeaza..."
                                    : "Recalculeaza scorurile pentru toate proprietatile"}
                            </button>
                        )}

                        {canExport && (
                            <button
                                onClick={() => setShowExportFilters(true)}
                                className="rounded-2xl border border-white/25 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
                            >
                                Export Excel
                            </button>
                        )}

                        {canCreate && (
                            <button
                                onClick={startAdd}
                                className="rounded-2xl bg-white px-5 py-3 font-semibold text-slate-900 transition hover:bg-slate-100"
                            >
                                Adauga proprietate
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {error && (
                <div className="rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700 ring-1 ring-red-200">
                    {error}
                </div>
            )}

            {notice && (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-700 ring-1 ring-slate-200">
                    {notice}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <SummaryCard title="Proprietati afisate" value={filteredProperties.length}/>
                <SummaryCard title="Valoare totala" value={`${totalValue.toLocaleString()} EUR`}/>
                <SummaryCard title="Pret mediu/mp" value={`${averagePriceSqm.toFixed(2)} EUR`}/>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <input
                        className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                        placeholder="Cauta dupa titlu, adresa sau cod"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />

                    <select
                        className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                        value={sectorFilter}
                        onChange={(event) => setSectorFilter(event.target.value)}
                    >
                        <option value="all">Toate sectoarele</option>
                        <option value="1">Sector 1</option>
                        <option value="2">Sector 2</option>
                        <option value="3">Sector 3</option>
                        <option value="4">Sector 4</option>
                        <option value="5">Sector 5</option>
                        <option value="6">Sector 6</option>
                    </select>

                    <select
                        className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                    >
                        <option value="all">Toate statusurile</option>
                        <option value="available">Disponibila</option>
                        <option value="rented">Inchiriata</option>
                        <option value="occupied">Ocupata</option>
                        <option value="sold">Vanduta</option>
                        <option value="inactive">Inactiva</option>
                    </select>

                    <button
                        onClick={() => {
                            setSearch("");
                            setSectorFilter("all");
                            setStatusFilter("all");
                        }}
                        className="rounded-xl border border-slate-200 px-4 py-3 font-medium hover:bg-slate-50"
                    >
                        Reseteaza filtre
                    </button>
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
                <table className="w-full border-collapse text-left">
                    <thead className="bg-slate-50 text-sm text-slate-600">
                    <tr>
                        <th className="p-4">Proprietate</th>
                        <th className="p-4">Sector</th>
                        <th className="p-4">Suprafata</th>
                        <th className="p-4">Pret</th>
                        <th className="p-4">Pret/mp</th>
                        <th className="p-4">Piata</th>
                        <th className="p-4">Scoruri GIS</th>
                        <th className="p-4">Chirie</th>
                        <th className="p-4">Status</th>
                        {canUseRowActions && <th className="p-4 text-right">Actiuni</th>}
                    </tr>
                    </thead>

                    <tbody>
                    {filteredProperties.map((property) => (
                        <tr key={property.id} className="border-t border-slate-100 hover:bg-slate-50">
                            <td className="p-4">
                                <div className="font-semibold text-slate-900">{property.title}</div>
                                <div className="mt-1 text-sm text-slate-500">{property.address}</div>
                                <div className="mt-1 text-xs text-slate-400">{property.code}</div>
                            </td>
                            <td className="p-4">{property.sector_name ?? `Sector ${property.sector_id}`}</td>
                            <td className="p-4">{property.surface_sqm} mp</td>
                            <td className="p-4 font-medium">{property.price.toLocaleString()} EUR</td>
                            <td className="p-4">{property.price_sqm.toFixed(2)} EUR</td>
                            <td className="p-4">
                                <div className="flex flex-col items-start gap-1">
                                    <MarketBadge label={property.market_label}/>
                                    {property.market_difference_percent !== null && (
                                        <span className="text-xs text-slate-500">
                                            {property.market_difference_percent > 0 ? "+" : ""}
                                            {property.market_difference_percent.toFixed(2)}% fata de sector
                                        </span>
                                    )}
                                </div>
                            </td>
                            <td className="w-72 p-4 align-top">
                                <LocationScoresSummary property={property}/>
                                {canEdit && (
                                    <button
                                        type="button"
                                        onClick={() => recalculateLocationScores(property)}
                                        disabled={scoreLoadingId === property.id}
                                        className="mt-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {scoreLoadingId === property.id
                                            ? "Se recalculeaza..."
                                            : "Recalculeaza scorurile locatiei"}
                                    </button>
                                )}
                            </td>
                            <td className="p-4">{property.monthly_rent.toLocaleString()} EUR</td>
                            <td className="p-4">
                                <StatusBadge status={property.status}/>
                            </td>
                            {canUseRowActions && (
                                <td className="p-4">
                                    <div className="flex justify-end gap-2">
                                        {canEdit && (
                                            <button
                                                onClick={() => startEdit(property)}
                                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-white"
                                            >
                                                Editeaza
                                            </button>
                                        )}

                                        {canDelete && (
                                            <button
                                                onClick={() => requestDeleteProperty(property)}
                                                className="rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                                            >
                                                Sterge
                                            </button>
                                        )}
                                    </div>
                                </td>
                            )}
                        </tr>
                    ))}

                    {filteredProperties.length === 0 && (
                        <tr>
                            <td colSpan={canUseRowActions ? 9 : 8} className="p-8 text-center text-slate-500">
                                Nu exista proprietati pentru filtrele selectate.
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>

            {showExportFilters && canExport && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
                    <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[28px] bg-white shadow-2xl shadow-slate-950/30 ring-1 ring-white/60">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/80 px-7 py-6">
                            <div className="flex items-start gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/20">
                                    <SlidersHorizontal className="h-6 w-6"/>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-950">
                                        Date de intrare pentru export Excel
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Configureaza criteriile raportului. Campurile necompletate raman fara limita.
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => setShowExportFilters(false)}
                                className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-slate-400 transition hover:bg-white hover:text-slate-900"
                            >
                                ×
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-5 px-7 py-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <FieldLabel>Titlu proprietate</FieldLabel>
                                <input
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                                    placeholder='Ex: *Domenii*'
                                    value={exportFilters.title_query}
                                    onChange={(event) => updateExportFilter("title_query", event.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <FieldLabel>Adresa</FieldLabel>
                                <input
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                                    placeholder='Ex: *Victoriei*'
                                    value={exportFilters.address_query}
                                    onChange={(event) => updateExportFilter("address_query", event.target.value)}
                                />
                            </div>

                            <div className="space-y-3">
                                <FieldLabel>Sector</FieldLabel>
                                <PrettyMultiSelectDropdown
                                    allLabel="Toate sectoarele"
                                    isOpen={openExportDropdown === "sectors"}
                                    onToggle={() => setOpenExportDropdown((prev) => prev === "sectors" ? null : "sectors")}
                                    onToggleOption={(id) => toggleExportFilterValue("sector_ids", id)}
                                    onSelectAll={() => selectAllExportFilterValues("sector_ids", exportSectorOptions)}
                                    options={exportSectorOptions}
                                    selectedIds={exportFilters.sector_ids}
                                />
                            </div>

                            <div className="space-y-3">
                                <FieldLabel>Tip proprietate</FieldLabel>
                                <PrettyMultiSelectDropdown
                                    allLabel="Toate tipurile"
                                    isOpen={openExportDropdown === "types"}
                                    onToggle={() => setOpenExportDropdown((prev) => prev === "types" ? null : "types")}
                                    onToggleOption={(id) => toggleExportFilterValue("property_type_ids", id)}
                                    onSelectAll={() => selectAllExportFilterValues("property_type_ids", exportPropertyTypeOptions)}
                                    options={exportPropertyTypeOptions}
                                    selectedIds={exportFilters.property_type_ids}
                                />
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <FieldLabel>Suprafata mp</FieldLabel>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <input
                                        className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                                        max={selectedSurfaceMax}
                                        min={surfaceBounds.min}
                                        placeholder="Suprafata minima"
                                        type="number"
                                        value={exportFilters.surface_min}
                                        onChange={(event) => updateExportSurfaceMin(event.target.value)}
                                    />

                                    <input
                                        className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                                        max={surfaceBounds.max}
                                        min={selectedSurfaceMin}
                                        placeholder="Suprafata maxima"
                                        type="number"
                                        value={exportFilters.surface_max}
                                        onChange={(event) => updateExportSurfaceMax(event.target.value)}
                                    />
                                </div>

                                <div className="pt-3">
                                    <div ref={surfaceSliderRef} className="relative h-8">
                                        <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-200"/>
                                        <div
                                            className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-900"
                                            style={{
                                                left: `${surfaceRangeLeft}%`,
                                                right: `${surfaceRangeRight}%`,
                                            }}
                                        />
                                        <button
                                            aria-label="Suprafata minima export"
                                            className="absolute top-1/2 z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-[3px] border-white bg-slate-900 shadow-lg active:cursor-grabbing"
                                            onPointerDown={(event) => {
                                                event.currentTarget.setPointerCapture(event.pointerId);
                                                dragSurfaceMin(event.clientX);
                                            }}
                                            onPointerMove={(event) => {
                                                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                                                    dragSurfaceMin(event.clientX);
                                                }
                                            }}
                                            style={{left: `${surfaceRangeLeft}%`}}
                                            type="button"
                                        />
                                        <button
                                            aria-label="Suprafata maxima export"
                                            className="absolute top-1/2 z-30 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-[3px] border-white bg-slate-900 shadow-lg active:cursor-grabbing"
                                            onPointerDown={(event) => {
                                                event.currentTarget.setPointerCapture(event.pointerId);
                                                dragSurfaceMax(event.clientX);
                                            }}
                                            onPointerMove={(event) => {
                                                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                                                    dragSurfaceMax(event.clientX);
                                                }
                                            }}
                                            style={{left: `${100 - surfaceRangeRight}%`}}
                                            type="button"
                                        />
                                    </div>

                                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                                        <span>{surfaceBounds.min.toLocaleString()} mp</span>
                                        <span>{surfaceBounds.max.toLocaleString()} mp</span>
                                    </div>
                                </div>

                                <p className="text-xs text-slate-500">
                                    Poti trage capatul din stanga pentru suprafata minima, capatul din dreapta pentru suprafata maxima sau poti scrie valorile manual.
                                </p>
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <FieldLabel>Pret EUR</FieldLabel>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <input
                                        className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                                        max={selectedPriceMax}
                                        min={priceBounds.min}
                                        placeholder="Pret minim"
                                        type="number"
                                        value={exportFilters.price_min}
                                        onChange={(event) => updateExportPriceMin(event.target.value)}
                                    />

                                    <input
                                        className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                                        max={priceBounds.max}
                                        min={selectedPriceMin}
                                        placeholder="Pret maxim"
                                        type="number"
                                        value={exportFilters.price_max}
                                        onChange={(event) => updateExportPriceMax(event.target.value)}
                                    />
                                </div>

                                <div className="pt-3">
                                    <div ref={priceSliderRef} className="relative h-8">
                                        <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-200"/>
                                        <div
                                            className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-900"
                                            style={{
                                                left: `${priceRangeLeft}%`,
                                                right: `${priceRangeRight}%`,
                                            }}
                                        />
                                        <button
                                            aria-label="Pret minim export"
                                            className="absolute top-1/2 z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-[3px] border-white bg-slate-900 shadow-lg active:cursor-grabbing"
                                            onPointerDown={(event) => {
                                                event.currentTarget.setPointerCapture(event.pointerId);
                                                dragPriceMin(event.clientX);
                                            }}
                                            onPointerMove={(event) => {
                                                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                                                    dragPriceMin(event.clientX);
                                                }
                                            }}
                                            style={{left: `${priceRangeLeft}%`}}
                                            type="button"
                                        />
                                        <button
                                            aria-label="Pret maxim export"
                                            className="absolute top-1/2 z-30 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-[3px] border-white bg-slate-900 shadow-lg active:cursor-grabbing"
                                            onPointerDown={(event) => {
                                                event.currentTarget.setPointerCapture(event.pointerId);
                                                dragPriceMax(event.clientX);
                                            }}
                                            onPointerMove={(event) => {
                                                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                                                    dragPriceMax(event.clientX);
                                                }
                                            }}
                                            style={{left: `${100 - priceRangeRight}%`}}
                                            type="button"
                                        />
                                    </div>

                                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                                        <span>{priceBounds.min.toLocaleString()} EUR</span>
                                        <span>{priceBounds.max.toLocaleString()} EUR</span>
                                    </div>
                                </div>

                                <p className="text-xs text-slate-500">
                                    Poti trage capatul din stanga pentru minim, capatul din dreapta pentru maxim sau poti scrie valorile manual.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <FieldLabel>Indicator piata</FieldLabel>
                                <PrettyMultiSelectDropdown
                                    allLabel="Toate clasificarile"
                                    isOpen={openExportDropdown === "market"}
                                    onToggle={() => setOpenExportDropdown((prev) => prev === "market" ? null : "market")}
                                    onToggleOption={(id) => toggleExportFilterValue("market_labels", id)}
                                    onSelectAll={() => selectAllExportFilterValues("market_labels", exportMarketOptions)}
                                    options={exportMarketOptions}
                                    selectedIds={exportFilters.market_labels}
                                />
                            </div>

                            <div className="space-y-3">
                                <FieldLabel>Status</FieldLabel>
                                <PrettyMultiSelectDropdown
                                    allLabel="Toate statusurile"
                                    isOpen={openExportDropdown === "statuses"}
                                    onToggle={() => setOpenExportDropdown((prev) => prev === "statuses" ? null : "statuses")}
                                    onToggleOption={(id) => toggleExportFilterValue("statuses", id)}
                                    onSelectAll={() => selectAllExportFilterValues("statuses", exportStatusOptions)}
                                    options={exportStatusOptions}
                                    selectedIds={exportFilters.statuses}
                                />
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <FieldLabel>Chirie lunara EUR</FieldLabel>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <input
                                        className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                                        max={selectedRentMax}
                                        min={rentBounds.min}
                                        placeholder="Chirie minima"
                                        type="number"
                                        value={exportFilters.rent_min}
                                        onChange={(event) => updateExportRentMin(event.target.value)}
                                    />

                                    <input
                                        className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                                        max={rentBounds.max}
                                        min={selectedRentMin}
                                        placeholder="Chirie maxima"
                                        type="number"
                                        value={exportFilters.rent_max}
                                        onChange={(event) => updateExportRentMax(event.target.value)}
                                    />
                                </div>

                                <div className="pt-3">
                                    <div ref={rentSliderRef} className="relative h-8">
                                        <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-200"/>
                                        <div
                                            className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-900"
                                            style={{
                                                left: `${rentRangeLeft}%`,
                                                right: `${rentRangeRight}%`,
                                            }}
                                        />
                                        <button
                                            aria-label="Chirie minima export"
                                            className="absolute top-1/2 z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-[3px] border-white bg-slate-900 shadow-lg active:cursor-grabbing"
                                            onPointerDown={(event) => {
                                                event.currentTarget.setPointerCapture(event.pointerId);
                                                dragRentMin(event.clientX);
                                            }}
                                            onPointerMove={(event) => {
                                                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                                                    dragRentMin(event.clientX);
                                                }
                                            }}
                                            style={{left: `${rentRangeLeft}%`}}
                                            type="button"
                                        />
                                        <button
                                            aria-label="Chirie maxima export"
                                            className="absolute top-1/2 z-30 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-[3px] border-white bg-slate-900 shadow-lg active:cursor-grabbing"
                                            onPointerDown={(event) => {
                                                event.currentTarget.setPointerCapture(event.pointerId);
                                                dragRentMax(event.clientX);
                                            }}
                                            onPointerMove={(event) => {
                                                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                                                    dragRentMax(event.clientX);
                                                }
                                            }}
                                            style={{left: `${100 - rentRangeRight}%`}}
                                            type="button"
                                        />
                                    </div>

                                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                                        <span>{rentBounds.min.toLocaleString()} EUR</span>
                                        <span>{rentBounds.max.toLocaleString()} EUR</span>
                                    </div>
                                </div>

                                <p className="text-xs text-slate-500">
                                    Poti trage capatul din stanga pentru chiria minima, capatul din dreapta pentru chiria maxima sau poti scrie valorile manual.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col justify-end gap-3 border-t border-slate-100 bg-slate-50/70 px-7 py-5 sm:flex-row">
                            <button
                                onClick={() => setExportFilters(emptyExportFilters)}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                            >
                                <RotateCcw className="h-4 w-4"/>
                                Reseteaza filtre
                            </button>

                            <button
                                onClick={() => setShowExportFilters(false)}
                                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                            >
                                Anuleaza
                            </button>

                            <button
                                onClick={exportExcel}
                                disabled={exporting}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 disabled:opacity-60"
                            >
                                <Download className="h-4 w-4"/>
                                {exporting ? "Se exporta..." : "Descarca Excel"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showForm && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4">
                    <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900">
                                    {editingId ? "Editare proprietate" : "Adaugare proprietate"}
                                </h3>

                                <p className="mt-1 text-sm text-slate-500">
                                    Completeaza datele proprietatii. Coordonatele sunt folosite pentru afisarea pe harta
                                    GIS.
                                </p>

                                {formError && (
                                    <div
                                        className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
                                        <p className="font-semibold">Proprietatea nu a fost salvata.</p>
                                        <p className="mt-1">{formError}</p>
                                    </div>
                                )}

                                {locationMessage && !formError && (
                                    <div
                                        className={`mt-4 rounded-2xl p-4 text-sm ring-1 ${
                                            locationMustBeReselected
                                                ? "bg-amber-50 text-amber-700 ring-amber-200"
                                                : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                        }`}
                                    >
                                        {locationMessage}
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => setShowForm(false)}
                                className="rounded-full px-3 py-1 text-2xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                                ×
                            </button>
                        </div>

                        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <FieldLabel>Titlu proprietate</FieldLabel>
                                <input
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                                    placeholder="Ex: Apartament 2 camere Aviatiei"
                                    value={form.title}
                                    onChange={(e) => updateField("title", e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <FieldLabel>Adresa</FieldLabel>

                                <div className="flex gap-2">
                                    <input
                                        className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                                        placeholder="Ex: Strada Nicolae Caramfil sau selecteaza de pe harta"
                                        value={form.address}
                                        onChange={(e) => updateField("address", e.target.value)}
                                    />

                                    <button
                                        type="button"
                                        onClick={() => setShowLocationPicker(true)}
                                        className="whitespace-nowrap rounded-xl bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-800"
                                    >
                                        Harta
                                    </button>
                                </div>

                                {locationSelected ? (
                                    <p className="text-xs text-slate-500">
                                        Locatie selectata: {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
                                    </p>
                                ) : (
                                    <p className="text-xs text-amber-600">
                                        {locationMustBeReselected
                                            ? "Sectorul a fost schimbat. Selecteaza din nou locatia de pe harta."
                                            : "Nu ai selectat inca o locatie pe harta."}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <FieldLabel>Sector</FieldLabel>
                                <select
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                                    value={form.sector_id}
                                    onChange={(e) => updateField("sector_id", e.target.value)}
                                >
                                    <option value={1}>Sector 1</option>
                                    <option value={2}>Sector 2</option>
                                    <option value={3}>Sector 3</option>
                                    <option value={4}>Sector 4</option>
                                    <option value={5}>Sector 5</option>
                                    <option value={6}>Sector 6</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <FieldLabel>Tip proprietate</FieldLabel>
                                <select
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                                    value={form.property_type_id}
                                    onChange={(e) => updateField("property_type_id", e.target.value)}
                                >
                                    <option value={1}>Apartament</option>
                                    <option value={2}>Casa</option>
                                    <option value={3}>Spatiu comercial</option>
                                    <option value={4}>Birou</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <FieldLabel>Suprafata mp</FieldLabel>
                                <input
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                                    type="number"
                                    value={form.surface_sqm}
                                    onChange={(e) => updateField("surface_sqm", e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <FieldLabel>Pret EUR</FieldLabel>
                                <input
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                                    type="number"
                                    value={form.price}
                                    onChange={(e) => updateField("price", e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <FieldLabel>Chirie lunara EUR</FieldLabel>
                                <input
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                                    type="number"
                                    value={form.monthly_rent}
                                    onChange={(e) => updateField("monthly_rent", e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <FieldLabel>Status</FieldLabel>
                                <select
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                                    value={form.status}
                                    onChange={(e) => updateField("status", e.target.value)}
                                >
                                    <option value="available">Disponibila</option>
                                    <option value="rented">Inchiriata</option>
                                    <option value="occupied">Ocupata</option>
                                    <option value="sold">Vanduta</option>
                                    <option value="inactive">Inactiva</option>
                                </select>
                            </div>
                        </div>

                        <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                            Pret calculat pe metru patrat:{" "}
                            <strong className="text-slate-900">
                                {form.surface_sqm > 0 ? (form.price / form.surface_sqm).toFixed(2) : "0.00"} EUR/mp
                            </strong>
                        </div>

                        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                            <button
                                onClick={() => setShowForm(false)}
                                className="rounded-xl border border-slate-200 px-5 py-3 font-medium hover:bg-slate-50"
                            >
                                Anuleaza
                            </button>

                            <button
                                onClick={saveProperty}
                                disabled={saving}
                                className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                            >
                                {saving ? "Se salveaza..." : "Salveaza proprietatea"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showLocationPicker && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/70 p-4">
                    <div className="w-full max-w-5xl rounded-3xl bg-white p-6 shadow-2xl">
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900">
                                    Selectare locatie pe harta
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">
                                    Click pe harta Bucurestiului pentru a seta pozitia proprietatii.
                                </p>
                            </div>

                            <button
                                onClick={() => setShowLocationPicker(false)}
                                className="rounded-full px-3 py-1 text-2xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                                ×
                            </button>
                        </div>

                        <LocationPicker
                            latitude={form.latitude}
                            longitude={form.longitude}
                            onSelect={handleLocationSelect}
                        />

                        <div className="mt-5 flex items-center justify-between gap-4">
                            <div className="text-sm text-slate-600">
                                {locationSelected ? (
                                    <p>
                                        Coordonate selectate:{" "}
                                        <strong>
                                            {form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}
                                        </strong>
                                    </p>
                                ) : (
                                    <p className="font-medium text-amber-700">
                                        Selecteaza un punct pe harta pentru sectorul ales.
                                    </p>
                                )}
                                {locationMessage && (
                                    <p className="mt-1 text-xs text-slate-500">{locationMessage}</p>
                                )}
                            </div>

                            <button
                                onClick={() => setShowLocationPicker(false)}
                                className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800"
                            >
                                Foloseste locatia
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDeleteModal
                open={propertyToDelete !== null}
                message="Esti sigur ca vrei sa stergi proprietatea?"
                itemName={propertyToDelete?.title}
                loading={deleteLoading}
                onCancel={() => setPropertyToDelete(null)}
                onConfirm={confirmDeleteProperty}
            />
        </section>
    );
}
