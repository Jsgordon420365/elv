// ver 20260714134800.7

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileDown, Info, Loader2, ShieldCheck } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { UnlockOverlay } from "@/components/UnlockOverlay";
import { useVault } from "@/lib/VaultContext";
import { getForm, getProvider } from "@/lib/registry";
import { INDEPENDENT_CONTRACTOR_FIELDS } from "@/lib/variables";
import {
    OUT_OF_SCOPE_MESSAGE,
    generateWorkflowDocument,
    getWorkflowGate,
    loadWorkflowState,
    persistMatter,
    prepareGenerationInputs,
    updateScopeAudit,
} from "@/lib/workflow";
import { MatterAuditEvent } from "@/lib/vault";
import { ConsistencyResult } from "@/lib/canonical";
import { GenerationProvenanceEntry, currentIntakeProvenance, isApprovedGenerationProvenance } from "@/lib/provenance";

const canonicalFieldIds = new Set(["owner_name", "owner_add1", "owner_add2", "contractor_name", "contr_add1", "contr_add2", "owner_signatory_name", "owner_signatory_date", "contractor_signatory_name", "contractor_signatory_date"]);

export default function IndependentContractorWorkflow() {
    const { masterKey, isLocked } = useVault();
    const router = useRouter();
    const form = getForm("independent-contractor-nc");
    const provider = getProvider(form.providerId);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [provenance, setProvenance] = useState<Record<string, GenerationProvenanceEntry>>({});
    const [auditHistory, setAuditHistory] = useState<MatterAuditEvent[]>([]);
    const [baseConsistencyChecks, setBaseConsistencyChecks] = useState<ConsistencyResult[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState("");
    const answersRef = useRef<Record<string, string>>({});
    const provenanceRef = useRef<Record<string, GenerationProvenanceEntry>>({});
    const auditHistoryRef = useRef<MatterAuditEvent[]>([]);
    const persistQueueRef = useRef<Promise<void>>(Promise.resolve());
    const loadSequenceRef = useRef(0);

    const load = useCallback(async () => {
        if (!masterKey) return;
        const loadSequence = ++loadSequenceRef.current;
        try {
            const state = await loadWorkflowState(masterKey);
            if (loadSequence !== loadSequenceRef.current) return;
            setAnswers(state.answers);
            setProvenance(state.provenance);
            setAuditHistory(state.matter.auditHistory);
            answersRef.current = state.answers;
            provenanceRef.current = state.provenance;
            auditHistoryRef.current = state.matter.auditHistory;
            setBaseConsistencyChecks(state.consistencyChecks);
            setLoaded(true);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to load the encrypted workflow state.");
        }
    }, [masterKey]);

    useEffect(() => { void load(); }, [load]);

    const gate = useMemo(() => getWorkflowGate(answers), [answers]);
    const merged = useMemo(() => {
        const nextAnswers = { ...answers };
        const nextProvenance = { ...provenance };
        if (answers.forum_county && answers.forum_state && provenance.forum_county && provenance.forum_state) {
            const renderedValue = `${answers.forum_county}, ${answers.forum_state}`;
            nextAnswers.forum_county_comma_state = renderedValue;
            nextProvenance.forum_county_comma_state = { renderedValue, sourceRecord: `${provenance.forum_county.sourceRecord};${provenance.forum_state.sourceRecord}`, classification: "DETERMINISTIC_DERIVATION", lastConfirmedAt: [provenance.forum_county.lastConfirmedAt, provenance.forum_state.lastConfirmedAt].sort().at(-1) ?? "", transformationApplied: "joined separately confirmed county and state" };
        }
        return { answers: nextAnswers, provenance: nextProvenance };
    }, [answers, provenance]);
    const prepared = useMemo(() => prepareGenerationInputs(merged.answers, merged.provenance), [merged]);
    const visibleFields = INDEPENDENT_CONTRACTOR_FIELDS.filter((field) => field.id !== "forum_county_comma_state" && (!canonicalFieldIds.has(field.id) || !provenance[field.id]));
    const unconfirmedFields = Object.entries(answers).filter(([fieldId, value]) => value.trim() && fieldId !== "forum_county_comma_state" && !isApprovedGenerationProvenance(provenance[fieldId])).map(([fieldId]) => fieldId);
    const consistencyChecks = useMemo(() => {
        const withoutDescriptionCheck = baseConsistencyChecks.filter((check) => check.code !== "DBA_EMBEDDED_IN_DESCRIPTION");
        return /\b(?:d\/?b\/?a|dba|doing business as)\b/i.test(answers.owner_business_description ?? "")
            ? [...withoutDescriptionCheck, { code: "DBA_EMBEDDED_IN_DESCRIPTION", classification: "CONFIRMATION_REQUIRED" as const, message: "DBA language appears in the business-description field; use the separate trade-name record instead." }]
            : withoutDescriptionCheck;
    }, [answers.owner_business_description, baseConsistencyChecks]);
    const consistencyBlocking = consistencyChecks.filter((check) => check.classification === "BLOCKING");

    const persist = async (nextAnswers: Record<string, string>, nextAudit: MatterAuditEvent[], nextProvenance: Record<string, GenerationProvenanceEntry>) => {
        if (!masterKey) return;
        const pending = persistQueueRef.current.then(async () => { await persistMatter(masterKey, nextAnswers, nextAudit, nextProvenance); });
        persistQueueRef.current = pending.catch(() => undefined);
        await pending;
    };

    const updateAnswer = async (fieldId: string, value: string) => {
        const confirmedAt = new Date().toISOString();
        const nextAnswers = { ...answersRef.current, [fieldId]: value };
        const nextProvenance = { ...provenanceRef.current };
        if (value.trim()) nextProvenance[fieldId] = currentIntakeProvenance(fieldId, value, confirmedAt);
        else delete nextProvenance[fieldId];
        let nextAudit = auditHistoryRef.current;
        if (fieldId === "forum_state") nextAudit = updateScopeAudit(nextAudit, "OUT_OF_STATE_FORUM", `Out-of-North-Carolina forum encountered. ${OUT_OF_SCOPE_MESSAGE}`, value.trim().toLowerCase() !== "north carolina");
        if (fieldId === "arbitration_state") nextAudit = updateScopeAudit(nextAudit, "OUT_OF_STATE_ARBITRATION", `Out-of-North-Carolina arbitration state encountered. ${OUT_OF_SCOPE_MESSAGE}`, value.trim().toLowerCase() !== "north carolina");
        if (fieldId === "relationship_characterization") nextAudit = updateScopeAudit(nextAudit, "EMPLOYMENT_RELATIONSHIP", `Employment characterization encountered. ${OUT_OF_SCOPE_MESSAGE}`, value === "employment");
        setAnswers(nextAnswers);
        setProvenance(nextProvenance);
        setAuditHistory(nextAudit);
        answersRef.current = nextAnswers;
        provenanceRef.current = nextProvenance;
        auditHistoryRef.current = nextAudit;
        await persist(nextAnswers, nextAudit, nextProvenance);
    };

    const confirmDisplayedSavedAnswers = async () => {
        const confirmedAt = new Date().toISOString();
        const nextAnswers = answersRef.current;
        const nextAudit = auditHistoryRef.current;
        const nextProvenance = { ...provenanceRef.current };
        for (const [fieldId, value] of Object.entries(nextAnswers)) {
            if (value.trim() && fieldId !== "forum_county_comma_state" && !isApprovedGenerationProvenance(nextProvenance[fieldId])) nextProvenance[fieldId] = currentIntakeProvenance(fieldId, value, confirmedAt);
        }
        setProvenance(nextProvenance);
        provenanceRef.current = nextProvenance;
        await persist(nextAnswers, nextAudit, nextProvenance);
    };

    const handleGenerate = async () => {
        if (!masterKey) return;
        setGenerating(true);
        setError("");
        try {
            const result = await generateWorkflowDocument(masterKey, merged.answers, merged.provenance, auditHistory, true);
            router.push(`/confirmation/${result.assurance.generationId}`);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Document generation failed.");
        } finally {
            setGenerating(false);
        }
    };

    return (
        <main className="min-h-screen bg-[#0a0a0c] text-slate-100">
            <AppHeader />
            <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
                <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                    <div className="flex flex-wrap items-start justify-between gap-5"><div><h1 className="text-2xl font-bold text-white">Independent Contractor — North Carolina</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{form.scope}</p></div><span className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-200"><ShieldCheck className="h-4 w-4" />{provider.goodStanding ? "Good standing confirmed" : "Good standing unavailable"}</span></div>
                    <dl className="mt-6 grid gap-4 border-t border-slate-800 pt-5 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-xs uppercase text-slate-500">Provider</dt><dd className="mt-1 font-semibold">{provider.name}</dd></div><div><dt className="text-xs uppercase text-slate-500">Jurisdiction</dt><dd className="mt-1 font-semibold">{form.jurisdiction}</dd></div><div><dt className="text-xs uppercase text-slate-500">Versions</dt><dd className="mt-1 font-semibold">Form {form.formVersion}<br />Intake {form.intakeVersion}</dd></div><div><dt className="text-xs uppercase text-slate-500">Maintenance</dt><dd className="mt-1 font-semibold">{form.maintenanceStatus}</dd></div></dl>
                </section>

                {!loaded ? <section role="status" className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-300">{error || "Loading and decrypting the saved matter before intake editing is enabled…"}</section> : <>
                {gate.activeWarnings.length > 0 && <section role="alert" className="rounded-2xl border border-red-500/40 bg-red-500/10 p-5"><h2 className="flex items-center gap-2 font-bold text-red-200"><AlertTriangle className="h-5 w-5" />Generation blocked by active scope conditions</h2>{gate.activeWarnings.map((warning) => <p key={warning} className="mt-3 text-sm leading-6 text-red-100">{warning}</p>)}</section>}
                {auditHistory.some((event) => event.status === "resolved") && <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5"><h2 className="font-bold text-amber-100">Resolved scope events retained in matter history</h2>{auditHistory.filter((event) => event.status === "resolved").map((event) => <p key={event.id} className="mt-2 text-sm text-amber-100/80">Resolved {new Date(event.timestamp).toLocaleString()}: {event.message}</p>)}</section>}
                {consistencyChecks.length > 0 && <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6"><h2 className="text-lg font-bold">Pre-generation consistency checks</h2><div className="mt-4 space-y-3">{consistencyChecks.map((check, index) => <div key={`${check.code}-${check.partyId ?? index}`} role={check.classification === "BLOCKING" ? "alert" : undefined} className={`rounded-xl border p-4 ${check.classification === "BLOCKING" ? "border-red-500/40 bg-red-500/10 text-red-100" : check.classification === "CONFIRMATION_REQUIRED" ? "border-amber-500/30 bg-amber-500/10 text-amber-100" : check.classification === "AUTO_NORMALIZED" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100" : "border-indigo-500/30 bg-indigo-500/10 text-indigo-100"}`}><p className="text-xs font-bold tracking-wide">{check.classification}</p><p className="mt-1 text-sm">{check.message}</p></div>)}</div></section>}

                <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-lg font-bold">Canonical vault values</h2><p className="mt-1 text-sm text-slate-400">Authoritative parties, addresses, and signatories are projected from confirmed encrypted records.</p></div>{unconfirmedFields.length > 0 && <button onClick={confirmDisplayedSavedAnswers} className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-100">Confirm all displayed saved answers ({unconfirmedFields.length})</button>}</div>
                    <div className="mt-5 grid gap-3 md:grid-cols-2">{INDEPENDENT_CONTRACTOR_FIELDS.filter((field) => provenance[field.id] && canonicalFieldIds.has(field.id)).map((field) => <div key={field.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4"><p className="text-xs font-semibold uppercase text-slate-500">{field.label}</p><p className="mt-2 whitespace-pre-line font-semibold text-white">{answers[field.id] || "Blank execution date"}</p><span className="mt-3 inline-block rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs text-indigo-200">{provenance[field.id].classification}</span></div>)}</div>
                </section>

                <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6"><h2 className="text-lg font-bold">Scope and compensation confirmation</h2><p className="mt-2 text-sm text-slate-400">Scope, business description, and compensation are never supplied by demo defaults. Enter or visibly confirm them here.</p><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-xs font-semibold text-slate-300">Compensation structure<select aria-label="Compensation structure" value={answers.compensation_structure ?? ""} onChange={(event) => void updateAnswer("compensation_structure", event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm"><option value="">Select and confirm</option><option value="fixed-fee">Fixed fee</option><option value="hourly">Hourly compensation</option><option value="commissions">Commissions</option><option value="other-confirmed">Other expressly confirmed structure</option></select><span className="mt-2 block font-normal text-slate-500">The selected structure is rendered with the confirmed scope.</span></label><div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300"><p className="font-semibold">Selected treatment</p><p className="mt-2">{answers.compensation_structure ? answers.compensation_structure : "No compensation structure confirmed."}</p></div></div></section>

                <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6"><h2 className="text-lg font-bold">Scope checks</h2><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-xs font-semibold text-slate-300">Relationship characterization<select aria-label="Relationship characterization" value={answers.relationship_characterization ?? ""} onChange={(event) => void updateAnswer("relationship_characterization", event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm"><option value="">Select and confirm</option><option value="independent-contractor">Independent contractor</option><option value="employment">Employment</option></select></label><label className="text-xs font-semibold text-slate-300">Any minor party?<select aria-label="Any minor party" value={answers.includes_minor ?? ""} onChange={(event) => void updateAnswer("includes_minor", event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm"><option value="">Select and confirm</option><option value="no">No</option><option value="yes">Yes</option></select></label><label className="text-xs font-semibold text-slate-300">Forum state<input aria-label="Forum state" value={answers.forum_state ?? ""} onChange={(event) => void updateAnswer("forum_state", event.target.value)} placeholder="North Carolina" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" /></label><label className="text-xs font-semibold text-slate-300">Forum county<input aria-label="Forum county" value={answers.forum_county ?? ""} onChange={(event) => void updateAnswer("forum_county", event.target.value)} placeholder="Guilford County" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" /></label></div></section>

                <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6"><h2 className="text-lg font-bold">Visible intake and review fields</h2><p className="mt-2 text-sm text-slate-400">Every variable remains visible until it has approved canonical or current-intake provenance.</p><div className="mt-6 grid gap-5 md:grid-cols-2">{visibleFields.map((field) => <label key={field.id} className="block text-xs font-semibold text-slate-300">{field.label}{field.type === "textarea" ? <textarea aria-label={field.label} value={answers[field.id] ?? ""} onChange={(event) => void updateAnswer(field.id, event.target.value)} className="mt-2 min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" /> : <input aria-label={field.label} type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} value={answers[field.id] ?? ""} onChange={(event) => void updateAnswer(field.id, event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" />}<span className="mt-2 flex gap-2 text-xs font-normal leading-5 text-slate-500"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{field.whyWeAsk}</span>{answers[field.id] && <span className={`mt-2 inline-block rounded-full px-2 py-1 text-[11px] font-normal ${provenance[field.id] ? "bg-emerald-500/10 text-emerald-200" : "bg-amber-500/10 text-amber-200"}`}>{provenance[field.id]?.classification ?? "CONFIRMATION REQUIRED"}</span>}</label>)}</div></section>

                <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6"><h2 className="text-lg font-bold">Generation provenance review — 29 template tags</h2><p className="mt-2 text-sm text-slate-400">Generation is blocked until every row has one approved source classification.</p><div className="mt-5 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="uppercase text-slate-500"><tr><th className="pb-3">Tag</th><th className="pb-3">Rendered value</th><th className="pb-3">Classification</th><th className="pb-3">Source / transformation</th></tr></thead><tbody className="divide-y divide-slate-800">{INDEPENDENT_CONTRACTOR_FIELDS.map((field) => { const entry = prepared.report[field.id]; return <tr key={field.id}><td className="py-3 pr-3 font-mono text-indigo-200">{field.id}</td><td className="max-w-xs whitespace-pre-wrap py-3 pr-3 text-slate-200">{entry?.renderedValue || (field.id.endsWith("_date") && provenance[field.id] ? "Blank execution date" : "Missing")}</td><td className="py-3 pr-3"><span className={entry ? "text-emerald-300" : "text-red-300"}>{entry?.classification ?? "BLOCKED"}</span></td><td className="py-3 text-slate-400">{entry ? `${entry.sourceRecord}; ${entry.lastConfirmedAt}; ${entry.transformationApplied}` : "No approved provenance"}</td></tr>; })}</tbody></table></div></section>

                <section className="sticky bottom-4 rounded-2xl border border-slate-700 bg-slate-950/95 p-5 shadow-2xl backdrop-blur"><div className="flex flex-wrap items-center justify-between gap-4"><div>{gate.canRepresentAsApproved && prepared.missingValues.length === 0 && prepared.missingProvenance.length === 0 && consistencyBlocking.length === 0 ? <p className="flex items-center gap-2 text-sm font-bold text-emerald-300"><CheckCircle2 className="h-5 w-5" />Ready to generate with complete approved provenance</p> : <p className="text-sm text-slate-300">{gate.blockingConditions.length + consistencyBlocking.length} scope/data block(s); {prepared.missingValues.length} missing value(s); {prepared.missingProvenance.length} missing provenance record(s).</p>}{error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}</div><button onClick={handleGenerate} disabled={!loaded || isLocked || generating || !gate.canRepresentAsApproved || consistencyBlocking.length > 0 || prepared.missingValues.length > 0 || prepared.missingProvenance.length > 0} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40">{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}Generate maintained DOCX</button></div></section>
                </>}
            </div>
            <UnlockOverlay />
        </main>
    );
}

// Version history
// 20260714134800.0 - Added registry header, vault provenance, missing-only intake, scope audit, blocking, and maintained generation UI.
// 20260714134800.1 - Made demo fill preserve existing user answers while filling only blank values.
// 20260714134800.2 - Declared the merged answer map explicitly for strict indexed field access.
// 20260714134800.3 - Displayed classified canonical consistency checks and blocked generation for canonical data defects.
// 20260714134800.4 - Removed hidden defaults, restored visible confirmation fields, added compensation selection, and displayed all-29 generation provenance review.
// 20260714134800.5 - Serialized rapid intake updates through latest-state references and an ordered encrypted persistence queue.
// 20260714134800.6 - Ignored stale duplicate development-mode loads so they cannot overwrite newly confirmed intake values.
// 20260714134800.7 - Kept intake controls unavailable until encrypted matter loading finishes, preventing early edits from being overwritten.
