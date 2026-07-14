// ver 20260714132600.1

"use client";

import Link from "next/link";
import { FileText, Lock, Shield, Users } from "lucide-react";
import { useVault } from "@/lib/VaultContext";

export function AppHeader() {
    const { lock, isDemoMode } = useVault();
    return (
        <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-4 sm:px-6">
                <Link href="/" className="flex items-center gap-2 text-sm font-bold text-white sm:gap-3 sm:text-base"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600"><Shield className="h-5 w-5" /></span><span>ELV LegalFlowNC</span></Link>
                <nav className="flex items-center gap-0 text-sm sm:gap-2">
                    <Link aria-label="Vault" href="/vault" className="flex items-center gap-2 rounded-lg px-2 py-2 text-slate-300 hover:bg-slate-800 hover:text-white sm:px-3"><Users className="h-4 w-4" /><span className="hidden sm:inline">Vault</span></Link>
                    <Link aria-label="Independent Contractor" href="/workflow/independent-contractor" className="flex items-center gap-2 rounded-lg px-2 py-2 text-slate-300 hover:bg-slate-800 hover:text-white sm:px-3"><FileText className="h-4 w-4" /><span className="hidden sm:inline">Independent Contractor</span></Link>
                    <button aria-label="Lock" onClick={lock} className="flex items-center gap-2 rounded-lg px-2 py-2 text-slate-400 hover:bg-slate-800 hover:text-white sm:px-3"><Lock className="h-4 w-4" /><span className="hidden sm:inline">Lock</span></button>
                </nav>
            </div>
            {isDemoMode && <div className="border-t border-indigo-500/20 bg-indigo-500/10 py-2 text-center text-xs font-semibold text-indigo-200">Local demonstration mode — external services and sync are disabled</div>}
        </header>
    );
}

// Version history
// 20260714132600.0 - Added shared proof navigation using the existing dark dashboard styling.
// 20260714132600.1 - Collapsed mobile navigation labels to accessible icons to eliminate viewport overflow.
