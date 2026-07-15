// ver 20260714134800.3

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
    updateScopeAudit,
} from "@/lib/workflow";
import { MatterAuditEvent } from "@/lib/vault";
import { ConsistencyResult } from "@/lib/canonical";

const reusableFieldIds = new Set(["owner_name", "owner_add1", "owner_add2", "contractor_name", "contr_add1", "contr_add2"]);

const demoDefaults: Record<string, string> = {
    owner_business_description: "Manufacture and sell commercial widgets.",
    scope_agr_longtext: "Provide independent product-design consulting and written recommendations for the owner's widget catalog.",
    agreement_start_date: "2026-07-14",
    agreement_duration_years_text: "One",
    agreement_duration_years_num: "1",
    termination_notice_days: "30",
    forum_state: "North Carolina",
    forum_county: "Guilford County",
    forum_county_comma_state: "Guilford County, North Carolina",
    arbitration_city: "Greensboro",
    arbitration_state: "North Carolina",
    court_amended_miles: "25",
    court_amended_years: "1",
    hire_away_duration_years_num: "1",
    hire_away_duration_years_text: "One",
    non_compete_duration_years_num: "1",
    non_compete_duration_years_text: "One",
    non_compete_radius_miles: "25",
    non_compete_states: "North Carolina",
    non_solicit_employees_duration_years_num: "1",
    non_solicit_employees_duration_years_text: "One",
    owner_signatory_name: "Alex Morgan",
    owner_signatory_date: "2026-07-14",
    contractor_signatory_name: "Jane Q. Contractor",
    contractor_signatory_date: "2026-07-14",
    relationship_characterization: "independent-contractor",
    includes_minor: "no",
};

export default function IndependentContractorWorkflow() {
    const { masterKey, isLocked } = useVault();
    const router = useRouter();
    const form = getForm("independent-contractor-nc");
    const provider = getProvider(form.providerId);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [provenance, setProvenance] = useState<Record<string, string>>({});
    const [auditHistory, setAuditHistory] = useState<MatterAuditEvent[]>([]);
    const [baseConsistencyChecks, setBaseConsistencyChecks] = useState<ConsistencyResult[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        if (!masterKey) return;
        const state = await loadWorkflowState(masterKey);
        setAnswers(state.answers);
        setProvenance(state.provenance);
        setAuditHistory(state.matter.auditHistory);
        setBaseConsistencyChecks(state.consistencyChecks);
        setLoaded(true);
    }, [masterKey]);

    useEffect(() => { void load(); }, [load]);

    const gate = useMemo(() => getWorkflowGate(answers), [answers]);
    const mergedAnswers = useMemo<Record<string, string>>(() => ({
        ...answers,
        forum_county_comma_state: answers.forum_county && answers.forum_state ? `${answers.forum_county}, ${answers.forum_state}` : answers.forum_county_comma_state ?? "",
    }), [answers]);
    const missing = INDEPENDENT_CONTRACTOR_FIELDS.filter((field) => !mergedAnswers[field.id]?.trim()).map((field) => field.id);
    const visibleFields = INDEPENDENT_CONTRACTOR_FIELDS.filter((field) => field.id !== "forum_county_comma_state" && (!reusableFieldIds.has(field.id) || !provenance[field.id]));
    const consistencyChecks = useMemo(() => {
        const withoutDescriptionCheck = baseConsistencyChecks.filter((check) => check.code !== "DBA_EMBEDDED_IN_DESCRIPTION");
        return /\b(?:d\/?b\/?a|dba|doing business as)\b/i.test(answers.owner_business_description ?? "")
            ? [...withoutDescriptionCheck, { code: "DBA_EMBEDDED_IN_DESCRIPTION", classification: "CONFIRMATION_REQUIRED" as const, message: "DBA language appears in the business-description field; use the separate trade-name record instead." }]
            : withoutDescriptionCheck;
    }, [answers.owner_business_description, baseConsistencyChecks]);
    const consistencyBlocking = consistencyChecks.filter((check) => check.classification === "BLOCKING");

    const persist = async (nextAnswers: Record<string, string>, nextAudit: MatterAuditEvent[]) => {
        if (!masterKey) return;
        await persistMatter(masterKey, nextAnswers, nextAudit);
    };

    const updateAnswer = async (fieldId: string, value: string) => {
        let nextAnswers = { ...answers, [fieldId]: value };
        if (fieldId === "forum_state" || fieldId === "forum_county") {
            const state = fieldId === "forum_state" ? value : nextAnswers.forum_state;
            const county = fieldId === "forum_county" ? value : nextAnswers.forum_county;
            nextAnswers = { ...nextAnswers, forum_county_comma_state: state && county ? `${county}, ${state}` : "" };
        }
        let nextAudit = auditHistory;
        if (fieldId === "forum_state") nextAudit = updateScopeAudit(nextAudit, "OUT_OF_STATE_FORUM", `Out-of-North-Carolina forum encountered. ${OUT_OF_SCOPE_MESSAGE}`, value.trim().toLowerCase() !== "north carolina");
        if (fieldId === "arbitration_state") nextAudit = updateScopeAudit(nextAudit, "OUT_OF_STATE_ARBITRATION", `Out-of-North-Carolina arbitration state encountered. ${OUT_OF_SCOPE_MESSAGE}`, value.trim().toLowerCase() !== "north carolina");
        if (fieldId === "relationship_characterization") nextAudit = updateScopeAudit(nextAudit, "EMPLOYMENT_RELATIONSHIP", `Employment characterization encountered. ${OUT_OF_SCOPE_MESSAGE}`, value === "employment");
        setAnswers(nextAnswers);
        setAuditHistory(nextAudit);
        setProvenance((current) => ({ ...current, [fieldId]: "transaction-specific user entry" }));
        await persist(nextAnswers, nextAudit);
    };

    const fillDemoValues = async () => {
        const nextAnswers = { ...answers };
        for (const [fieldId, value] of Object.entries(demoDefaults)) {
            if (!nextAnswers[fieldId]?.trim()) nextAnswers[fieldId] = value;
        }
        if (!nextAnswers.contractor_signatory_name && nextAnswers.contractor_name) nextAnswers.contractor_signatory_name = nextAnswers.contractor_name;
        setAnswers(nextAnswers);
        setProvenance((current) => ({ ...Object.fromEntries(Object.keys(demoDefaults).map((fieldId) => [fieldId, "transaction-specific demo entry"])), ...current }));
        await persist(nextAnswers, auditHistory);
    };

    const handleGenerate = async () => {
        if (!masterKey) return;
        setGenerating(true);
        setError("");
        try {
            const result = await generateWorkflowDocument(masterKey, mergedAnswers, provenance, auditHistory, true);
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

                {gate.activeWarnings.length > 0 && <section role="alert" className="rounded-2xl border border-red-500/40 bg-red-500/10 p-5"><h2 className="flex items-center gap-2 font-bold text-red-200"><AlertTriangle className="h-5 w-5" />Generation blocked by active scope conditions</h2>{gate.activeWarnings.map((warning) => <p key={warning} className="mt-3 text-sm leading-6 text-red-100">{warning}</p>)}</section>}

                {auditHistory.some((event) => event.status === "resolved") && <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5"><h2 className="font-bold text-amber-100">Resolved scope events retained in matter history</h2>{auditHistory.filter((event) => event.status === "resolved").map((event) => <p key={event.id} className="mt-2 text-sm text-amber-100/80">Resolved {new Date(event.timestamp).toLocaleString()}: {event.message}</p>)}</section>}

                {consistencyChecks.length > 0 && <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6"><h2 className="text-lg font-bold">Pre-generation consistency checks</h2><p className="mt-2 text-sm text-slate-400">Canonical party, address, trade-name, notice, and signatory records are checked before the unchanged DOCX tags are merged.</p><div className="mt-4 space-y-3">{consistencyChecks.map((check, index) => <div key={`${check.code}-${check.partyId ?? index}`} role={check.classification === "BLOCKING" ? "alert" : undefined} className={`rounded-xl border p-4 ${check.classification === "BLOCKING" ? "border-red-500/40 bg-red-500/10 text-red-100" : check.classification === "CONFIRMATION_REQUIRED" ? "border-amber-500/30 bg-amber-500/10 text-amber-100" : check.classification === "AUTO_NORMALIZED" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100" : "border-indigo-500/30 bg-indigo-500/10 text-indigo-100"}`}><p className="text-xs font-bold tracking-wide">{check.classification}</p><p className="mt-1 text-sm">{check.message}</p></div>)}</div></section>}

                <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-lg font-bold">Vault-prefilled values</h2><p className="mt-1 text-sm text-slate-400">These are reused from encrypted facts and are not asked again.</p></div><button onClick={fillDemoValues} className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-4 py-2 text-sm font-bold text-indigo-200 hover:bg-indigo-500/20">Fill remaining demo values</button></div>
                    <div className="mt-5 grid gap-3 md:grid-cols-2">{INDEPENDENT_CONTRACTOR_FIELDS.filter((field) => provenance[field.id] && reusableFieldIds.has(field.id)).map((field) => <div key={field.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4"><p className="text-xs font-semibold uppercase text-slate-500">{field.label}</p><p className="mt-2 font-semibold text-white">{answers[field.id]}</p><span className="mt-3 inline-block rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs text-indigo-200">{provenance[field.id]}</span></div>)}</div>
                </section>

                <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                    <h2 className="text-lg font-bold">Scope checks</h2>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <label className="text-xs font-semibold text-slate-300">Relationship characterization<select aria-label="Relationship characterization" value={answers.relationship_characterization ?? "independent-contractor"} onChange={(event) => void updateAnswer("relationship_characterization", event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm"><option value="independent-contractor">Independent contractor</option><option value="employment">Employment</option></select></label>
                        <label className="text-xs font-semibold text-slate-300">Any minor party?<select aria-label="Any minor party" value={answers.includes_minor ?? "no"} onChange={(event) => void updateAnswer("includes_minor", event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm"><option value="no">No</option><option value="yes">Yes</option></select></label>
                        <label className="text-xs font-semibold text-slate-300">Forum state<input aria-label="Forum state" value={answers.forum_state ?? ""} onChange={(event) => void updateAnswer("forum_state", event.target.value)} placeholder="North Carolina" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" /><span className="mt-2 block text-xs font-normal text-slate-500">State only. This maintained demo supports North Carolina.</span></label>
                        <label className="text-xs font-semibold text-slate-300">Forum county<input aria-label="Forum county" value={answers.forum_county ?? ""} onChange={(event) => void updateAnswer("forum_county", event.target.value)} placeholder="Guilford County" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" /><span className="mt-2 block text-xs font-normal text-slate-500">County is stored separately and merged as {mergedAnswers.forum_county_comma_state || "County, State"}.</span></label>
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                    <h2 className="text-lg font-bold">Missing and transaction-specific values</h2>
                    <p className="mt-2 text-sm text-slate-400">Reusable values already supplied by the vault are omitted. Consequential fields explain why they are requested.</p>
                    <div className="mt-6 grid gap-5 md:grid-cols-2">{visibleFields.map((field) => <label key={field.id} className="block text-xs font-semibold text-slate-300">{field.label}{field.type === "textarea" ? <textarea aria-label={field.label} value={answers[field.id] ?? ""} onChange={(event) => void updateAnswer(field.id, event.target.value)} className="mt-2 min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" /> : <input aria-label={field.label} type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} value={answers[field.id] ?? ""} onChange={(event) => void updateAnswer(field.id, event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" />}<span className="mt-2 flex gap-2 text-xs font-normal leading-5 text-slate-500"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{field.whyWeAsk}</span>{answers[field.id] && <span className="mt-2 inline-block rounded-full bg-slate-800 px-2 py-1 text-[11px] font-normal text-slate-300">{provenance[field.id] ?? "transaction-specific user entry"}</span>}</label>)}</div>
                </section>

                <section className="sticky bottom-4 rounded-2xl border border-slate-700 bg-slate-950/95 p-5 shadow-2xl backdrop-blur"><div className="flex flex-wrap items-center justify-between gap-4"><div>{gate.canRepresentAsApproved && missing.length === 0 && consistencyBlocking.length === 0 ? <p className="flex items-center gap-2 text-sm font-bold text-emerald-300"><CheckCircle2 className="h-5 w-5" />Ready to generate a maintained demo output</p> : <p className="text-sm text-slate-300">{gate.blockingConditions.length + consistencyBlocking.length} blocking condition(s); {missing.length} required template field(s) missing.</p>}{error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}</div><button onClick={handleGenerate} disabled={!loaded || isLocked || generating || !gate.canRepresentAsApproved || consistencyBlocking.length > 0 || missing.length > 0} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40">{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}Generate maintained DOCX</button></div></section>
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
