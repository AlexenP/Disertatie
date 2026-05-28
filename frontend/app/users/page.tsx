"use client";

import {useEffect, useState} from "react";
import {apiGet, getAuthHeaders} from "@/lib/api";

type HelperUser = {
  id: number;
  full_name: string;
  email: string;
  role: "agent" | "manager" | "developer";
  role_name: string;
  admin_id: number;
  created_at: string;
};

type UserForm = {
  full_name: string;
  email: string;
  password: string;
  role: "agent" | "manager" | "developer";
};

const emptyForm: UserForm = {
  full_name: "",
  email: "",
  password: "",
  role: "agent",
};

const roleOptions = [
  {value: "agent", label: "Agent imobiliar"},
  {value: "manager", label: "Manager portofoliu"},
  {value: "developer", label: "Dezvoltator imobiliar"},
];

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`http://127.0.0.1:8000${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(options?.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    let message = "Operatia nu a putut fi finalizata.";

    try {
      const data = await response.json();

      if (data.detail) {
        message = data.detail;
      }
    } catch {
      message = `Serverul a returnat eroarea ${response.status}.`;
    }

    throw new Error(message);
  }

  return response.json();
}

export default function UsersPage() {
  const [users, setUsers] = useState<HelperUser[]>([]);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadUsers() {
    try {
      setLoading(true);
      const data = await apiGet<HelperUser[]>("/users");
      setUsers(data);
      setError("");
    } catch {
      setError("Nu se pot incarca utilizatorii. Verifica daca esti autentificat ca admin.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function updateField(field: keyof UserForm, value: string) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function createUser() {
    if (!form.full_name.trim()) {
      setFormError("Completeaza numele complet.");
      return;
    }

    if (!form.email.trim()) {
      setFormError("Completeaza emailul.");
      return;
    }

    if (form.password.length < 6) {
      setFormError("Parola trebuie sa aiba minimum 6 caractere.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");
      await apiRequest<HelperUser>("/users", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm(emptyForm);
      await loadUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Utilizatorul nu a putut fi creat.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser(user: HelperUser) {
    const confirmed = window.confirm(`Stergi utilizatorul "${user.full_name}"?`);

    if (!confirmed) {
      return;
    }

    try {
      await apiRequest(`/users/${user.id}`, {
        method: "DELETE",
      });
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Utilizatorul nu a putut fi sters.");
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-slate-900 p-8 text-white shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-300">
          Administrare portofoliu
        </p>
        <h2 className="mt-2 text-3xl font-bold">Utilizatori ajutatori</h2>
        <p className="mt-2 max-w-2xl text-slate-300">
          Creeaza conturi agent, manager sau developer care lucreaza pe acelasi portofoliu de imobile.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <h3 className="text-xl font-bold text-slate-900">Creeaza utilizator</h3>
          <p className="mt-1 text-sm text-slate-500">
            Utilizatorul nou va primi automat portofoliul administratorului curent.
          </p>

          {formError && (
            <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
              {formError}
            </div>
          )}

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Nume complet</label>
              <input
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                placeholder="Ex: Agent Portofoliu"
                value={form.full_name}
                onChange={(event) => updateField("full_name", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                placeholder="agent@geoestate.ro"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Parola</label>
              <input
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                placeholder="Minimum 6 caractere"
                type="password"
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Rol</label>
              <select
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                value={form.role}
                onChange={(event) => updateField("role", event.target.value)}
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="w-full rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              disabled={saving}
              onClick={createUser}
            >
              {saving ? "Se salveaza..." : "Creeaza utilizator"}
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          <div className="border-b border-slate-100 p-6">
            <h3 className="text-xl font-bold text-slate-900">Utilizatori existenti</h3>
            <p className="mt-1 text-sm text-slate-500">
              Lista conturilor ajutatoare din portofoliul tau.
            </p>
          </div>

          {loading ? (
            <p className="p-6 text-slate-500">Se incarca utilizatorii...</p>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead className="bg-slate-50 text-sm text-slate-600">
              <tr>
                <th className="p-4">Utilizator</th>
                <th className="p-4">Rol</th>
                <th className="p-4 text-right">Actiuni</th>
              </tr>
              </thead>
              <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-slate-100">
                  <td className="p-4">
                    <div className="font-semibold text-slate-900">{user.full_name}</div>
                    <div className="mt-1 text-sm text-slate-500">{user.email}</div>
                  </td>
                  <td className="p-4">{user.role_name}</td>
                  <td className="p-4 text-right">
                    <button
                      className="rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                      onClick={() => deleteUser(user)}
                    >
                      Sterge
                    </button>
                  </td>
                </tr>
              ))}

              {users.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-slate-500">
                    Nu exista utilizatori ajutatori pentru acest portofoliu.
                  </td>
                </tr>
              )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
