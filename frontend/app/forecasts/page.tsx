"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { apiGet } from "@/lib/api";

type ForecastItem = {
  forecast_month: string;
  predicted_price_sqm: number;
  model_name: string;
};

type PriceHistoryItem = {
  month: string;
  average_price_sqm: number;
};

type ForecastResponse = {
  sector_id: number;
  sector_name: string;
  rsi: number;
  forecast: ForecastItem[];
};

const sectors = [
  { id: 1, name: "Sector 1" },
  { id: 2, name: "Sector 2" },
  { id: 3, name: "Sector 3" },
  { id: 4, name: "Sector 4" },
  { id: 5, name: "Sector 5" },
  { id: 6, name: "Sector 6" },
];

function interpretRsi(rsi: number) {
  if (rsi > 70) {
    return "RSI indica o crestere accelerata. Zona poate avea cerere ridicata, dar exista risc de supraevaluare.";
  }

  if (rsi < 30) {
    return "RSI indica o scadere sau un interes redus. Zona necesita analiza suplimentara inainte de investitie.";
  }

  return "RSI indica o evolutie echilibrata. Zona nu prezinta semnale clare de crestere accelerata sau scadere puternica.";
}

function getTrendText(percent: number) {
  if (percent > 2) {
    return "Modelul ARIMA estimeaza o crestere vizibila a pretului mediu pe metru patrat.";
  }

  if (percent < -2) {
    return "Modelul ARIMA estimeaza o scadere a pretului mediu pe metru patrat.";
  }

  return "Modelul ARIMA estimeaza o evolutie stabila a pretului mediu pe metru patrat.";
}

function getRecommendation(rsi: number, percent: number, sectorName: string) {
  if (rsi > 70 && percent > 0) {
    return `${sectorName} poate fi atractiv pentru investitori, dar pretul ridicat impune o analiza atenta a randamentului.`;
  }

  if (rsi < 30 && percent < 0) {
    return `${sectorName} poate indica o zona cu presiune redusa a cererii. Decizia de investitie trebuie corelata cu veniturile estimate.`;
  }

  return `${sectorName} are o evolutie echilibrata. Zona poate fi folosita pentru administrarea unui portofoliu stabil de proprietati.`;
}

export default function ForecastsPage() {
  const [sectorId, setSectorId] = useState(1);
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);
  const [historyData, setHistoryData] = useState<PriceHistoryItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const forecast = await apiGet<ForecastResponse>(`/forecast/${sectorId}`);
        const history = await apiGet<PriceHistoryItem[]>(`/price-history/${sectorId}`);

        setForecastData(forecast);
        setHistoryData(history);
        setError("");
      } catch {
        setError(
          "Nu se poate conecta la backend. Verifica daca FastAPI ruleaza pe http://127.0.0.1:8000"
        );
      }
    }

    loadData();
  }, [sectorId]);

  const chartData = useMemo(() => {
    const history = historyData.map((item) => ({
      month: item.month,
      istoric: item.average_price_sqm,
      arima: null,
    }));

    const forecast =
      forecastData?.forecast.map((item) => ({
        month: item.forecast_month,
        istoric: null,
        arima: Number(item.predicted_price_sqm.toFixed(2)),
      })) ?? [];

    return [...history, ...forecast];
  }, [historyData, forecastData]);

  const monthlyVariationData = useMemo(() => {
    if (!forecastData) {
      return [];
    }

    return forecastData.forecast.map((item, index, array) => {
      const previousValue =
        index === 0
          ? historyData[historyData.length - 1]?.average_price_sqm
          : array[index - 1].predicted_price_sqm;

      const variation = previousValue
        ? item.predicted_price_sqm - previousValue
        : 0;

      return {
        month: item.forecast_month,
        variatie: Number(variation.toFixed(2)),
      };
    });
  }, [forecastData, historyData]);

  if (error) {
    return (
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-red-600">Eroare conectare backend</h2>
        <p className="mt-2 text-slate-600">{error}</p>
      </section>
    );
  }

  if (!forecastData) {
    return <p>Se incarca analiza ARIMA...</p>;
  }

  const lastHistoryValue = historyData[historyData.length - 1]?.average_price_sqm ?? 0;
  const lastForecastValue =
    forecastData.forecast[forecastData.forecast.length - 1]?.predicted_price_sqm ?? 0;

  const difference = lastForecastValue - lastHistoryValue;
  const differencePercent = lastHistoryValue
    ? Number(((difference / lastHistoryValue) * 100).toFixed(2))
    : 0;

  const averageForecast =
    forecastData.forecast.reduce((sum, item) => sum + item.predicted_price_sqm, 0) /
    forecastData.forecast.length;

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-2xl bg-white p-6 shadow-sm md:flex-row md:items-center">
        <div>
          <h2 className="text-3xl font-bold">Previziuni ARIMA pentru Bucuresti</h2>
          <p className="mt-1 text-slate-500">
            Analiza dinamica a pretului mediu pe metru patrat pe baza seriilor lunare.
          </p>
        </div>

        <select
          value={sectorId}
          onChange={(event) => setSectorId(Number(event.target.value))}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2"
        >
          {sectors.map((sector) => (
            <option key={sector.id} value={sector.id}>
              {sector.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Sector analizat</p>
          <p className="mt-2 text-2xl font-bold">{forecastData.sector_name}</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">RSI curent</p>
          <p className="mt-2 text-2xl font-bold">{forecastData.rsi}</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Media previzionata</p>
          <p className="mt-2 text-2xl font-bold">{averageForecast.toFixed(2)} EUR/mp</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Variatie estimata</p>
          <p className="mt-2 text-2xl font-bold">{differencePercent}%</p>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold">Grafic istoric si previziune ARIMA</h3>
        <p className="mt-1 text-sm text-slate-500">
          Linia istorica foloseste datele lunare existente. Linia ARIMA estimeaza urmatoarele 6 luni.
        </p>

        <div className="mt-6 h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="istoric"
                name="Pret istoric EUR/mp"
                strokeWidth={3}
                dot={false}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="arima"
                name="Previziune ARIMA EUR/mp"
                strokeWidth={3}
                strokeDasharray="6 6"
                dot
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold">Variatie lunara estimata</h3>
          <p className="mt-1 text-sm text-slate-500">
            Graficul arata diferenta estimata fata de luna anterioara.
          </p>

          <div className="mt-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyVariationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="variatie" name="Variatie EUR/mp" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold">Raport economic generat</h3>

          <div className="mt-4 space-y-4 text-slate-700">
            <p>
              Pentru {forecastData.sector_name}, ultimul pret istoric este de{" "}
              <strong>{lastHistoryValue.toFixed(2)} EUR/mp</strong>.
            </p>

            <p>
              Modelul ARIMA estimeaza pentru ultima luna analizata o valoare de{" "}
              <strong>{lastForecastValue.toFixed(2)} EUR/mp</strong>, cu o variatie de{" "}
              <strong>{differencePercent}%</strong>.
            </p>

            <p>{getTrendText(differencePercent)}</p>

            <p>{interpretRsi(forecastData.rsi)}</p>

            <p>
              Recomandare:{" "}
              <strong>
                {getRecommendation(
                  forecastData.rsi,
                  differencePercent,
                  forecastData.sector_name
                )}
              </strong>
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold">Tabel previziuni ARIMA</h3>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full border-collapse text-left">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-4">Luna</th>
                <th className="p-4">Pret estimat/mp</th>
                <th className="p-4">Model</th>
              </tr>
            </thead>
            <tbody>
              {forecastData.forecast.map((item) => (
                <tr key={item.forecast_month} className="border-t border-slate-200">
                  <td className="p-4">{item.forecast_month}</td>
                  <td className="p-4">{item.predicted_price_sqm.toFixed(2)} EUR</td>
                  <td className="p-4">{item.model_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}