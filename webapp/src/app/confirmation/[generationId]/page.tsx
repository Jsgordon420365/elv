// ver 20260714135400.3

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Download, Loader2, RefreshCw, Siren } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { UnlockOverlay } from "@/components/UnlockOverlay";
import { useVault } from "@/lib/VaultContext";
import { DOCX_MIME_TYPE } from "@/lib/generate";
import { downloadBlob } from "@/lib/download";
import { AssuranceRecord, getGeneratedDocument, getGeneration } from "@/lib/vault";
import { generateWorkflowDocument, loadWorkflowState } from "@/lib/workflow";

const completionItems = [
    "Both parties sign and date the agreement.",
    "Deliver a copy to each party.",
    "Retain a copy with the business records.",
    "Calendar the termination-notice and restrictive-covenant dates.",
    "Amend by regenerating a new version, not by hand-editing.",
];

export default function ConfirmationPage() {
    const { generationId } = useParams<{ generationId: string }>();
    const { masterKey } = useVault();
    const router = useRouter();
    const [assurance, setAssurance] = useState<AssuranceRecord | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        if (!masterKey || !generationId) return;
        setAssurance(await getGeneration(generationId, masterKey));
    }, [generationId, masterKey]);
    useEffect(() => { void load(); }, [load]);

    const downloadStoredDocument = async () => {
        if (!masterKey || !assurance) return;
        const bytes = await getGeneratedDocument(assurance.generationId, masterKey);
        if (!bytes) return setError("The encrypted document bytes were not found.");
        const copy = new Uint8Array(bytes.byteLength);
        copy.set(bytes);
        downloadBlob(new Blob([copy.buffer], { type: DOCX_MIME_TYPE }), assurance.fileName);
    };

    const downloadProvenanceRecord = () => {
        if (!assurance?.provenanceReport) return;
        downloadBlob(new Blob([JSON.stringify({ generationId: assurance.generationId, outputSha256: assurance.outputSha256, packageSha256: assurance.packageSha256, templateId: assurance.templateId, formVersion: assurance.formVersion, intakeVersion: assurance.intakeVersion, documentLabel: assurance.documentLabel, reviewConfirmations: assurance.reviewConfirmations, provenanceReport: assurance.provenanceReport }, null, 2)], { type: "application/json" }), `${assurance.fileName.replace(/\.docx$/i, "")}-provenance.json`);
    };

    const regenerate = async () => {
        if (!masterKey) return;
        setLoading(true);
        setError("");
        try {
            const state = await loadWorkflowState(masterKey);
            const result = await generateWorkflowDocument(masterKey, state.answers, state.provenance, state.matter.auditHistory, state.reviewConfirmations, true);
            router.push(`/confirmation/${result.assurance.generationId}`);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Regeneration failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-[#0a0a0c] text-slate-100">
            <AppHeader />
            <div className="mx-auto max-w-5xl space-y-8 px-6 py-10">
                {!assurance ? <p className="text-slate-400">Unlocking assurance record…</p> : <>
                    <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6"><h1 className="flex items-center gap-3 text-2xl font-bold text-emerald-100"><CheckCircle2 className="h-7 w-7" />Maintained demo document generated</h1><p className="mt-3 text-sm text-emerald-100/80">A new encrypted assurance record and encrypted DOCX copy were stored in this browser.</p></section>
                    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-bold">Assurance record</h2><p className="mt-1 text-sm text-slate-400">Generation {assurance.generationId}</p></div><span className="rounded-full bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-200">{assurance.approvalRepresentation}</span></div><dl className="mt-6 grid gap-4 text-sm md:grid-cols-2"><div><dt className="text-xs uppercase text-slate-500">File</dt><dd className="mt-1 font-semibold">{assurance.fileName}</dd></div><div><dt className="text-xs uppercase text-slate-500">Generated</dt><dd className="mt-1 font-semibold">{new Date(assurance.timestamp).toLocaleString()}</dd></div><div><dt className="text-xs uppercase text-slate-500">Versions</dt><dd className="mt-1 font-semibold">Form {assurance.formVersion} · Intake {assurance.intakeVersion}</dd></div><div><dt className="text-xs uppercase text-slate-500">Provider</dt><dd className="mt-1 font-semibold">{assurance.providerId}</dd></div><div className="md:col-span-2"><dt className="text-xs uppercase text-slate-500">SHA-256 of word/document.xml</dt><dd className="mt-1 break-all font-mono text-xs text-indigo-200">{assurance.outputSha256}</dd></div></dl></section>
                    {assurance.resolvedWarnings.length > 0 && <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5"><h2 className="flex items-center gap-2 font-bold text-amber-100"><AlertTriangle className="h-5 w-5" />Resolved warnings retained</h2>{assurance.resolvedWarnings.map((warning) => <p key={warning} className="mt-2 text-sm text-amber-100/80">{warning}</p>)}</section>}
                    {assurance.provenanceReport && <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Generation provenance — 29 tags</h2><p className="mt-1 text-sm text-slate-400">Rendered value, approved source, confirmation time, and transformation retained with this generation.</p></div><button onClick={downloadProvenanceRecord} className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-4 py-2 text-sm font-bold text-indigo-200">Download provenance JSON</button></div><div className="mt-5 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="uppercase text-slate-500"><tr><th className="pb-3">Tag</th><th className="pb-3">Rendered value</th><th className="pb-3">Classification</th><th className="pb-3">Source</th></tr></thead><tbody className="divide-y divide-slate-800">{Object.entries(assurance.provenanceReport).map(([fieldId, entry]) => <tr key={fieldId}><td className="py-3 pr-3 font-mono text-indigo-200">{fieldId}</td><td className="max-w-xs whitespace-pre-wrap py-3 pr-3 text-slate-200">{entry.renderedValue || "Blank execution date"}</td><td className="py-3 pr-3 text-emerald-300">{entry.classification}</td><td className="py-3 text-slate-400">{entry.sourceRecord}<br />{entry.lastConfirmedAt}<br />{entry.transformationApplied}</td></tr>)}</tbody></table></div></section>}
                    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6"><h2 className="text-lg font-bold">Completion checklist</h2><div className="mt-5 space-y-3">{completionItems.map((item) => <label key={item} className="flex items-start gap-3 rounded-xl bg-slate-950 p-4 text-sm text-slate-300"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-indigo-500" />{item}</label>)}</div></section>
                    {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
                    <section className="flex flex-wrap gap-3"><button onClick={downloadStoredDocument} className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-sm font-bold hover:bg-slate-800"><Download className="h-4 w-4" />Download this DOCX</button><button onClick={regenerate} disabled={loading} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold hover:bg-indigo-500 disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Regenerate with current confirmed records</button><Link href={`/recourse/${assurance.generationId}`} className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold hover:bg-red-500"><Siren className="h-4 w-4" />This document failed, was rejected, or did not perform as represented.</Link></section>
                </>}
            </div>
            <UnlockOverlay />
        </main>
    );
}

// Version history
// 20260714135400.0 - Added assurance evidence, completion checklist, encrypted DOCX download, and direct fact-aware regeneration.
// 20260714135400.1 - Routed stored-DOCX downloads through the shared static file-saver boundary.
// 20260714135400.2 - Displayed and downloaded the complete 29-tag generation provenance report and clarified confirmed-record regeneration.
// 20260714135400.3 - Added dual hash semantics, demo label, persisted review confirmations, and the v1.1 32-tag ledger.
