"use client";

import { useState, useEffect } from "react";
import { useVault } from "@/lib/VaultContext";
import { UnlockOverlay } from "@/components/UnlockOverlay";
import { FileText, Plus, Search, LogOut, Shield, Database, LayoutDashboard, Clock } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface Template {
    id: string;
    slug: string;
    name: string;
    description: string;
    category: string;
}

export default function Dashboard() {
    const { userId, masterKey, lock } = useVault();
    const [entitledTemplates, setEntitledTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEntitlements = async () => {
            if (!userId) return;
            try {
                const res = await fetch(`/api/templates`); // For MVP, we'll just show all purchased ones
                // In a real app, we'd have an endpoint for user purchases
                const data = await res.json();

                // For logic sim, we check the actual purchases via a mock entitlements check
                // But for now, let's just show a list
                setEntitledTemplates(data);
            } catch (err) {
                console.error("Failed to fetch entitlements:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchEntitlements();
    }, [userId]);

    return (
        <main className="min-h-screen bg-[#0a0a0c] text-slate-200 flex">
            {/* Sidebar */}
            <aside className="w-72 border-r border-white/5 bg-slate-900/20 backdrop-blur-3xl flex flex-col">
                <div className="p-8">
                    <div className="flex items-center gap-3 mb-10">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                            <Shield className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-lg font-bold">ELV Vault</span>
                    </div>

                    <nav className="space-y-1">
                        {[
                            { icon: LayoutDashboard, label: "Overview", active: true },
                            { icon: FileText, label: "My Documents", active: false },
                            { icon: Database, label: "Encrypted Vault", active: false },
                            { icon: Clock, label: "Sync History", active: false },
                        ].map((item) => (
                            <button
                                key={item.label}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                                    item.active ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
                                )}
                            >
                                <item.icon className="w-4 h-4" />
                                {item.label}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="mt-auto p-8 border-t border-white/5 space-y-4">
                    <div className="flex items-center gap-3 px-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500" />
                        <div className="flex-1 overflow-hidden">
                            <p className="text-xs font-bold text-white truncate">{userId || "Guest"}</p>
                            <p className="text-[10px] text-slate-500">Private Mode Active</p>
                        </div>
                    </div>
                    <button
                        onClick={lock}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-400/10 transition-all border border-transparent hover:border-red-400/20"
                    >
                        <LogOut className="w-4 h-4" />
                        Lock Vault
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto px-12 py-12">
                <header className="flex items-center justify-between mb-12">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">My Vault</h1>
                        <p className="text-slate-500 text-sm">You have access to {entitledTemplates.length} secure templates.</p>
                    </div>

                    <a
                        href="/marketplace"
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold h-11 px-6 rounded-xl shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        New Template
                    </a>
                </header>

                {/* Dashboard Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    {[
                        { label: "Active Entitlements", value: entitledTemplates.length, color: "text-indigo-400" },
                        { label: "Encrypted Fields", value: "142", color: "text-emerald-400" },
                        { label: "Local Devices", value: "1", color: "text-cyan-400" },
                    ].map((stat) => (
                        <div key={stat.label} className="bg-slate-900/30 border border-slate-800 p-6 rounded-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 blur-3xl group-hover:bg-white/10 transition-all" />
                            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">{stat.label}</p>
                            <p className={cn("text-3xl font-bold", stat.color)}>{stat.value}</p>
                        </div>
                    ))}
                </div>

                {/* Template List */}
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Licensed Templates</h2>

                <div className="grid grid-cols-1 gap-4">
                    {loading ? (
                        <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
                    ) : entitledTemplates.length > 0 ? (
                        entitledTemplates.map((template) => (
                            <div
                                key={template.id}
                                className="group bg-slate-900/30 border border-slate-800 p-6 rounded-2xl flex items-center justify-between hover:bg-slate-900/50 hover:border-indigo-500/30 transition-all duration-300"
                            >
                                <div className="flex items-center gap-6">
                                    <div className="w-14 h-14 bg-slate-950/50 rounded-xl flex items-center justify-center border border-slate-800">
                                        <FileText className="w-7 h-7 text-indigo-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white group-hover:text-indigo-300 transition-colors uppercase tracking-tight">{template.name}</h3>
                                        <div className="flex items-center gap-4 mt-1">
                                            <span className="text-[10px] text-slate-500 font-bold uppercase">{template.category}</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-700" />
                                            <span className="text-[10px] text-emerald-400/70 font-bold uppercase">Ready to Merge</span>
                                        </div>
                                    </div>
                                </div>

                                <a
                                    href="/"
                                    className="px-6 py-2.5 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-slate-700 hover:border-indigo-500 transition-all shadow-lg active:scale-95"
                                >
                                    Open Editor
                                </a>
                            </div>
                        ))
                    ) : (
                        <div className="py-24 border-2 border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center text-center px-6">
                            <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-6">
                                <Search className="w-8 h-8 text-slate-700" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">No templates found</h3>
                            <p className="text-slate-500 text-sm max-w-sm mb-8">
                                Your vault is currently empty. Visit the marketplace to license premium, encrypted templates.
                            </p>
                            <a href="/marketplace" className="text-indigo-400 text-sm font-bold hover:text-indigo-300 transition-colors">Go to Marketplace →</a>
                        </div>
                    )}
                </div>
            </div>

            <UnlockOverlay />
        </main>
    );
}
