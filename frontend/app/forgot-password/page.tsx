"use client";

import {useState} from "react";
import Link from "next/link";

async function resetPasswordRequest(email: string, newPassword: string, confirmPassword: string) {
    const response = await fetch("http://127.0.0.1:8000/auth/reset-password", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            email,
            new_password: newPassword,
            confirm_password: confirmPassword,
        }),
    });

    if (!response.ok) {
        let message = "Parola nu a putut fi resetata.";

        try {
            const data = await response.json();

            if (data.detail) {
                message = data.detail;
            }
        } catch {
            message = "Serverul a returnat o eroare la resetarea parolei.";
        }

        throw new Error(message);
    }

    return response.json();
}

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleResetPassword() {
        if (!email.trim()) {
            setError("Completeaza adresa de email.");
            return;
        }

        if (newPassword.length < 6) {
            setError("Parola trebuie sa aiba minimum 6 caractere.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("Parolele nu coincid.");
            return;
        }

        try {
            setLoading(true);
            setError("");
            setSuccess("");
            const result = await resetPasswordRequest(email, newPassword, confirmPassword);
            setSuccess(result.message ?? "Parola a fost resetata cu succes.");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Parola nu a putut fi resetata.");
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
                <h1 className="mt-3 text-3xl font-bold text-slate-900">Resetare parola</h1>
                <p className="mt-3 text-slate-500">
                    Introdu emailul contului si noua parola. Nu se trimite email real in aplicatia demo.
                </p>

                {error && (
                    <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mt-6 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700 ring-1 ring-emerald-200">
                        {success}
                    </div>
                )}

                <div className="mt-8 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Email</label>
                        <input
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-900"
                            placeholder="admin@geoestate.ro"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Parola noua</label>
                        <input
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-900"
                            placeholder="Minimum 6 caractere"
                            type="password"
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Confirma parola</label>
                        <input
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-900"
                            placeholder="Reintrodu parola"
                            type="password"
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    handleResetPassword();
                                }
                            }}
                        />
                    </div>

                    <button
                        className="w-full rounded-2xl bg-slate-900 px-6 py-4 text-base font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                        disabled={loading}
                        onClick={handleResetPassword}
                    >
                        {loading ? "Se reseteaza parola..." : "Reseteaza parola"}
                    </button>
                </div>

                <div className="mt-6 text-center text-sm text-slate-500">
                    Ti-ai amintit parola?{" "}
                    <Link href="/login" className="font-semibold text-slate-900 hover:underline">
                        Inapoi la login
                    </Link>
                </div>
            </div>
        </main>
    );
}
