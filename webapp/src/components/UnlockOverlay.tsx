// ver 20260714132600.0

"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Loader2, Lock, ShieldCheck } from "lucide-react";
import { useVault } from "@/lib/VaultContext";

export function UnlockOverlay() {
    const { unlock, isLocked, isDemoMode } = useVault();
    const [email, setEmail] = useState("demo@local.test");
    const [passphrase, setPassphrase] = useState("legalflownc-demo");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    if (!isLocked) return null;

    const handleUnlock = async (event: FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setError("");
        try {
            await unlock(passphrase, email);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to unlock the vault.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0a0c]/95 px-6 backdrop-blur-xl">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
                <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-500/30 bg-indigo-500/10">
                    <Lock className="h-7 w-7 text-indigo-300" />
                </div>
                <h2 className="text-center text-2xl font-bold text-white">Create or unlock your local vault</h2>
                <p className="mt-3 text-center text-sm leading-6 text-slate-400">
                    {isDemoMode ? "Demo mode derives your encryption key locally. Device registration and server sync are disabled." : "Enter your vault identity and passphrase."}
                </p>
                <form onSubmit={handleUnlock} className="mt-7 space-y-4">
                    <label className="block text-xs font-semibold text-slate-300">
                        Local vault identity
                        <input aria-label="Local vault identity" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500" />
                    </label>
                    <label className="block text-xs font-semibold text-slate-300">
                        Passphrase
                        <input aria-label="Passphrase" type="password" required minLength={8} value={passphrase} onChange={(event) => setPassphrase(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500" />
                    </label>
                    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
                    <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-60">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Unlock local vault</span><ArrowRight className="h-4 w-4" /></>}
                    </button>
                </form>
                <p className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-400" /> AES-GCM encryption via WebCrypto</p>
            </div>
        </div>
    );
}

// Version history
// 20260714132600.0 - Replaced server-oriented unlock copy with a focused local demo unlock surface.
