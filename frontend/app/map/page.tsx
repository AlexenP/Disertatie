"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { apiGet, PropertyItem } from "@/lib/api";

const PropertiesMap = dynamic(
  () => import("@/components/map/PropertiesMap"),
  {
    ssr: false,
  }
);

export default function MapPage() {
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [error, setError] = useState("");

  async function loadProperties() {
    try {
      const data = await apiGet<PropertyItem[]>("/properties");
      setProperties(data);
      setError("");
    } catch {
      setError(
        "Nu se poate conecta la backend. Verifica daca FastAPI ruleaza pe http://127.0.0.1:8000"
      );
    }
  }

  useEffect(() => {
    loadProperties();
  }, []);

  if (error) {
    return (
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-red-600">Eroare conectare backend</h2>
        <p className="mt-2 text-slate-600">{error}</p>
      </section>
    );
  }

  return (
    <section className="flex h-[calc(100vh-4rem)] flex-col gap-6">
      <div className="rounded-3xl bg-slate-900 p-8 text-white shadow-sm">
        <h2 className="text-3xl font-bold">Harta proprietatilor din Bucuresti</h2>
        <p className="mt-2 text-slate-300">
          Vizualizare GIS a proprietatilor si adaugare directa prin click dreapta pe harta.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <PropertiesMap
          properties={properties}
          onPropertyCreated={loadProperties}
        />
      </div>
    </section>
  );
}
