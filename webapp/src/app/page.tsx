// ver 20260714133400.0

"use client";

import Link from "next/link";
import { ArrowRight, Database, FileCheck2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { UnlockOverlay } from "@/components/UnlockOverlay";

export default function Home() {
    return (
        <main className="min-h-screen bg-[#0a0a0c] text-slate-100">
            <AppHeader />
            <section className="mx-auto max-w-5xl px-6 py-20">
                <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-white md:text-5xl">Independent Contractor working proof</h1>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-400">Create reusable encrypted party facts, merge the maintained North Carolina demonstration form locally, retain assurance evidence, and exercise a portable recourse record.</p>
                <div className="mt-10 grid gap-5 md:grid-cols-2">
                    <Link href="/vault" className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-7 hover:border-indigo-500/50">
                        <Database className="h-8 w-8 text-indigo-300" />
                        <h2 className="mt-5 text-xl font-bold">Build the encrypted vault</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-400">Add the business, contractor, relationship, and reusable facts.</p>
                        <span className="mt-6 flex items-center gap-2 text-sm font-bold text-indigo-300">Open vault <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
                    </Link>
                    <Link href="/workflow/independent-contractor" className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-7 hover:border-emerald-500/50">
                        <FileCheck2 className="h-8 w-8 text-emerald-300" />
                        <h2 className="mt-5 text-xl font-bold">Run the bounded workflow</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-400">Review provenance, clear scope gates, generate the DOCX, and inspect assurance.</p>
                        <span className="mt-6 flex items-center gap-2 text-sm font-bold text-emerald-300">Open workflow <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
                    </Link>
                </div>
            </section>
            <UnlockOverlay />
        </main>
    );
}

// Version history
// 20260714133400.0 - Replaced the network-sync editor with the local proof entry surface.
