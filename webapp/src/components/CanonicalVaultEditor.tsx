// ver 20260715105000.3

"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Edit3, Save, UserCheck } from "lucide-react";
import {
    AddressRecord,
    BusinessRecord,
    CanonicalParty,
    PersonRecord,
    SignatoryRecord,
    formatAddressProjection,
    makeProvenance,
    normalizeUnitedStatesState,
} from "@/lib/canonical";
import {
    Party,
    createVaultId,
    getCanonicalSnapshot,
    saveAddress,
    saveBusiness,
    saveCanonicalParty,
    saveFact,
    saveParty,
    savePerson,
    saveSignatory,
} from "@/lib/vault";

interface CanonicalVaultEditorProps {
    masterKey: CryptoKey;
    onChanged: (message: string) => Promise<void>;
}

interface PartyDraft {
    partyId: string;
    recordId: string;
    addressId: string;
    kind: "person" | "business";
    fullLegalName: string;
    honorificPrefix: string;
    givenName: string;
    middleNameOrInitial: string;
    familyName: string;
    generationalSuffix: string;
    professionalDesignation: string;
    preferredDisplayName: string;
    legalName: string;
    entityType: string;
    jurisdictionOfOrganization: string;
    tradeNameOrDba: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    stateOrProvince: string;
    postalCode: string;
    country: string;
    county: string;
    createdAt: string;
}

const emptyDraft = (): PartyDraft => ({
    partyId: "", recordId: "", addressId: "", kind: "person", fullLegalName: "", honorificPrefix: "", givenName: "", middleNameOrInitial: "", familyName: "", generationalSuffix: "", professionalDesignation: "", preferredDisplayName: "", legalName: "", entityType: "", jurisdictionOfOrganization: "", tradeNameOrDba: "", addressLine1: "", addressLine2: "", city: "", stateOrProvince: "", postalCode: "", country: "United States", county: "", createdAt: "",
});

export function CanonicalVaultEditor({ masterKey, onChanged }: CanonicalVaultEditorProps) {
    const [draft, setDraft] = useState<PartyDraft>(emptyDraft());
    const [parties, setParties] = useState<CanonicalParty[]>([]);
    const [persons, setPersons] = useState<PersonRecord[]>([]);
    const [businesses, setBusinesses] = useState<BusinessRecord[]>([]);
    const [addresses, setAddresses] = useState<AddressRecord[]>([]);
    const [signatories, setSignatories] = useState<SignatoryRecord[]>([]);
    const [signatoryPartyId, setSignatoryPartyId] = useState("");
    const [signatoryPersonId, setSignatoryPersonId] = useState("");
    const [enteredSignatoryName, setEnteredSignatoryName] = useState("");
    const [titleOrCapacity, setTitleOrCapacity] = useState("");
    const [authorityConfirmed, setAuthorityConfirmed] = useState(false);
    const [signatureDate, setSignatureDate] = useState("");

    const reload = useCallback(async () => {
        const snapshot = await getCanonicalSnapshot(masterKey);
        setParties(snapshot.parties);
        setPersons(snapshot.persons);
        setBusinesses(snapshot.businesses);
        setAddresses(snapshot.addresses);
        setSignatories(snapshot.signatories);
    }, [masterKey]);

    useEffect(() => { void reload(); }, [reload]);

    const names = useMemo(() => new Map(parties.map((party) => [party.id, party.kind === "person" ? persons.find((person) => person.id === party.personId)?.fullLegalName ?? party.id : businesses.find((business) => business.id === party.businessId)?.legalName ?? party.id])), [businesses, parties, persons]);

    const editParty = (party: CanonicalParty) => {
        const person = persons.find((item) => item.id === party.personId);
        const business = businesses.find((item) => item.id === party.businessId);
        const addressId = person?.addressId ?? business?.principalAddressId ?? "";
        const address = addresses.find((item) => item.id === addressId);
        setDraft({
            ...emptyDraft(), partyId: party.id, recordId: person?.id ?? business?.id ?? "", addressId, kind: party.kind, createdAt: party.createdAt,
            fullLegalName: person?.fullLegalName ?? "", honorificPrefix: person?.honorificPrefix ?? "", givenName: person?.givenName ?? "", middleNameOrInitial: person?.middleNameOrInitial ?? "", familyName: person?.familyName ?? "", generationalSuffix: person?.generationalSuffix ?? "", professionalDesignation: person?.professionalDesignation ?? "", preferredDisplayName: person?.preferredDisplayName ?? "",
            legalName: business?.legalName ?? "", entityType: business?.entityType ?? "", jurisdictionOfOrganization: business?.jurisdictionOfOrganization ?? "", tradeNameOrDba: business?.tradeNameOrDba ?? "",
            addressLine1: address?.addressLine1 ?? "", addressLine2: address?.addressLine2 ?? "", city: address?.city ?? "", stateOrProvince: address?.stateOrProvince ?? "", postalCode: address?.postalCode ?? "", country: address?.country ?? "United States", county: address?.county ?? "",
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handlePartySave = async (event: FormEvent) => {
        event.preventDefault();
        const now = new Date().toISOString();
        const partyId = draft.partyId || createVaultId("party");
        const addressId = draft.addressId || createVaultId("address");
        const recordId = draft.recordId || createVaultId(draft.kind);
        const normalizedState = normalizeUnitedStatesState(draft.stateOrProvince);
        const baseProvenance = makeProvenance("user-entered", now, "Entered directly in the canonical vault editor.");
        const stateProvenance = normalizedState.normalized ? makeProvenance("normalized-deterministically", now, `${draft.stateOrProvince.trim()} normalized to ${normalizedState.value}.`) : baseProvenance;
        const address: AddressRecord = {
            id: addressId, addressLine1: draft.addressLine1.trim(), addressLine2: draft.addressLine2.trim() || undefined, city: draft.city.trim(), stateOrProvince: normalizedState.value, postalCode: draft.postalCode.trim(), country: draft.country.trim() || "United States", county: draft.county.trim() || undefined, structuredStatus: "complete",
            fieldProvenance: { addressLine1: baseProvenance, addressLine2: baseProvenance, city: baseProvenance, stateOrProvince: stateProvenance, postalCode: baseProvenance, country: baseProvenance, county: baseProvenance }, createdAt: draft.createdAt || now, updatedAt: now,
        };
        await saveAddress(address, masterKey);
        const canonicalParty: CanonicalParty = { id: partyId, kind: draft.kind, createdAt: draft.createdAt || now, provenance: "user-entered" };
        let displayName: string;
        if (draft.kind === "person") {
            const person: PersonRecord = {
                id: recordId, fullLegalName: draft.fullLegalName.trim(), honorificPrefix: draft.honorificPrefix.trim() || undefined, givenName: draft.givenName.trim() || undefined, middleNameOrInitial: draft.middleNameOrInitial.trim() || undefined, familyName: draft.familyName.trim() || undefined, generationalSuffix: draft.generationalSuffix.trim() || undefined, professionalDesignation: draft.professionalDesignation.trim() || undefined, preferredDisplayName: draft.preferredDisplayName.trim() || undefined, addressId, legacyNameUnresolved: false,
                fieldProvenance: Object.fromEntries(["fullLegalName", "honorificPrefix", "givenName", "middleNameOrInitial", "familyName", "generationalSuffix", "professionalDesignation", "preferredDisplayName"].map((field) => [field, baseProvenance])), createdAt: draft.createdAt || now, updatedAt: now,
            };
            await savePerson(person, masterKey);
            canonicalParty.personId = recordId;
            displayName = person.fullLegalName;
        } else {
            const business: BusinessRecord = {
                id: recordId, legalName: draft.legalName.trim(), entityType: draft.entityType.trim() || undefined, jurisdictionOfOrganization: draft.jurisdictionOfOrganization.trim() || undefined, tradeNameOrDba: draft.tradeNameOrDba.trim() || undefined, principalAddressId: addressId,
                fieldProvenance: Object.fromEntries(["legalName", "entityType", "jurisdictionOfOrganization", "tradeNameOrDba", "principalAddressId"].map((field) => [field, baseProvenance])), createdAt: draft.createdAt || now, updatedAt: now,
            };
            await saveBusiness(business, masterKey);
            canonicalParty.businessId = recordId;
            displayName = business.legalName;
        }
        await saveCanonicalParty(canonicalParty, masterKey);
        const projected = formatAddressProjection(address);
        const adapter: Party = { id: partyId, kind: draft.kind, name: displayName, address1: projected.line1, address2: projected.line2, createdAt: draft.createdAt || now };
        await saveParty(adapter, masterKey);
        const mappings = draft.kind === "business" ? [["owner_name", displayName], ["owner_add1", projected.line1], ["owner_add2", projected.line2]] : [["contractor_name", displayName], ["contr_add1", projected.line1], ["contr_add2", projected.line2]];
        for (const [fieldId, value] of mappings) await saveFact({ id: `${partyId}:${fieldId}`, partyId, fieldId, value, source: "normalized-deterministically", lastConfirmedAt: now, notes: "Projected from canonical encrypted vault records." }, masterKey);
        setDraft(emptyDraft());
        await reload();
        await onChanged(`${displayName} was saved as canonical encrypted records. ${normalizedState.normalized ? `${draft.stateOrProvince.trim()} was normalized to ${normalizedState.value}.` : ""}`.trim());
    };

    const handleSignatorySave = async (event: FormEvent) => {
        event.preventDefault();
        const now = new Date().toISOString();
        const provenance = makeProvenance("user-entered", now, "Entered directly in the canonical signatory editor.");
        const existing = signatories.find((signatory) => signatory.partyId === signatoryPartyId);
        await saveSignatory({ id: existing?.id ?? `signatory-${signatoryPartyId}`, partyId: signatoryPartyId, personId: signatoryPersonId || undefined, enteredSignatoryName: signatoryPersonId ? undefined : enteredSignatoryName.trim() || undefined, titleOrCapacity: titleOrCapacity.trim(), authorityConfirmed, signatureDate, fieldProvenance: Object.fromEntries(["partyId", "personId", "enteredSignatoryName", "titleOrCapacity", "authorityConfirmed", "signatureDate"].map((field) => [field, provenance])), createdAt: existing?.createdAt ?? now, updatedAt: now }, masterKey);
        setSignatoryPartyId(""); setSignatoryPersonId(""); setEnteredSignatoryName(""); setTitleOrCapacity(""); setAuthorityConfirmed(false); setSignatureDate("");
        await reload();
        await onChanged("Encrypted signatory record saved. Pre-generation checks will require a title when this person signs for a business.");
    };

    const editSignatory = (signatory: SignatoryRecord) => {
        setSignatoryPartyId(signatory.partyId);
        setSignatoryPersonId(signatory.personId ?? "");
        setEnteredSignatoryName(signatory.enteredSignatoryName ?? "");
        setTitleOrCapacity(signatory.titleOrCapacity);
        setAuthorityConfirmed(signatory.authorityConfirmed);
        setSignatureDate(signatory.signatureDate);
    };

    return <>
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                <h2 className="text-lg font-bold">{draft.partyId ? "Edit canonical party" : "Add a canonical party"}</h2>
                <form onSubmit={handlePartySave} className="mt-5 space-y-5">
                    <label className="block text-xs font-semibold text-slate-300">Party kind<select aria-label="Party kind" value={draft.kind} onChange={(event) => setDraft({ ...emptyDraft(), kind: event.target.value as PartyDraft["kind"] })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm"><option value="person">Person</option><option value="business">Business</option></select></label>
                    {draft.kind === "person" ? <div className="grid gap-4 md:grid-cols-2">
                        <label className="md:col-span-2 text-xs font-semibold text-slate-300">Full legal name — authoritative<input aria-label="Full legal name" required value={draft.fullLegalName} onChange={(event) => setDraft({ ...draft, fullLegalName: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" /></label>
                        {[["Honorific prefix", "honorificPrefix"], ["Given name", "givenName"], ["Middle name or initial", "middleNameOrInitial"], ["Family name", "familyName"], ["Generational suffix", "generationalSuffix"], ["Professional designation", "professionalDesignation"], ["Preferred display name", "preferredDisplayName"]].map(([label, key]) => <label key={key} className="text-xs font-semibold text-slate-300">{label}<input aria-label={label} value={String(draft[key as keyof PartyDraft])} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" /></label>)}
                    </div> : <div className="grid gap-4 md:grid-cols-2">
                        <label className="md:col-span-2 text-xs font-semibold text-slate-300">Business legal name<input aria-label="Business legal name" required value={draft.legalName} onChange={(event) => setDraft({ ...draft, legalName: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" /></label>
                        <label className="text-xs font-semibold text-slate-300">Entity type<input aria-label="Entity type" value={draft.entityType} onChange={(event) => setDraft({ ...draft, entityType: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" /></label>
                        <label className="text-xs font-semibold text-slate-300">Jurisdiction of organization<input aria-label="Jurisdiction of organization" value={draft.jurisdictionOfOrganization} onChange={(event) => setDraft({ ...draft, jurisdictionOfOrganization: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" /></label>
                        <label className="md:col-span-2 text-xs font-semibold text-slate-300">Trade name or DBA<input aria-label="Trade name or DBA" value={draft.tradeNameOrDba} onChange={(event) => setDraft({ ...draft, tradeNameOrDba: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" /><span className="mt-2 block font-normal text-slate-500">Stored separately; never substituted for the legal entity name.</span></label>
                    </div>}
                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="text-xs font-semibold text-slate-300">Address line 1<input aria-label="Address line 1" required value={draft.addressLine1} onChange={(event) => setDraft({ ...draft, addressLine1: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" /></label>
                        <label className="text-xs font-semibold text-slate-300">Address line 2 — optional<input aria-label="Address line 2" value={draft.addressLine2} onChange={(event) => setDraft({ ...draft, addressLine2: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" /></label>
                        <label className="text-xs font-semibold text-slate-300">City<input aria-label="City" required value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" /></label>
                        <label className="text-xs font-semibold text-slate-300">State or province<input aria-label="State or province" required value={draft.stateOrProvince} onChange={(event) => setDraft({ ...draft, stateOrProvince: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" /></label>
                        <label className="text-xs font-semibold text-slate-300">Postal code<input aria-label="Postal code" required value={draft.postalCode} onChange={(event) => setDraft({ ...draft, postalCode: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" /></label>
                        <label className="text-xs font-semibold text-slate-300">Country<input aria-label="Country" required value={draft.country} onChange={(event) => setDraft({ ...draft, country: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" /></label>
                        <label className="text-xs font-semibold text-slate-300">County<input aria-label="County" value={draft.county} onChange={(event) => setDraft({ ...draft, county: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" /></label>
                    </div>
                    <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold hover:bg-indigo-500"><Save className="h-4 w-4" />Save canonical encrypted party</button>
                </form>
            </section>
            <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6"><h2 className="text-lg font-bold">Canonical parties</h2><div className="mt-5 space-y-3">{parties.map((party) => { const address = addresses.find((item) => item.id === (party.kind === "person" ? persons.find((person) => person.id === party.personId)?.addressId : businesses.find((business) => business.id === party.businessId)?.principalAddressId)); const business = businesses.find((item) => item.id === party.businessId); return <div key={party.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><div className="flex justify-between gap-3"><div><p className="font-bold text-white">{names.get(party.id)}</p><p className="mt-1 text-xs uppercase tracking-wide text-indigo-300">{party.kind}</p>{business?.tradeNameOrDba && <p className="mt-2 text-sm text-violet-300">DBA: {business.tradeNameOrDba}</p>}<p className="mt-2 text-sm text-slate-400">{address?.addressLine1}{address?.addressLine2 ? <><br />{address.addressLine2}</> : null}<br />{address?.city}, {address?.stateOrProvince} {address?.postalCode}</p></div><button aria-label={`Edit ${names.get(party.id)}`} onClick={() => editParty(party)} className="h-fit rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-white"><Edit3 className="h-4 w-4" /></button></div></div>; })}</div></section>
        </div>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6"><h2 className="flex items-center gap-2 text-lg font-bold"><UserCheck className="h-5 w-5 text-indigo-300" />Business and party signatories</h2><p className="mt-2 text-sm text-slate-400">The contracting party stays separate from the human who signs. A business signatory without a title or capacity creates a blocking check. The execution date may remain blank until signing.</p><form onSubmit={handleSignatorySave} className="mt-5 grid gap-4 md:grid-cols-3"><select aria-label="Signing for party" required value={signatoryPartyId} onChange={(event) => setSignatoryPartyId(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm"><option value="">Signing for party</option>{parties.map((party) => <option key={party.id} value={party.id}>{names.get(party.id)}</option>)}</select><select aria-label="Signatory person" value={signatoryPersonId} onChange={(event) => setSignatoryPersonId(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm"><option value="">Entered name instead</option>{persons.map((person) => <option key={person.id} value={person.id}>{person.fullLegalName}</option>)}</select><input aria-label="Entered signatory name" disabled={Boolean(signatoryPersonId)} required={!signatoryPersonId} value={enteredSignatoryName} onChange={(event) => setEnteredSignatoryName(event.target.value)} placeholder="Entered signatory name" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm disabled:opacity-40" /><input aria-label="Title or capacity" value={titleOrCapacity} onChange={(event) => setTitleOrCapacity(event.target.value)} placeholder="Title or capacity" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" /><input aria-label="Signature date" type="date" value={signatureDate} onChange={(event) => setSignatureDate(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" /><label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm"><input aria-label="Authority confirmed" type="checkbox" checked={authorityConfirmed} onChange={(event) => setAuthorityConfirmed(event.target.checked)} />Authority confirmed</label><button type="submit" className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold hover:bg-indigo-500">Save encrypted signatory</button></form><div className="mt-4 space-y-2">{signatories.map((signatory) => <div key={signatory.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-950 px-4 py-3 text-sm text-slate-300"><p>{persons.find((person) => person.id === signatory.personId)?.fullLegalName ?? signatory.enteredSignatoryName} signs for {names.get(signatory.partyId)} as <span className={signatory.titleOrCapacity ? "text-emerald-300" : "text-red-300"}>{signatory.titleOrCapacity || "TITLE REQUIRED"}</span></p><button aria-label={`Edit signatory for ${names.get(signatory.partyId)}`} onClick={() => editSignatory(signatory)} className="shrink-0 rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-white"><Edit3 className="h-4 w-4" /></button></div>)}</div></section>
    </>;
}

// Version history
// 20260715105000.0 - Added canonical person, business, structured address, and signatory editing while retaining legacy party adapters for the existing proof.
// 20260715105000.1 - Made each party's signatory record update in place so title and authority corrections replace the blocking draft.
// 20260715105000.2 - Added an explicit signatory edit action that prefills the correction form.
// 20260715105000.3 - Allowed one blank execution date while retaining mandatory business title and authority checks.
