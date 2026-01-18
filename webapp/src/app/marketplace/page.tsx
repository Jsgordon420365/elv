"use client";

import { useState, useEffect } from "react";
import { useVault } from "@/lib/VaultContext";
import { UnlockOverlay } from "@/components/UnlockOverlay";
import { ShoppingBag, Star, Shield, Zap, Search, Filter, Loader2, CheckCircle } from "lucide-react";
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
    price: number;
    category: string;
}

export default function Marketplace() {
    const { userId, masterKey } = useVault();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [purchasingId, setPurchasingId] = useState<string | null>(null);

    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const res = await fetch("/api/templates");
                const data = await res.json();
                setTemplates(data);
            } catch (err) {
                console.error("Failed to fetch templates:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchTemplates();
    }, []);

    const handlePurchase = async (templateId: string) => {
        if (!userId) return;
        setPurchasingId(templateId);
        try {
            const res = await fetch("/api/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ templateId, userId })
            });
            const { url } = await res.json();
            // In a real app, window.location.href = url;
            // For MVP/Demo, we simulate success via webhook
            console.log("Stripe Checkout Session created:", url);
            alert("Checkout simulated! Redirecting to fulfillment...");

            // Mocking the webhook fulfillment locally for the demo
            await fetch("/api/webhook/stripe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "checkout.session.completed",
                    data: {
                        object: {
                            id: "mock_session_" + Date.now(),
                            metadata: { userId, templateId }
                        }
                    }
                })
            });
            window.location.href = "/dashboard?success=true";
        } catch (err) {
            console.error("Purchase error:", err);
        } finally {
            setPurchasingId(null);
        }
    };

    return (
        <main className="min-h-screen bg-[#0a0a0c] text-slate-200">
            {/* Header */}
            <header className="border-b border-white/5 bg-slate-900/40 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                <ShoppingBag className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-xl font-bold tracking-tight text-white">ELV <span className="text-indigo-400">Market</span></span>
                        </div>

                        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
                            <a href="/" className="hover:text-white transition-colors">Editor</a>
                            <a href="/marketplace" className="text-white">Templates</a>
                            <a href="/dashboard" className="hover:text-white transition-colors">Vault</a>
                        </nav>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative hidden lg:block">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search templates..."
                                className="bg-slate-950/50 border border-slate-800 rounded-full py-2 pl-10 pr-4 text-xs w-64 focus:outline-none focus:border-indigo-500/50 transition-all"
                            />
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-12">
                {/* Hero Section */}
                <div className="mb-16">
                    <h1 className="text-4xl lg:text-5xl font-bold text-white mb-6">Premium Legal Templates</h1>
                    <p className="text-slate-400 text-lg max-w-2xl leading-relaxed">
                        Secure, professionally-vetted legal documents. Buy once, use forever in your private vault.
                        Zero-knowledge guarantee: we never see your choices.
                    </p>
                </div>

                {/* Filter Bar */}
                <div className="flex flex-wrap items-center gap-4 mb-12">
                    {["All Categories", "Business", "Real Estate", "Startup", "Employment"].map((cat) => (
                        <button
                            key={cat}
                            className={cn(
                                "px-6 py-2.5 rounded-full text-xs font-semibold transition-all duration-300 border",
                                cat === "All Categories"
                                    ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                                    : "bg-slate-900/50 border-slate-800 text-slate-500 hover:text-white hover:border-slate-700"
                            )}
                        >
                            {cat}
                        </button>
                    ))}
                    <div className="ml-auto flex items-center gap-2 text-slate-500 text-xs">
                        <Filter className="w-4 h-4" />
                        Sort by: Newest
                    </div>
                </div>

                {/* Template Grid */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                        <p className="text-slate-500 text-sm animate-pulse">Scanning the catalog...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {templates.map((template) => (
                            <div
                                key={template.id}
                                className="group bg-slate-900/30 border border-slate-800/50 rounded-3xl p-8 hover:bg-slate-900/50 hover:border-indigo-500/30 transition-all duration-500 flex flex-col relative overflow-hidden"
                            >
                                {/* Active Glow */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 blur-[60px] group-hover:bg-indigo-600/10 transition-all duration-700" />

                                <div className="flex items-start justify-between mb-8">
                                    <div className="w-12 h-12 bg-slate-950/50 rounded-2xl flex items-center justify-center border border-slate-800 group-hover:border-indigo-500/50 transition-colors">
                                        <Zap className="w-6 h-6 text-indigo-400" />
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">{template.category}</div>
                                        <div className="text-lg font-bold text-white">${(template.price / 100).toFixed(2)}</div>
                                    </div>
                                </div>

                                <h3 className="text-xl font-bold text-white mb-4 group-hover:text-indigo-300 transition-colors">{template.name}</h3>
                                <p className="text-slate-400 text-sm leading-relaxed mb-10 flex-1">
                                    {template.description}
                                </p>

                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                                        <Shield className="w-3.5 h-3.5 text-emerald-400" />
                                        Encryption-Ready
                                        <Star className="w-3.5 h-3.5 text-amber-400 ml-auto" />
                                        4.9 (12.4k reviews)
                                    </div>

                                    <button
                                        onClick={() => handlePurchase(template.id)}
                                        disabled={purchasingId === template.id}
                                        className="w-full bg-white text-black font-bold py-4 rounded-2xl hover:bg-slate-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group/btn"
                                    >
                                        {purchasingId === template.id ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>
                                                Purchase Template
                                                <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer Background Decor */}
            <div className="fixed bottom-0 left-0 w-full h-96 bg-gradient-to-t from-indigo-900/5 to-transparent pointer-events-none -z-10" />

            <UnlockOverlay />
        </main>
    );
}

function ArrowRight(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
        </svg>
    )
}
