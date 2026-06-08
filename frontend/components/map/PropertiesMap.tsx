"use client";

import {useEffect, useState} from "react";
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import {getAuthHeaders, PropertyItem} from "@/lib/api";
import {canAddPropertyFromMap, GeoEstateUser, getCurrentUser} from "@/lib/auth";
import {detectBucharestSector} from "@/lib/bucharestSectors";

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
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<PropertyForm>(emptyForm);
    const [formError, setFormError] = useState("");
    const [saving, setSaving] = useState(false);
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        visible: false,
        x: 0,
        y: 0,
        lat: 44.4268,
        lng: 26.1025,
    });
    const canAddFromMap = canAddPropertyFromMap(currentUser);

    useEffect(() => {
        setCurrentUser(getCurrentUser());
    }, []);

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

    function openFormFromContextMenu() {
        if (!canAddFromMap) {
            return;
        }

        const detectedSector = detectBucharestSector(contextMenu.lat, contextMenu.lng);

        if (!detectedSector) {
            setFormError("Locatia selectata nu a putut fi incadrata intr-un sector. Selecteaza un punct din Bucuresti.");
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
            latitude: Number(contextMenu.lat.toFixed(6)),
            longitude: Number(contextMenu.lng.toFixed(6)),
            address: "Locatie selectata pe harta, Bucuresti",
        });

        setFormError("");
        setShowForm(true);
        setContextMenu((prev) => ({
            ...prev,
            visible: false,
        }));
    }

    async function saveProperty() {
        if (!canAddFromMap) {
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

            await apiRequest("/properties", {
                method: "POST",
                body: JSON.stringify(form),
            });

            setShowForm(false);
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

            <MapContainer
                center={[44.4268, 26.1025]}
                zoom={12}
                scrollWheelZoom={true}
                className="h-full min-h-0 w-full flex-1 rounded-2xl"
            >
                <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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

                {properties.map((property) => (
                    <Marker
                        key={property.id}
                        position={[property.latitude, property.longitude]}
                        icon={property.market_label ? createMarketIcon(property.market_label) : defaultIcon}
                    >
                        <Popup>
                            <div className="space-y-1">
                                <strong>{property.title}</strong>
                                <div>{property.address}</div>
                                <div>Sector {property.sector_id}</div>
                                <div>{property.surface_sqm} mp</div>
                                <div>{property.price.toLocaleString()} EUR</div>
                                <div>
                                    {property.price_sqm.toFixed(2)} EUR/mp
                                </div>
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
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>

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

            {showForm && canAddFromMap && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/70 p-4">
                    <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900">
                                    Adaugare proprietate din harta
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">
                                    Coordonatele au fost preluate automat din punctul selectat pe harta.
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
                                onClick={() => setShowForm(false)}
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
                                    <option value={2}>Casa</option>
                                    <option value={3}>Spatiu comercial</option>
                                    <option value={4}>Birou</option>
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
        </div>
    );
}
