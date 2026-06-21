"use client";

import {useEffect, useMemo, useState} from "react";
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    useMapEvents,
    useMap,
} from "react-leaflet";
import L from "leaflet";
import {apiGet, getAuthHeaders, PropertyItem} from "@/lib/api";
import {
    canAddPropertyFromMap,
    canDeleteProperty,
    canEditProperty,
    GeoEstateUser,
    getCurrentUser,
} from "@/lib/auth";
import {detectBucharestSector} from "@/lib/bucharestSectors";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import ScoreMapLayer from "@/components/map/ScoreMapLayer";
import {
    ColorMode,
    getMetricLabel,
    getPropertyScore,
    ScoreMetric,
} from "@/lib/scoreMap";

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

type PropertiesMapProps = {
    properties: PropertyItem[];
    onPropertyCreated?: () => void;
};

type ContextMenuState = {
    visible: boolean;
    x: number;
    y: number;
    lat: number;
    lng: number;
};

type GeocodingResult = {
    display_name: string;
    latitude: number;
    longitude: number;
    type?: string;
};

type MapLayer = "properties" | "scores";

type PortfolioScoreRecalculation = {
    processed: number;
    updated: number;
    skipped: number;
    failed: number;
    errors?: Array<{ property_id: number; title: string; error: string }>;
    message: string;
};

const defaultIcon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});

const marketIconColors: Record<PropertyItem["market_label"], string> = {
    sub_piata: "#16a34a",
    la_piata: "#f59e0b",
    peste_piata: "#dc2626",
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

function createMarketIcon(label: PropertyItem["market_label"]) {
    const color = marketIconColors[label] ?? marketIconColors.la_piata;

    return L.divIcon({
        className: "",
        html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:${color};border:3px solid white;box-shadow:0 8px 18px rgba(15,23,42,0.35);"></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        popupAnchor: [0, -10],
    });
}

function ScoreRow({label, value}: { label: string; value?: number | null }) {
    return (
        <div className="flex justify-between gap-3">
            <span>{label}</span>
            <strong>
                {value === null || value === undefined ? "-" : `${value.toFixed(2)} / 100`}
            </strong>
        </div>
    );
}

function PropertyLocationScores({property}: { property: PropertyItem }) {
    const hasScores = property.location_score !== null && property.location_score !== undefined;

    if (!hasScores) {
        return (
            <div className="rounded-lg bg-slate-50 p-2 text-xs text-slate-500">
                Scorurile de locatie nu au fost calculate.
            </div>
        );
    }

    return (
        <div className="space-y-1 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
            <ScoreRow label="Scor locatie" value={property.location_score}/>
            <ScoreRow label="Accesibilitate" value={property.accessibility_score}/>
            <ScoreRow label="Facilitati" value={property.facilities_score}/>
            <ScoreRow label="Investitional" value={property.investment_score}/>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-slate-200 pt-2 text-slate-500">
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

const emptyForm: PropertyForm = {
    title: "",
    address: "Locatie selectata pe harta, Bucuresti",
    sector_id: 1,
    property_type_id: 1,
    latitude: 44.4268,
    longitude: 26.1025,
    surface_sqm: 50,
    price: 100000,
    monthly_rent: 500,
    status: "available",
};

function MapRightClickHandler({
                                  onRightClick,
                                  onMapClick,
                              }: {
    onRightClick: (lat: number, lng: number, x: number, y: number) => void;
    onMapClick: () => void;
}) {
    useMapEvents({
        contextmenu(event) {
            const originalEvent = event.originalEvent as MouseEvent;

            onRightClick(
                event.latlng.lat,
                event.latlng.lng,
                originalEvent.clientX,
                originalEvent.clientY
            );
        },
        click() {
            onMapClick();
        },
    });

    return null;
}

function FlyToSearchLocation({
                                 location,
                             }: {
    location: GeocodingResult | null;
}) {
    const map = useMap();

    useEffect(() => {
        if (!location) {
            return;
        }

        map.flyTo([location.latitude, location.longitude], 16, {
            animate: true,
            duration: 0.8,
        });
    }, [location, map]);

    return null;
}

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

export default function PropertiesMap({
                                          properties,
                                          onPropertyCreated,
                                      }: PropertiesMapProps) {
    const [currentUser, setCurrentUser] = useState<GeoEstateUser | null>(null);
    const [displayProperties, setDisplayProperties] = useState<PropertyItem[]>(properties);
    const [showForm, setShowForm] = useState(false);
    const [editingProperty, setEditingProperty] = useState<PropertyItem | null>(null);
    const [propertyToDelete, setPropertyToDelete] = useState<PropertyItem | null>(null);
    const [form, setForm] = useState<PropertyForm>(emptyForm);
    const [formError, setFormError] = useState("");
    const [saving, setSaving] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [mapMessage, setMapMessage] = useState("");
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        visible: false,
        x: 0,
        y: 0,
        lat: 44.4268,
        lng: 26.1025,
    });
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
    const [selectedSearchLocation, setSelectedSearchLocation] = useState<GeocodingResult | null>(null);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState("");
    const [mapLayer, setMapLayer] = useState<MapLayer>("properties");
    const [scoreMetric, setScoreMetric] = useState<ScoreMetric>("location_score");
    const [scoreColorMode, setScoreColorMode] = useState<ColorMode>("relative");
    const [portfolioScoreLoading, setPortfolioScoreLoading] = useState(false);
    const [scoreLoadingId, setScoreLoadingId] = useState<number | null>(null);
    const canAddFromMap = canAddPropertyFromMap(currentUser);
    const canEditProperties = canEditProperty(currentUser);
    const canDeleteProperties = canDeleteProperty(currentUser);

    useEffect(() => {
        setCurrentUser(getCurrentUser());
    }, []);

    useEffect(() => {
        setDisplayProperties(properties);
    }, [properties]);

    const validScoreCount = useMemo(
        () =>
            displayProperties.filter((property) => getPropertyScore(property, scoreMetric) !== null).length,
        [displayProperties, scoreMetric],
    );
    const validScores = useMemo(
        () =>
            displayProperties
                .map((property) => getPropertyScore(property, scoreMetric))
                .filter((score): score is number => score !== null),
        [displayProperties, scoreMetric],
    );
    const scoresAreClose = validScores.length > 0 && Math.min(...validScores) === Math.max(...validScores);

    async function recalculatePortfolioLocationScores(force = false) {
        if (!canEditProperties) {
            setMapMessage("Nu ai permisiunea necesara pentru editarea proprietatilor.");
            return;
        }

        try {
            setPortfolioScoreLoading(true);
            setMapMessage("Se recalculeaza scorurile. Operatia poate dura cateva secunde.");

            const result = await apiRequest<PortfolioScoreRecalculation>(
                `/properties/recalculate-location-scores?force=${force}`,
                {
                    method: "POST",
                }
            );

            if (result.updated > 0) {
                const refreshedProperties = await apiGet<PropertyItem[]>("/properties");
                setDisplayProperties(refreshedProperties);
            }

            if (result.failed > 0 && result.updated > 0) {
                setMapMessage("Scorurile au fost recalculate partial. Unele proprietati nu au putut fi actualizate.");
            } else if (result.failed > 0 && result.updated === 0) {
                setMapMessage("Nu s-a putut face conexiunea la serviciul Overpass. Incearca mai tarziu.");
            } else {
                setMapMessage(
                    `${result.message} Actualizate: ${result.updated}, sarite: ${result.skipped}, esuate: ${result.failed}.`
                );
            }

            if (result.updated > 0 && onPropertyCreated) {
                onPropertyCreated();
            }
        } catch {
            setMapMessage("Scorurile portofoliului nu au putut fi recalculate momentan.");
        } finally {
            setPortfolioScoreLoading(false);
        }
    }

    function updateField(field: keyof PropertyForm, value: string) {
        setForm((prev) => ({
            ...prev,
            [field]:
                field === "title" || field === "address" || field === "status"
                    ? value
                    : Number(value),
        }));
    }

    function validateForm() {
        if (!form.title.trim()) {
            return "Titlul proprietatii este obligatoriu.";
        }

        if (!form.address.trim()) {
            return "Adresa proprietatii este obligatorie.";
        }

        if (form.surface_sqm < 10) {
            return "Suprafata trebuie sa fie de minimum 10 mp.";
        }

        if (form.price < 1000) {
            return "Pretul trebuie sa fie o valoare realista.";
        }

        if (form.latitude < 44.2 || form.latitude > 44.6 || form.longitude < 25.8 || form.longitude > 26.4) {
            return "Locatia selectata pare in afara Bucurestiului.";
        }

        return "";
    }

    function openContextMenu(lat: number, lng: number, x: number, y: number) {
        if (!canAddFromMap) {
            return;
        }

        setContextMenu({
            visible: true,
            x,
            y,
            lat,
            lng,
        });
    }

    function handleEditProperty(property: PropertyItem) {
        if (!canEditProperties) {
            setMapMessage("Nu ai permisiunea necesara pentru editarea proprietatilor.");
            return;
        }

        setEditingProperty(property);
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
        setFormError("");
        setMapMessage("");
        setShowForm(true);
    }

    function handleRequestDeleteProperty(property: PropertyItem) {
        if (!canDeleteProperties) {
            setMapMessage("Nu ai permisiunea necesara pentru stergerea proprietatilor.");
            return;
        }

        setPropertyToDelete(property);
        setMapMessage("");
    }

    function closePropertyForm() {
        setShowForm(false);
        setEditingProperty(null);
        setForm(emptyForm);
        setFormError("");
    }

    function openCreatePropertyForm(
        latitude: number,
        longitude: number,
        address: string,
        failureMessage = "Locatia gasita nu a putut fi incadrata intr-un sector. Selecteaza manual o locatie din Bucuresti."
    ) {
        if (!canAddFromMap) {
            return;
        }

        const detectedSector = detectBucharestSector(latitude, longitude);

        if (!detectedSector) {
            setFormError(failureMessage);
            setSearchError(failureMessage);
            setContextMenu((prev) => ({
                ...prev,
                visible: false,
            }));
            setShowForm(false);
            return;
        }

        setForm({
            ...emptyForm,
            sector_id: detectedSector,
            latitude: Number(latitude.toFixed(6)),
            longitude: Number(longitude.toFixed(6)),
            address,
        });

        setFormError("");
        setSearchError("");
        setEditingProperty(null);
        setMapMessage("");
        setShowForm(true);
        setContextMenu((prev) => ({
            ...prev,
            visible: false,
        }));
    }

    function openFormFromContextMenu() {
        openCreatePropertyForm(
            contextMenu.lat,
            contextMenu.lng,
            "Locatie selectata pe harta, Bucuresti",
            "Locatia selectata nu a putut fi incadrata intr-un sector. Selecteaza un punct din Bucuresti."
        );
    }

    function handleAddPropertyFromSearchLocation(location: GeocodingResult) {
        openCreatePropertyForm(
            location.latitude,
            location.longitude,
            location.display_name || "Locatie gasita in Bucuresti"
        );
    }

    async function handleLocationSearch() {
        const query = searchQuery.trim();

        if (query.length < 3) {
            setSearchError("Introdu cel putin 3 caractere.");
            return;
        }

        try {
            setSearchLoading(true);
            setSearchError("");

            const results = await apiGet<GeocodingResult[]>(
                `/geocoding/search?query=${encodeURIComponent(query)}`
            );

            setSearchResults(results);

            if (!results.length) {
                setSelectedSearchLocation(null);
                setSearchError("Nu am gasit locatia cautata in Bucuresti.");
                return;
            }

            setSelectedSearchLocation(results[0]);
        } catch {
            setSearchError("Nu se poate cauta locatia momentan.");
        } finally {
            setSearchLoading(false);
        }
    }

    function clearSearch() {
        setSearchQuery("");
        setSearchResults([]);
        setSelectedSearchLocation(null);
        setSearchError("");
    }

    async function saveProperty() {
        if (editingProperty ? !canEditProperties : !canAddFromMap) {
            return;
        }

        const validationError = validateForm();

        if (validationError) {
            setFormError(validationError);
            return;
        }

        try {
            setSaving(true);
            setFormError("");

            if (editingProperty) {
                const updatedProperty = await apiRequest<PropertyItem>(`/properties/${editingProperty.id}`, {
                    method: "PUT",
                    body: JSON.stringify(form),
                });

                setDisplayProperties((current) =>
                    current.map((item) =>
                        item.id === updatedProperty.id ? updatedProperty : item
                    )
                );
                setMapMessage("Proprietatea a fost actualizata.");
            } else {
                const createdProperty = await apiRequest<PropertyItem>("/properties", {
                    method: "POST",
                    body: JSON.stringify(form),
                });

                setDisplayProperties((current) => [...current, createdProperty]);
                setMapMessage("Proprietatea a fost adaugata.");
            }

            setShowForm(false);
            setEditingProperty(null);
            setForm(emptyForm);

            if (onPropertyCreated) {
                onPropertyCreated();
            }

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

    async function handleConfirmDeleteProperty() {
        if (!propertyToDelete) {
            return;
        }

        try {
            setDeleteLoading(true);
            setMapMessage("");

            await apiRequest(`/properties/${propertyToDelete.id}`, {
                method: "DELETE",
            });

            setDisplayProperties((current) =>
                current.filter((item) => item.id !== propertyToDelete.id)
            );
            setPropertyToDelete(null);
            setMapMessage("Proprietatea a fost stearsa.");

            if (onPropertyCreated) {
                onPropertyCreated();
            }

        } catch {
            setMapMessage("Proprietatea nu a putut fi stearsa.");
        } finally {
            setDeleteLoading(false);
        }
    }

    async function recalculateLocationScores(property: PropertyItem) {
        if (!canEditProperties) {
            setMapMessage("Nu ai permisiunea necesara pentru editarea proprietatilor.");
            return;
        }

        try {
            setScoreLoadingId(property.id);
            setMapMessage("");

            const updatedProperty = await apiRequest<PropertyItem>(
                `/properties/${property.id}/recalculate-location-score`,
                {
                    method: "POST",
                }
            );

            setDisplayProperties((current) =>
                current.map((item) =>
                    item.id === updatedProperty.id ? updatedProperty : item
                )
            );
            setMapMessage("Scorurile locatiei au fost recalculate.");

        } catch {
            setMapMessage("Scorurile locatiei nu au putut fi recalculate momentan.");
        } finally {
            setScoreLoadingId(null);
        }
    }

    return (
        <div className="relative flex min-h-0 flex-1 flex-col w-full">
            <div className="mb-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                {canAddFromMap
                    ? "Click dreapta pe harta pentru a adauga o proprietate noua in Bucuresti."
                    : "Acest profil are acces doar pentru vizualizarea hartii."}
            </div>

            {formError && !showForm && (
                <div className="mb-3 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
                    {formError}
                </div>
            )}

            {mapMessage && !showForm && (
                <div className="mb-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-200">
                    {mapMessage}
                </div>
            )}

            <div className="relative min-h-0 w-full flex-1">
                <div className="absolute left-4 top-4 z-[1000] w-[440px] max-w-[calc(100%-2rem)]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                        <div className="flex gap-2">
                            <input
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        handleLocationSearch();
                                    }
                                }}
                                placeholder="Cauta adresa sau zona in Bucuresti"
                                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />

                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={clearSearch}
                                    className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                                    aria-label="Sterge cautarea"
                                >
                                    X
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={handleLocationSearch}
                                disabled={searchLoading}
                                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {searchLoading ? "Caut..." : "Cauta"}
                            </button>
                        </div>

                        {searchError && (
                            <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                                {searchError}
                            </p>
                        )}

                        {searchResults.length > 1 && (
                            <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-slate-100 bg-white shadow-sm">
                                {searchResults.map((result, index) => (
                                    <button
                                        key={`${result.latitude}-${result.longitude}-${index}`}
                                        type="button"
                                        onClick={() => {
                                            setSelectedSearchLocation(result);
                                            setSearchError("");
                                        }}
                                        className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-sm transition last:border-b-0 hover:bg-slate-50 ${
                                            selectedSearchLocation === result
                                                ? "bg-blue-50 text-blue-900"
                                                : "text-slate-700"
                                        }`}
                                    >
                                        <span className="line-clamp-2">{result.display_name}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        <p className="mt-2 px-1 text-[11px] text-slate-400">
                            Cautare locatie prin OpenStreetMap Nominatim
                        </p>
                    </div>
                </div>

                <div className="absolute right-4 top-4 z-[1000] w-72 max-w-[calc(100%-2rem)] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                    <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Layer harta
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {(["properties", "scores"] as MapLayer[]).map((layer) => (
                                <button
                                    key={layer}
                                    type="button"
                                    onClick={() => setMapLayer(layer)}
                                    className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                                        mapLayer === layer
                                            ? "bg-slate-900 text-white"
                                            : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                                    }`}
                                >
                                    {layer === "properties" ? "Proprietati" : "Scoruri GIS"}
                                </button>
                            ))}
                        </div>
                    </div>

                    {mapLayer === "scores" && (
                        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Indicator
                            </label>
                            <select
                                value={scoreMetric}
                                onChange={(event) => setScoreMetric(event.target.value as ScoreMetric)}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
                            >
                                <option value="location_score">Scor locatie</option>
                                <option value="accessibility_score">Accesibilitate</option>
                                <option value="facilities_score">Facilitati</option>
                                <option value="investment_score">Investitional</option>
                            </select>

                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Mod culoare
                            </label>
                            <select
                                value={scoreColorMode}
                                onChange={(event) => setScoreColorMode(event.target.value as ColorMode)}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
                            >
                                <option value="relative">Relativ la portofoliu</option>
                                <option value="absolute">Absolut 0-100</option>
                            </select>

                            <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                                <p className="font-semibold text-slate-800">{getMetricLabel(scoreMetric)}</p>
                                {scoreColorMode === "absolute" ? (
                                    <div className="space-y-1">
                                        <p><span className="inline-block h-2 w-2 rounded-full bg-[#DC2626]"/> 0 - 40 Slab</p>
                                        <p><span className="inline-block h-2 w-2 rounded-full bg-[#F97316]"/> 40 - 60 Mediu</p>
                                        <p><span className="inline-block h-2 w-2 rounded-full bg-[#EAB308]"/> 60 - 75 Bun</p>
                                        <p><span className="inline-block h-2 w-2 rounded-full bg-[#22C55E]"/> 75 - 90 Foarte bun</p>
                                        <p><span className="inline-block h-2 w-2 rounded-full bg-[#15803D]"/> 90 - 100 Excelent</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <p><span className="inline-block h-2 w-2 rounded-full bg-[#DC2626]"/> Rosu = printre cele mai slabe din portofoliu</p>
                                        <p><span className="inline-block h-2 w-2 rounded-full bg-[#EAB308]"/> Galben = nivel mediu in portofoliu</p>
                                        <p><span className="inline-block h-2 w-2 rounded-full bg-[#15803D]"/> Verde = printre cele mai bune din portofoliu</p>
                                        {scoresAreClose && (
                                            <p className="rounded-lg bg-white p-2 text-slate-500">
                                                Toate proprietatile au scoruri apropiate pentru acest indicator.
                                            </p>
                                        )}
                                    </div>
                                )}
                                <p className="border-t border-slate-200 pt-2 text-slate-500">
                                    Scorul real este afisat in popup.
                                </p>
                            </div>

                            {validScoreCount === 0 && (
                                <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
                                    <p>
                                        Nu exista scoruri calculate pentru acest indicator.
                                    </p>

                                    {canEditProperties && (
                                        <button
                                            type="button"
                                            onClick={() => recalculatePortfolioLocationScores(false)}
                                            disabled={portfolioScoreLoading}
                                            className="w-full rounded-xl bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {portfolioScoreLoading
                                                ? "Se recalculeaza scorurile..."
                                                : "Recalculeaza scorurile pentru portofoliu"}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <MapContainer
                    center={[44.4268, 26.1025]}
                    zoom={12}
                    scrollWheelZoom={true}
                    className="h-full min-h-0 w-full rounded-2xl"
                >
                    <TileLayer
                        attribution='&copy; OpenStreetMap contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    <FlyToSearchLocation location={selectedSearchLocation} />
                    <ScoreMapLayer
                        properties={displayProperties}
                        metric={scoreMetric}
                        colorMode={scoreColorMode}
                        visible={mapLayer === "scores"}
                        canEditProperties={canEditProperties}
                        canDeleteProperties={canDeleteProperties}
                        onEditProperty={handleEditProperty}
                        onRequestDeleteProperty={handleRequestDeleteProperty}
                        onRecalculateScore={recalculateLocationScores}
                        recalculatingPropertyId={scoreLoadingId}
                    />

                    {canAddFromMap && (
                        <MapRightClickHandler
                            onRightClick={openContextMenu}
                            onMapClick={() =>
                                setContextMenu((prev) => ({
                                    ...prev,
                                    visible: false,
                                }))
                            }
                        />
                    )}

                    {selectedSearchLocation && (
                        <Marker
                            position={[
                                selectedSearchLocation.latitude,
                                selectedSearchLocation.longitude,
                            ]}
                            icon={defaultIcon}
                        >
                            <Popup>
                                <div className="max-w-xs space-y-3">
                                    <strong className="block text-sm text-slate-900">
                                        {selectedSearchLocation.display_name}
                                    </strong>

                                    {canAddFromMap && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleAddPropertyFromSearchLocation(selectedSearchLocation)
                                            }
                                            className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                                        >
                                            Adauga proprietate aici
                                        </button>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    )}

                    {mapLayer === "properties" && displayProperties.map((property) => (
                        <Marker
                            key={property.id}
                            position={[property.latitude, property.longitude]}
                            icon={property.market_label ? createMarketIcon(property.market_label) : defaultIcon}
                            eventHandlers={{
                                dblclick: (event) => {
                                    event.originalEvent?.preventDefault();
                                    event.originalEvent?.stopPropagation();
                                    handleEditProperty(property);
                                },
                            }}
                        >
                            <Popup>
                                <div className="min-w-56 space-y-1 text-sm">
                                    <strong className="block text-slate-900">{property.title}</strong>
                                    <div className="text-slate-600">{property.address}</div>
                                    <div>Sector {property.sector_id}</div>
                                    <div>{property.price.toLocaleString()} EUR</div>
                                    <div>
                                        {property.price_sqm.toFixed(2)} EUR/mp
                                    </div>
                                    <div>Status: {statusLabels[property.status] ?? property.status}</div>
                                    <div>
                                        Clasificare: {marketLabels[property.market_label] ?? "La piata"}
                                    </div>
                                    {property.market_average_sqm !== null && (
                                        <div>
                                            Media sectorului: {property.market_average_sqm.toFixed(2)} EUR/mp
                                        </div>
                                    )}
                                    {property.market_difference_percent !== null && (
                                        <div>
                                            Diferenta: {property.market_difference_percent > 0 ? "+" : ""}
                                            {property.market_difference_percent.toFixed(2)}%
                                        </div>
                                    )}
                                    <PropertyLocationScores property={property}/>
                                    {(canEditProperties || canDeleteProperties) && (
                                        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                                            {canEditProperties && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleEditProperty(property)}
                                                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                                >
                                                    Editeaza
                                                </button>
                                            )}

                                            {canEditProperties && (
                                                <button
                                                    type="button"
                                                    onClick={() => recalculateLocationScores(property)}
                                                    disabled={scoreLoadingId === property.id}
                                                    className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    {scoreLoadingId === property.id
                                                        ? "Scoruri..."
                                                        : "Recalculeaza scorurile locatiei"}
                                                </button>
                                            )}

                                            {canDeleteProperties && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRequestDeleteProperty(property)}
                                                    className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                                                >
                                                    Sterge
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>

            {contextMenu.visible && canAddFromMap && (
                <div
                    className="fixed z-[10001] w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
                    style={{
                        left: contextMenu.x,
                        top: contextMenu.y,
                    }}
                >
                    <button
                        type="button"
                        onClick={openFormFromContextMenu}
                        className="flex w-full flex-col rounded-xl px-4 py-3 text-left hover:bg-slate-100"
                    >
      <span className="font-semibold text-slate-900">
        Adauga proprietate aici
      </span>
                        <span className="mt-1 text-xs text-slate-500">
        {contextMenu.lat.toFixed(5)}, {contextMenu.lng.toFixed(5)}
      </span>
                    </button>
                </div>
            )}

            {showForm && (editingProperty ? canEditProperties : canAddFromMap) && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/70 p-4">
                    <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900">
                                    {editingProperty ? "Editare proprietate din harta" : "Adaugare proprietate din harta"}
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">
                                    {editingProperty
                                        ? "Modifica datele proprietatii selectate de pe harta."
                                        : "Coordonatele au fost preluate automat din punctul selectat pe harta."}
                                </p>

                                {formError && (
                                    <div
                                        className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
                                        <p className="font-semibold">Proprietatea nu a fost salvata.</p>
                                        <p className="mt-1">{formError}</p>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={closePropertyForm}
                                className="rounded-full px-3 py-1 text-2xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                                ×
                            </button>
                        </div>

                        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">
                                    Titlu proprietate
                                </label>
                                <input
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                                    placeholder="Ex: Apartament 2 camere Aviatiei"
                                    value={form.title}
                                    onChange={(e) => updateField("title", e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">
                                    Adresa
                                </label>
                                <input
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                                    value={form.address}
                                    onChange={(e) => updateField("address", e.target.value)}
                                />
                                <p className="text-xs text-slate-500">
                                    Locatie selectata: {form.latitude.toFixed(6)},{" "}
                                    {form.longitude.toFixed(6)}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">
                                    Sector
                                </label>
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
                                <label className="text-sm font-medium text-slate-700">
                                    Tip proprietate
                                </label>
                                <select
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                                    value={form.property_type_id}
                                    onChange={(e) => updateField("property_type_id", e.target.value)}
                                >
                                    <option value={1}>Apartament</option>
                                    <option value={2}>Garsoniera</option>
                                    <option value={3}>Casa</option>
                                    <option value={4}>Spatiu comercial</option>
                                    <option value={5}>Birou</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">
                                    Suprafata mp
                                </label>
                                <input
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                                    type="number"
                                    value={form.surface_sqm}
                                    onChange={(e) => updateField("surface_sqm", e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">
                                    Pret EUR
                                </label>
                                <input
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                                    type="number"
                                    value={form.price}
                                    onChange={(e) => updateField("price", e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">
                                    Chirie lunara EUR
                                </label>
                                <input
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                                    type="number"
                                    value={form.monthly_rent}
                                    onChange={(e) => updateField("monthly_rent", e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">
                                    Status
                                </label>
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
                                {form.surface_sqm > 0
                                    ? (form.price / form.surface_sqm).toFixed(2)
                                    : "0.00"}{" "}
                                EUR/mp
                            </strong>
                        </div>

                        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                            <button
                                onClick={closePropertyForm}
                                className="rounded-xl border border-slate-200 px-5 py-3 font-medium hover:bg-slate-50"
                            >
                                Anuleaza
                            </button>

                            <button
                                onClick={saveProperty}
                                disabled={saving}
                                className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                            >
                                {saving
                                    ? "Se salveaza..."
                                    : editingProperty
                                        ? "Salveaza modificarile"
                                        : "Salveaza proprietatea"}
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
                onConfirm={handleConfirmDeleteProperty}
            />
        </div>
    );
}
