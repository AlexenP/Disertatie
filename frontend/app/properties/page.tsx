"use client";

import {useEffect, useMemo, useState} from "react";
import {apiGet} from "@/lib/api";
import dynamic from "next/dynamic";

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
    monthly_rent: number;
    status: string;
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

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
    try {
        const response = await fetch(`http://127.0.0.1:8000${path}`, {
            headers: {
                "Content-Type": "application/json",
            },
            ...options,
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
    return <label className="text-sm font-medium text-slate-700">{children}</label>;
}

function StatusBadge({status}: { status: string }) {
    const config = statuses[status as keyof typeof statuses] ?? statuses.available;

    return (
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${config.className}`}>
      {config.label}
    </span>
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
    const [search, setSearch] = useState("");
    const [formError, setFormError] = useState("");
    const [sectorFilter, setSectorFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [saving, setSaving] = useState(false);
    const [showLocationPicker, setShowLocationPicker] = useState(false);

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

    function updateField(field: keyof PropertyForm, value: string) {
        setForm((prev) => ({
            ...prev,
            [field]:
                field === "title" || field === "address" || field === "status"
                    ? value
                    : Number(value),
        }));
    }

    function startAdd() {
        setForm(emptyForm);
        setEditingId(null);
        setShowForm(true);
        setError("");
        setFormError("");
    }

    function startEdit(property: PropertyItem) {
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

    async function deleteProperty(id: number, title: string) {
        const confirmed = window.confirm(`Sigur vrei sa stergi proprietatea "${title}"?`);

        if (!confirmed) {
            return;
        }

        try {
            await fetch(`http://127.0.0.1:8000/properties/${id}`, {
                method: "DELETE",
            });

            await loadProperties();
        } catch {
            setError("Proprietatea nu a putut fi stearsa.");
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

                    <button
                        onClick={startAdd}
                        className="rounded-2xl bg-white px-5 py-3 font-semibold text-slate-900 transition hover:bg-slate-100"
                    >
                        Adauga proprietate
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700 ring-1 ring-red-200">
                    {error}
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
                        <th className="p-4">Chirie</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Actiuni</th>
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
                            <td className="p-4">{(property.price / property.surface_sqm).toFixed(2)} EUR</td>
                            <td className="p-4">{property.monthly_rent.toLocaleString()} EUR</td>
                            <td className="p-4">
                                <StatusBadge status={property.status}/>
                            </td>
                            <td className="p-4">
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => startEdit(property)}
                                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-white"
                                    >
                                        Editeaza
                                    </button>

                                    <button
                                        onClick={() => deleteProperty(property.id, property.title)}
                                        className="rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                                    >
                                        Sterge
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}

                    {filteredProperties.length === 0 && (
                        <tr>
                            <td colSpan={8} className="p-8 text-center text-slate-500">
                                Nu exista proprietati pentru filtrele selectate.
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>

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

                                <p className="text-xs text-slate-500">
                                    Locatie selectata: {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
                                </p>
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
                            onSelect={(latitude, longitude) => {
                                setForm((prev) => ({
                                    ...prev,
                                    latitude: Number(latitude.toFixed(6)),
                                    longitude: Number(longitude.toFixed(6)),
                                    address:
                                        prev.address.trim() ||
                                        `Locatie selectata pe harta, Bucuresti`,
                                }));
                            }}
                        />

                        <div className="mt-5 flex items-center justify-between gap-4">
                            <p className="text-sm text-slate-600">
                                Coordonate selectate:{" "}
                                <strong>
                                    {form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}
                                </strong>
                            </p>

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
        </section>
    );
}