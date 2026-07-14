// ver 20260714132600.0

"use client";

import Link from "next/link";
import { FileText, Lock, Shield, Users } from "lucide-react";
import { useVault } from "@/lib/VaultContext";

export function AppHeader() {
    const { lock, isDemoMode } = useVault();
    return (
        <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
                <Link href="/" className="flex items-center gap-3 font-bold text-white"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600"><Shield className="h-5 w-5" /></span>ELV LegalFlowNC</Link>
                <nav className="flex items-center gap-2 text-sm">
                    <Link href="/vault" className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"><Users className="h-4 w-4" />Vault</Link>
                    <Link href="/workflow/independent-contractor" className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"><FileText className="h-4 w-4" />Independent Contractor</Link>
                    <button onClick={lock} className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-white"><Lock className="h-4 w-4" />Lock</button>
                </nav>
            </div>
            {isDemoMode && <div className="border-t border-indigo-500/20 bg-indigo-500/10 py-2 text-center text-xs font-semibold text-indigo-200">Local demonstration mode — external services and sync are disabled</div>}
        </header>
    );
}

// Version history
// 20260714132600.0 - Added shared proof navigation using the existing dark dashboard styling.
