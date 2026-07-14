// ver 20260714134000.0

"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Edit3, Link2, Plus, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { UnlockOverlay } from "@/components/UnlockOverlay";
import { useVault } from "@/lib/VaultContext";
import {
    AssuranceRecord,
    Party,
    Relationship,
    VaultFact,
    createVaultId,
    listFacts,
    listGenerations,
    listParties,
    listRelationships,
    saveFact,
    saveParty,
    saveRelationship,
} from "@/lib/vault";

const emptyParty = (): Party => ({ id: "", kind: "person", name: "", address1: "", address2: "", createdAt: "" });
const BOUNDARY = "Demo mode: all of your information is stored and encrypted-at-rest in this browser only (IndexedDB + WebCrypto). Nothing you type is transmitted to any server.";

export default function VaultPage() {
    const { masterKey, isLocked } = useVault();
    const [parties, setParties] = useState<Party[]>([]);
    const [relationships, setRelationships] = useState<Relationship[]>([]);
    const [facts, setFacts] = useState<VaultFact[]>([]);
    const [generations, setGenerations] = useState<AssuranceRecord[]>([]);
    const [partyDraft, setPartyDraft] = useState<Party>(emptyParty());
    const [fromPartyId, setFromPartyId] = useState("");
    const [toPartyId, setToPartyId] = useState("");
    const [notice, setNotice] = useState("");

    const reload = useCallback(async () => {
        if (!masterKey) return;
        const [nextParties, nextRelationships, nextFacts, nextGenerations] = await Promise.all([
            listParties(masterKey),
            listRelationships(),
            listFacts(masterKey),
            listGenerations(masterKey),
        ]);
        setParties(nextParties);
        setRelationships(nextRelationships);
        setFacts(nextFacts);
        setGenerations(nextGenerations.sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
    }, [masterKey]);

    useEffect(() => { void reload(); }, [reload]);

    const handlePartySave = async (event: FormEvent) => {
        event.preventDefault();
        if (!masterKey) return;
        const now = new Date().toISOString();
        const party: Party = { ...partyDraft, id: partyDraft.id || createVaultId("party"), createdAt: partyDraft.createdAt || now };
        await saveParty(party, masterKey);
        const mappings = party.kind === "business"
            ? [["owner_name", party.name], ["owner_add1", party.address1], ["owner_add2", party.address2]]
            : [["contractor_name", party.name], ["contr_add1", party.address1], ["contr_add2", party.address2]];
        for (const [fieldId, value] of mappings) {
            await saveFact({ id: `${party.id}:${fieldId}`, partyId: party.id, fieldId, value, source: "user-entered", lastConfirmedAt: now, notes: "Created from the party record." }, masterKey);
        }
        setPartyDraft(emptyParty());
        setNotice(`${party.name} and its reusable facts were encrypted and saved locally.`);
        await reload();
    };

    const handleRelationshipSave = async (event: FormEvent) => {
        event.preventDefault();
        if (!fromPartyId || !toPartyId) return;
        await saveRelationship({ id: createVaultId("relationship"), fromPartyId, toPartyId, type: "company-contractor", createdAt: new Date().toISOString() });
        setNotice("Company-contractor relationship saved locally.");
        await reload();
    };

    const updateFactValue = async (fact: VaultFact, value: string) => {
        if (!masterKey) return;
        await saveFact({ ...fact, value, source: "user-entered", lastConfirmedAt: new Date().toISOString() }, masterKey);
        await reload();
    };

    const partyName = (id: string) => parties.find((party) => party.id === id)?.name ?? id;

    return (
        <main className="min-h-screen bg-[#0a0a0c] text-slate-100">
            <AppHeader />
            <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
                <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                    <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /><p className="text-sm font-semibold leading-6 text-emerald-100">{BOUNDARY}</p></div>
                </section>
                <header>
                    <h1 className="text-3xl font-bold text-white">Reusable encrypted vault</h1>
                    <p className="mt-2 text-sm text-slate-400">Create parties first. Their names and addresses become reusable, encrypted facts for the workflow.</p>
                    {notice && <p role="status" className="mt-3 text-sm text-indigo-300">{notice}</p>}
                </header>

                <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
                    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                        <h2 className="flex items-center gap-2 text-lg font-bold"><Plus className="h-5 w-5 text-indigo-300" />{partyDraft.id ? "Edit party" : "Add a party"}</h2>
                        <form onSubmit={handlePartySave} className="mt-5 space-y-4">
                            <label className="block text-xs font-semibold text-slate-300">Party kind<select aria-label="Party kind" value={partyDraft.kind} onChange={(event) => setPartyDraft({ ...partyDraft, kind: event.target.value as Party["kind"] })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm"><option value="person">Person</option><option value="business">Business</option></select></label>
                            <label className="block text-xs font-semibold text-slate-300">Legal name<input aria-label="Legal name" required value={partyDraft.name} onChange={(event) => setPartyDraft({ ...partyDraft, name: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" /></label>
                            <label className="block text-xs font-semibold text-slate-300">Address line 1<input aria-label="Address line 1" required value={partyDraft.address1} onChange={(event) => setPartyDraft({ ...partyDraft, address1: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" /></label>
                            <label className="block text-xs font-semibold text-slate-300">Address line 2<input aria-label="Address line 2" required value={partyDraft.address2} onChange={(event) => setPartyDraft({ ...partyDraft, address2: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" /></label>
                            <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold hover:bg-indigo-500"><Save className="h-4 w-4" />Save encrypted party</button>
                        </form>
                    </section>

                    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                        <h2 className="text-lg font-bold">Parties</h2>
                        <div className="mt-5 space-y-3">
                            {parties.length === 0 && <p className="rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-500">No parties yet.</p>}
                            {parties.map((party) => <div key={party.id} className="flex items-start justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-4"><div><p className="font-bold text-white">{party.name}</p><p className="mt-1 text-xs uppercase tracking-wide text-indigo-300">{party.kind}</p><p className="mt-2 text-sm text-slate-400">{party.address1}<br />{party.address2}</p></div><button aria-label={`Edit ${party.name}`} onClick={() => setPartyDraft(party)} className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-white"><Edit3 className="h-4 w-4" /></button></div>)}
                        </div>
                    </section>
                </div>

                <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                    <h2 className="flex items-center gap-2 text-lg font-bold"><Link2 className="h-5 w-5 text-indigo-300" />Company-contractor relationship</h2>
                    <form onSubmit={handleRelationshipSave} className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
                        <select aria-label="Company" required value={fromPartyId} onChange={(event) => setFromPartyId(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm"><option value="">Select business</option>{parties.filter((party) => party.kind === "business").map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}</select>
                        <select aria-label="Contractor" required value={toPartyId} onChange={(event) => setToPartyId(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm"><option value="">Select contractor</option>{parties.filter((party) => party.kind === "person").map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}</select>
                        <button type="submit" className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold hover:bg-indigo-500">Relate parties</button>
                    </form>
                    <div className="mt-4 space-y-2">{relationships.map((relationship) => <p key={relationship.id} className="rounded-lg bg-slate-950 px-4 py-3 text-sm text-slate-300">{partyName(relationship.fromPartyId)} <span className="text-indigo-300">company-contractor</span> {partyName(relationship.toPartyId)}</p>)}</div>
                </section>

                <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                    <h2 className="text-lg font-bold">Reusable facts</h2>
                    <p className="mt-2 text-sm text-slate-400">Each row shows the decrypted value in the unlocked UI, its provenance, confirmation time, and workflow role.</p>
                    <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="pb-3">Field / role</th><th className="pb-3">Value</th><th className="pb-3">Source</th><th className="pb-3">Last confirmed</th></tr></thead><tbody className="divide-y divide-slate-800">{facts.map((fact) => <tr key={fact.id}><td className="py-4 pr-4"><p className="font-semibold text-white">{fact.fieldId}</p><p className="text-xs text-indigo-300">Independent Contractor intake</p></td><td className="py-4 pr-4"><input aria-label={`Fact ${fact.fieldId}`} defaultValue={fact.value} onBlur={(event) => { if (event.target.value !== fact.value) void updateFactValue(fact, event.target.value); }} className="min-w-52 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" /></td><td className="py-4 pr-4 text-slate-400">{fact.source}</td><td className="py-4 text-slate-400">{new Date(fact.lastConfirmedAt).toLocaleString()}</td></tr>)}</tbody></table></div>
                </section>

                <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                    <h2 className="text-lg font-bold">Generations</h2>
                    <div className="mt-4 space-y-3">{generations.length === 0 && <p className="text-sm text-slate-500">No assurance records yet.</p>}{generations.map((generation) => <div key={generation.generationId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4"><div><p className="font-semibold text-white">{generation.fileName}</p><p className="mt-1 font-mono text-xs text-slate-500">{generation.outputSha256}</p></div><div className="flex gap-2"><Link href={`/confirmation/${generation.generationId}`} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold">Assurance</Link><Link href="/workflow/independent-contractor?regenerate=1" className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold"><RefreshCw className="h-3.5 w-3.5" />Regenerate</Link></div></div>)}</div>
                </section>
            </div>
            <UnlockOverlay />
        </main>
    );
}

// Version history
// 20260714134000.0 - Added encrypted party, relationship, reusable-fact, provenance, and generation vault UI.
