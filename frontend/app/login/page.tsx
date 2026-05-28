"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type LoginResponse = {
    email: string;
    full_name: string;
    role: string;
    role_name: string;
    token: string;
};

type DemoUser = {
    label: string;
    description: string;
    email: string;
    password: string;
};

const demoUsers: DemoUser[] = [
    {
        label: "Administrator",
        description: "Acces complet la toate modulele aplicatiei.",
        email: "admin@geoestate.ro",
        password: "admin123",
    },
    {
        label: "Agent imobiliar",
        description: "Gestioneaza proprietatile si localizarea acestora pe harta.",
        email: "agent@geoestate.ro",
        password: "agent123",
    },
    {
        label: "Manager portofoliu",
        description: "Analizeaza performanta economica a portofoliului imobiliar.",
        email: "manager@geoestate.ro",
        password: "manager123",
    },
    {
        label: "Dezvoltator imobiliar",
        description: "Analizeaza oportunitati de investitii pe baza hartii si previziunilor.",
        email: "developer@geoestate.ro",
        password: "developer123",
    },
];

async function loginRequest(email: string, password: string): Promise<LoginResponse> {
    try {
        const response = await fetch("http://127.0.0.1:8000/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
            let message = "Autentificarea a esuat.";

            try {
                const data = await response.json();

                if (data.detail) {
                    message = data.detail;
                }
            } catch {
                message = "Serverul a returnat o eroare la autentificare.";
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

export default function LoginPage() {
    const router = useRouter();

    const [showDemoModal, setShowDemoModal] = useState(false);
    const [error, setError] = useState("");
    const [loadingEmail, setLoadingEmail] = useState("");
    const [manualEmail, setManualEmail] = useState("");
    const [manualPassword, setManualPassword] = useState("");

    async function loginWithCredentials(email: string, password: string) {
        try {
            setError("");
            setLoadingEmail(email);

            const loggedUser = await loginRequest(email, password);

            localStorage.setItem("geoestate_user", JSON.stringify(loggedUser));
            router.push("/dashboard");
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Autentificarea a esuat.";

            setError(message);
        } finally {
            setLoadingEmail("");
        }
    }

    async function handleManualLogin() {
        if (!manualEmail.trim()) {
            setError("Completeaza adresa de email.");
            return;
        }

        if (!manualPassword.trim()) {
            setError("Completeaza parola.");
            return;
        }

        await loginWithCredentials(manualEmail, manualPassword);
    }

    async function handleDemoLogin(user: DemoUser) {
        await loginWithCredentials(user.email, user.password);
    }

    return (
        <main className="min-h-screen bg-slate-100">
            <div className="mx-auto flex min-h-screen max-w-7xl items-center px-6 py-10">
                <div className="grid w-full overflow-hidden rounded-[2rem] bg-white shadow-2xl lg:grid-cols-[1.15fr_0.85fr]">
                    <section className="relative bg-slate-900 p-10 text-white md:p-14">
                        <div className="absolute right-8 top-8 rounded-full bg-white/10 px-4 py-2 text-sm text-slate-200">
                            Bucuresti GIS Analytics
                        </div>

                        <div className="flex min-h-[520px] flex-col justify-between">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-300">
                                    GeoEstate Bucuresti
                                </p>

                                <h1 className="mt-8 max-w-3xl text-5xl font-bold leading-tight">
                                    Analiza geospatiala si economica a proprietatilor imobiliare
                                </h1>

                                <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                                    Aplicatia permite vizualizarea proprietatilor pe harta,
                                    administrarea datelor economice si analiza indicatorilor pe
                                    sectoarele municipiului Bucuresti.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <div className="rounded-2xl bg-white/10 p-5">
                                    <p className="text-3xl font-bold">GIS</p>
                                    <p className="mt-2 text-sm text-slate-300">
                                        Harta interactiva cu proprietati.
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-white/10 p-5">
                                    <p className="text-3xl font-bold">ARIMA</p>
                                    <p className="mt-2 text-sm text-slate-300">
                                        Previziuni pentru pretul mediu/mp.
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-white/10 p-5">
                                    <p className="text-3xl font-bold">RSI</p>
                                    <p className="mt-2 text-sm text-slate-300">
                                        Indicator pentru dinamica preturilor.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="flex items-center p-10 md:p-14">
                        <div className="w-full">
                            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                                    Acces aplicatie
                                </p>

                                <h2 className="mt-3 text-3xl font-bold text-slate-900">
                                    Autentificare
                                </h2>

                                <p className="mt-3 text-slate-500">
                                    Introdu datele contului tau sau foloseste un cont demo pentru prezentare.
                                </p>

                                {error && (
                                    <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
                                        <p className="font-semibold">Autentificarea nu a reusit.</p>
                                        <p className="mt-1">{error}</p>
                                    </div>
                                )}

                                <div className="mt-8 space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">
                                            Utilizator
                                        </label>
                                        <input
                                            value={manualEmail}
                                            onChange={(event) => setManualEmail(event.target.value)}
                                            placeholder="exemplu@geoestate.ro"
                                            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-900"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">
                                            Parola
                                        </label>
                                        <input
                                            value={manualPassword}
                                            onChange={(event) => setManualPassword(event.target.value)}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter") {
                                                    handleManualLogin();
                                                }
                                            }}
                                            type="password"
                                            placeholder="Introdu parola"
                                            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-900"
                                        />
                                    </div>

                                    <button
                                        onClick={handleManualLogin}
                                        disabled={loadingEmail === manualEmail && loadingEmail !== ""}
                                        className="w-full rounded-2xl bg-slate-900 px-6 py-4 text-base font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                                    >
                                        {loadingEmail === manualEmail && loadingEmail !== ""
                                            ? "Se autentifica..."
                                            : "Login"}
                                    </button>

                                    <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                                        <Link
                                            href="/register"
                                            className="font-semibold text-slate-700 transition hover:text-slate-950"
                                        >
                                            Creeaza cont
                                        </Link>

                                        <Link
                                            href="/forgot-password"
                                            className="font-semibold text-slate-700 transition hover:text-slate-950"
                                        >
                                            Am uitat parola
                                        </Link>
                                    </div>
                                </div>

                                <div className="my-8 flex items-center gap-4">
                                    <div className="h-px flex-1 bg-slate-200" />
                                    <span className="text-sm text-slate-400">sau</span>
                                    <div className="h-px flex-1 bg-slate-200" />
                                </div>

                                <button
                                    onClick={() => setShowDemoModal(true)}
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-6 py-4 text-base font-semibold text-slate-900 transition hover:bg-slate-50"
                                >
                                    Incearca cont demo
                                </button>

                                <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
                                    <p className="font-semibold text-slate-900">
                                        Roluri demo disponibile
                                    </p>

                                    <p className="mt-2">
                                        Administrator, Agent imobiliar, Manager portofoliu si
                                        Dezvoltator imobiliar.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            {showDemoModal && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/70 p-4">
                    <div className="w-full max-w-5xl rounded-3xl bg-white p-6 shadow-2xl">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900">
                                    Alege un cont demo
                                </h3>

                                <p className="mt-1 text-sm text-slate-500">
                                    Selecteaza rolul cu care vrei sa intri in aplicatie.
                                </p>
                            </div>

                            <button
                                onClick={() => setShowDemoModal(false)}
                                className="rounded-full px-3 py-1 text-2xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                                x
                            </button>
                        </div>

                        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                            {demoUsers.map((user) => (
                                <button
                                    key={user.email}
                                    onClick={() => handleDemoLogin(user)}
                                    disabled={loadingEmail === user.email}
                                    className="flex min-h-56 flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-slate-900 hover:shadow-lg disabled:opacity-60"
                                >
                                    <div>
                                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-lg font-bold text-white">
                                            {user.label.charAt(0)}
                                        </div>

                                        <h4 className="text-xl font-bold text-slate-900">
                                            {user.label}
                                        </h4>

                                        <p className="mt-3 text-sm leading-6 text-slate-500">
                                            {user.description}
                                        </p>
                                    </div>

                                    <span className="mt-6 inline-flex rounded-xl bg-slate-100 px-4 py-3 text-center text-sm font-semibold text-slate-900">
                                        {loadingEmail === user.email
                                            ? "Se autentifica..."
                                            : "Intra cu acest rol"}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
