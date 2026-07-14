// ver 20260714141100.0

"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download, Save, Siren } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { UnlockOverlay } from "@/components/UnlockOverlay";
import { useVault } from "@/lib/VaultContext";
import { RECOURSE_DEMO_POLICY, createIncidentRecord } from "@/lib/recourse";
import { AssuranceRecord, IncidentRecord, getGeneration, saveIncident } from "@/lib/vault";

export default function RecoursePage() {
    const { generationId } = useParams<{ generationId: string }>();
    const { masterKey } = useVault();
    const [assurance, setAssurance] = useState<AssuranceRecord | null>(null);
    const [incident, setIncident] = useState<IncidentRecord | null>(null);
    const [whatHappened, setWhatHappened] = useState("");
    const [challenger, setChallenger] = useState("");
    const [dateOfFailure, setDateOfFailure] = useState("");
    const [evidence, setEvidence] = useState("");
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        if (masterKey && generationId) setAssurance(await getGeneration(generationId, masterKey));
    }, [generationId, masterKey]);
    useEffect(() => { void load(); }, [load]);

    const handleSave = async (event: FormEvent) => {
        event.preventDefault();
        if (!masterKey || !assurance) return;
        setError("");
        try {
            const record = createIncidentRecord(assurance, {
                whatHappened,
                whoRejectedOrChallenged: challenger,
                dateOfFailure,
                evidenceReferences: evidence.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
            });
            await saveIncident(record, masterKey);
            setIncident(record);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to save the incident.");
        }
    };

    const downloadIncident = async () => {
        if (!incident) return;
        const { saveAs } = await import("file-saver");
        saveAs(new Blob([JSON.stringify(incident, null, 2)], { type: "application/json" }), `${incident.id}.json`);
    };

    return (
        <main className="min-h-screen bg-[#0a0a0c] text-slate-100">
            <AppHeader />
            <div className="mx-auto max-w-4xl space-y-7 px-6 py-10">
                <section className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6"><h1 className="flex items-center gap-3 text-2xl font-bold text-red-100"><Siren className="h-7 w-7" />Document failure or challenge record</h1><p className="mt-3 text-sm leading-6 text-red-100/80">Capture what happened and bind it to the complete assurance record and document hash.</p></section>
                <section className="rounded-2xl border-2 border-amber-400/60 bg-amber-400/10 p-5"><p className="font-bold leading-6 text-amber-100">{RECOURSE_DEMO_POLICY}</p></section>
                {!assurance ? <p className="text-slate-400">Unlocking generation evidence…</p> : <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6"><h2 className="font-bold">Bound assurance evidence</h2><p className="mt-2 text-sm text-slate-400">Generation {assurance.generationId}</p><p className="mt-2 break-all font-mono text-xs text-indigo-200">{assurance.outputSha256}</p></section>}
                <form onSubmit={handleSave} className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                    <label className="block text-sm font-semibold">What happened?<textarea aria-label="What happened" required value={whatHappened} onChange={(event) => setWhatHappened(event.target.value)} className="mt-2 min-h-36 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm" /></label>
                    <label className="block text-sm font-semibold">Who rejected or challenged it?<input aria-label="Who rejected or challenged it" required value={challenger} onChange={(event) => setChallenger(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm" /></label>
                    <label className="block text-sm font-semibold">Date of failure<input aria-label="Date of failure" required type="date" value={dateOfFailure} onChange={(event) => setDateOfFailure(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm" /></label>
                    <label className="block text-sm font-semibold">Evidence references, one per line<textarea aria-label="Evidence references" value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Email dated…&#10;Case or ticket number…" className="mt-2 min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm" /></label>
                    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
                    <button type="submit" disabled={!assurance} className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold hover:bg-red-500 disabled:opacity-40"><Save className="h-4 w-4" />Save encrypted incident</button>
                </form>
                {incident && <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6"><h2 className="text-lg font-bold text-emerald-100">Incident record saved</h2><p className="mt-2 text-sm text-emerald-100/80">First response owner: {incident.firstResponseOwner}</p><p className="mt-3 text-sm text-emerald-100/80">Illustrated remedy path: support intake → evidence review → correction or reissue review → refund/credit review → provider escalation → independent counsel.</p><button onClick={downloadIncident} className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-500"><Download className="h-4 w-4" />Download incident record</button></section>}
            </div>
            <UnlockOverlay />
        </main>
    );
}

// Version history
// 20260714141100.0 - Added live encrypted incident capture, bound generation evidence, remedy disclosure, and portable JSON download.
