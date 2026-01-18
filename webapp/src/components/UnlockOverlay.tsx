"use client";

import { useState } from "react";
import { useVault } from "@/lib/VaultContext";
import { Lock as LockIcon, ShieldCheck, ArrowRight, Loader2 } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function UnlockOverlay() {
    const { unlock, isLocked } = useVault();
    const [email, setEmail] = useState("");
    const [passphrase, setPassphrase] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isLocked) return null;

    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await unlock(passphrase, email);
        } catch (err: any) {
            setError(err.message || "Invalid credentials");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0a0c]/80 backdrop-blur-2xl px-6">
            <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden group">
                    {/* Background Glow */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 blur-[100px] group-hover:bg-indigo-500/20 transition-all duration-700" />

                    <div className="relative">
                        <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mb-8 mx-auto">
                            <LockIcon className="w-8 h-8 text-indigo-400" />
                        </div>

                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-white mb-2">Unlock Your Vault</h2>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Enter your passphrase to derive your encryption keys.
                                We never store this on our servers.
                            </p>
                        </div>

                        <form onSubmit={handleUnlock} className="space-y-4">
                            <div>
                                <label className="block text-[10px] uppercase tracking-widest font-semibold text-slate-500 mb-2 ml-1">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
                                    placeholder="name@company.com"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] uppercase tracking-widest font-semibold text-slate-500 mb-2 ml-1">Master Passphrase</label>
                                <input
                                    type="password"
                                    required
                                    value={passphrase}
                                    onChange={(e) => setPassphrase(e.target.value)}
                                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
                                    placeholder="••••••••••••••••"
                                />
                            </div>

                            {error && (
                                <p className="text-red-400 text-[10px] font-medium text-center animate-in slide-in-from-top-1">
                                    {error}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-4 rounded-xl shadow-lg shadow-indigo-500/20 transition-all duration-300 flex items-center justify-center gap-2 group/btn active:scale-[0.98]"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        Unlock Vault
                                        <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-8 flex items-center justify-center gap-2 text-slate-500 text-[10px] uppercase tracking-tighter">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            Client-Side AES-GCM 256-bit Encryption
                        </div>
                    </div>
                </div>

                <p className="mt-6 text-center text-slate-500 text-[11px]">
                    New to ELV? Just enter your email and a unique passphrase to get started.
                </p>
            </div>
        </div>
    );
}
