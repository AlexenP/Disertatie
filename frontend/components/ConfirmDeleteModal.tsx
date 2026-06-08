"use client";

type ConfirmDeleteModalProps = {
    open: boolean;
    title?: string;
    message: string;
    itemName?: string;
    loading?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
};

export default function ConfirmDeleteModal({
                                               open,
                                               title = "Confirmare stergere",
                                               message,
                                               itemName,
                                               loading = false,
                                               onCancel,
                                               onConfirm,
                                           }: ConfirmDeleteModalProps) {
    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-950/70 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
                <div>
                    <h3 className="text-xl font-bold text-slate-900">{title}</h3>
                    <p className="mt-3 text-sm text-slate-600">{message}</p>

                    {itemName && (
                        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-100">
                            <span className="font-semibold">Proprietate:</span>{" "}
                            {itemName}
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Anuleaza
                    </button>

                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {loading ? "Se sterge..." : "Sterge"}
                    </button>
                </div>
            </div>
        </div>
    );
}
