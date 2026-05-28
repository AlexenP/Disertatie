"use client";

import {useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";

type RegisterResponse = {
    email: string;
    full_name: string;
    role: string;
    role_name: string;
    token: string;
};

async function registerRequest(fullName: string, email: string, password: string): Promise<RegisterResponse> {
    const response = await fetch("http://127.0.0.1:8000/auth/register", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            full_name: fullName,
            email,
            password,
        }),
    });

    if (!response.ok) {
        let message = "Contul nu a putut fi creat.";

        try {
            const data = await response.json();

            if (data.detail) {
                message = data.detail;
            }
        } catch {
            message = "Serverul a returnat o eroare la crearea contului.";
        }

        throw new Error(message);
    }

    return response.json();
}

export default function RegisterPage() {
    const router = useRouter();
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleRegister() {
        if (!fullName.trim()) {
            setError("Completeaza numele complet.");
            return;
        }

        if (!email.trim()) {
            setError("Completeaza adresa de email.");
            return;
        }

        if (password.length < 6) {
            setError("Parola trebuie sa aiba minimum 6 caractere.");
            return;
        }

        try {
            setLoading(true);
            setError("");
            const user = await registerRequest(fullName, email, password);
            localStorage.setItem("geoestate_user", JSON.stringify(user));
            router.push("/dashboard");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Contul nu a putut fi creat.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-10">
            <div className="w-full max-w-xl rounded-[2rem] bg-white p-8 shadow-2xl">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    GeoEstate Bucuresti
                </p>
                <h1 className="mt-3 text-3xl font-bold text-slate-900">Creeaza cont admin</h1>
                <p className="mt-3 text-slate-500">
                    Conturile create aici primesc rolul Administrator pentru aplicatia demo.
                </p>

                {error && (
                    <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
                        {error}
                    </div>
                )}

                <div className="mt-8 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Nume complet</label>
                        <input
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-900"
                            placeholder="Ex: Administrator GeoEstate"
                            value={fullName}
                            onChange={(event) => setFullName(event.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Email</label>
                        <input
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-900"
                            placeholder="adminnou@geoestate.ro"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Parola</label>
                        <input
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-900"
                            placeholder="Minimum 6 caractere"
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    handleRegister();
                                }
                            }}
                        />
                    </div>

                    <button
                        className="w-full rounded-2xl bg-slate-900 px-6 py-4 text-base font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                        disabled={loading}
                        onClick={handleRegister}
                    >
                        {loading ? "Se creeaza contul..." : "Creeaza cont"}
                    </button>
                </div>

                <div className="mt-6 text-center text-sm text-slate-500">
                    Ai deja cont?{" "}
                    <Link href="/login" className="font-semibold text-slate-900 hover:underline">
                        Inapoi la login
                    </Link>
                </div>
            </div>
        </main>
    );
}
