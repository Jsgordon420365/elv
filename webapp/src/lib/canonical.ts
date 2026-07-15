// ver 20260715103800.0

export type FactProvenance =
    | "user-entered"
    | "migrated-unchanged"
    | "normalized-deterministically"
    | "inferred-awaiting-confirmation";

export interface ProvenanceDetail {
    source: FactProvenance;
    recordedAt: string;
    note: string;
}

export interface CanonicalParty {
    id: string;
    kind: "person" | "business";
    personId?: string;
    businessId?: string;
    createdAt: string;
    provenance: FactProvenance;
}

export interface PersonRecord {
    id: string;
    fullLegalName: string;
    honorificPrefix?: string;
    givenName?: string;
    middleNameOrInitial?: string;
    familyName?: string;
    generationalSuffix?: string;
    professionalDesignation?: string;
    preferredDisplayName?: string;
    addressId?: string;
    legacyNameUnresolved: boolean;
    fieldProvenance: Record<string, ProvenanceDetail>;
    createdAt: string;
    updatedAt: string;
}

export interface BusinessRecord {
    id: string;
    legalName: string;
    entityType?: string;
    jurisdictionOfOrganization?: string;
    tradeNameOrDba?: string;
    principalAddressId: string;
    noticeAddressId?: string;
    fieldProvenance: Record<string, ProvenanceDetail>;
    createdAt: string;
    updatedAt: string;
}

export interface AddressRecord {
    id: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    stateOrProvince: string;
    postalCode: string;
    country: string;
    county?: string;
    legacyCombinedAddressLine2?: string;
    structuredStatus: "complete" | "unresolved";
    fieldProvenance: Record<string, ProvenanceDetail>;
    createdAt: string;
    updatedAt: string;
}

export interface SignatoryRecord {
    id: string;
    partyId: string;
    personId?: string;
    enteredSignatoryName?: string;
    titleOrCapacity: string;
    authorityConfirmed: boolean;
    signatureDate: string;
    fieldProvenance: Record<string, ProvenanceDetail>;
    createdAt: string;
    updatedAt: string;
}

export type ConsistencyClassification = "BLOCKING" | "CONFIRMATION_REQUIRED" | "AUTO_NORMALIZED" | "INFORMATIONAL";

export interface ConsistencyResult {
    code: string;
    classification: ConsistencyClassification;
    message: string;
    partyId?: string;
}

export interface CanonicalSnapshot {
    parties: CanonicalParty[];
    persons: PersonRecord[];
    businesses: BusinessRecord[];
    addresses: AddressRecord[];
    signatories: SignatoryRecord[];
}

export interface ProjectionResult {
    fields: Record<string, string>;
    provenance: Record<string, string>;
    checks: ConsistencyResult[];
}

const UNITED_STATES: Record<string, string> = {
    AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
    HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
    MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
    NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
    SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
};

const STATE_NAMES = new Map(Object.entries(UNITED_STATES).map(([abbreviation, name]) => [name.toLowerCase(), { abbreviation, name }]));

export function normalizeUnitedStatesState(value: string): { value: string; normalized: boolean; recognized: boolean } {
    const trimmed = value.trim();
    const abbreviationMatch = UNITED_STATES[trimmed.toUpperCase()];
    if (abbreviationMatch) return { value: abbreviationMatch, normalized: abbreviationMatch !== trimmed, recognized: true };
    const nameMatch = STATE_NAMES.get(trimmed.toLowerCase());
    if (nameMatch) return { value: nameMatch.name, normalized: nameMatch.name !== trimmed, recognized: true };
    return { value: trimmed, normalized: false, recognized: false };
}

export function makeProvenance(source: FactProvenance, recordedAt: string, note: string): ProvenanceDetail {
    return { source, recordedAt, note };
}

export function formatStructuredPersonName(person: Pick<PersonRecord, "honorificPrefix" | "givenName" | "middleNameOrInitial" | "familyName" | "generationalSuffix" | "professionalDesignation">): string {
    const base = [person.honorificPrefix, person.givenName, person.middleNameOrInitial, person.familyName, person.generationalSuffix].filter(Boolean).join(" ");
    return person.professionalDesignation ? `${base}${base ? ", " : ""}${person.professionalDesignation}` : base;
}

export function parseLegacyCombinedAddressLine2(value: string): Pick<AddressRecord, "city" | "stateOrProvince" | "postalCode" | "legacyCombinedAddressLine2" | "structuredStatus"> & { deterministic: boolean } {
    const original = value.trim();
    const match = original.match(/^([^,]+),\s*([A-Za-z ]+?)\s+(\d{5}(?:-\d{4})?)$/);
    if (!match) return { city: "", stateOrProvince: "", postalCode: "", legacyCombinedAddressLine2: original || undefined, structuredStatus: "unresolved", deterministic: false };
    const normalizedState = normalizeUnitedStatesState(match[2]);
    if (!normalizedState.recognized) return { city: "", stateOrProvince: "", postalCode: "", legacyCombinedAddressLine2: original, structuredStatus: "unresolved", deterministic: false };
    return { city: match[1].trim(), stateOrProvince: normalizedState.value, postalCode: match[3], legacyCombinedAddressLine2: original, structuredStatus: "complete", deterministic: true };
}

export function formatAddressProjection(address: AddressRecord): { line1: string; line2: string } {
    const line1 = [address.addressLine1, address.addressLine2].filter(Boolean).join(", ");
    const state = normalizeUnitedStatesState(address.stateOrProvince).value;
    const locality = [address.city, state].filter(Boolean).join(", ");
    const line2 = [locality, address.postalCode].filter(Boolean).join(" ");
    return { line1, line2 };
}

function partyName(party: CanonicalParty, snapshot: CanonicalSnapshot): string {
    if (party.kind === "person") return snapshot.persons.find((person) => person.id === party.personId)?.fullLegalName ?? "";
    return snapshot.businesses.find((business) => business.id === party.businessId)?.legalName ?? "";
}

function partyAddress(party: CanonicalParty, snapshot: CanonicalSnapshot): AddressRecord | undefined {
    if (party.kind === "person") {
        const person = snapshot.persons.find((item) => item.id === party.personId);
        return snapshot.addresses.find((address) => address.id === person?.addressId);
    }
    const business = snapshot.businesses.find((item) => item.id === party.businessId);
    return snapshot.addresses.find((address) => address.id === business?.principalAddressId);
}

function signatoryName(signatory: SignatoryRecord | undefined, snapshot: CanonicalSnapshot): string {
    if (!signatory) return "";
    return snapshot.persons.find((person) => person.id === signatory.personId)?.fullLegalName ?? signatory.enteredSignatoryName ?? "";
}

export function evaluateCanonicalConsistency(snapshot: CanonicalSnapshot, ownerPartyId: string, contractorPartyId: string, ownerBusinessDescription = ""): ConsistencyResult[] {
    const results: ConsistencyResult[] = [];
    const selectedParties = [ownerPartyId, contractorPartyId].map((id) => snapshot.parties.find((party) => party.id === id)).filter((party): party is CanonicalParty => Boolean(party));
    for (const party of selectedParties) {
        const address = partyAddress(party, snapshot);
        if (!address || !address.addressLine1 || !address.city || !address.stateOrProvince || !address.postalCode || !address.country) {
            results.push({ code: "INCOMPLETE_STRUCTURED_ADDRESS", classification: "BLOCKING", message: "The selected contracting party has an incomplete structured address.", partyId: party.id });
        }
        if (address?.structuredStatus === "unresolved") {
            results.push({ code: "AMBIGUOUS_LEGACY_ADDRESS", classification: "CONFIRMATION_REQUIRED", message: "Legacy address text was preserved, but city, state, and postal code still require confirmation.", partyId: party.id });
        }
        const normalized = address ? normalizeUnitedStatesState(address.stateOrProvince) : null;
        if (normalized?.normalized) {
            results.push({ code: "STATE_AUTO_NORMALIZED", classification: "AUTO_NORMALIZED", message: `${address?.stateOrProvince} was normalized to ${normalized.value}.`, partyId: party.id });
        }
        if (party.kind === "person") {
            const person = snapshot.persons.find((item) => item.id === party.personId);
            if (person?.legacyNameUnresolved) results.push({ code: "AMBIGUOUS_LEGACY_NAME", classification: "CONFIRMATION_REQUIRED", message: "The full legal name was preserved without guessing how to split it into name components.", partyId: party.id });
        } else {
            const business = snapshot.businesses.find((item) => item.id === party.businessId);
            if (business?.noticeAddressId && business.noticeAddressId !== business.principalAddressId) results.push({ code: "NOTICE_ADDRESS_DIFFERS", classification: "CONFIRMATION_REQUIRED", message: "The notice address differs from the selected principal party address.", partyId: party.id });
            if (business?.tradeNameOrDba) results.push({ code: "DBA_RETAINED_SEPARATELY", classification: "INFORMATIONAL", message: `${business.tradeNameOrDba} remains a trade name and was not substituted for the legal entity name.`, partyId: party.id });
        }
    }
    for (const signatory of snapshot.signatories.filter((item) => item.partyId === ownerPartyId || item.partyId === contractorPartyId)) {
        const party = snapshot.parties.find((item) => item.id === signatory.partyId);
        if (!party) results.push({ code: "SIGNATORY_PARTY_MISMATCH", classification: "BLOCKING", message: "A signatory is linked to a party that is not part of this transaction.", partyId: signatory.partyId });
        if (party?.kind === "business" && !signatory.titleOrCapacity.trim()) results.push({ code: "BUSINESS_SIGNATORY_TITLE_REQUIRED", classification: "BLOCKING", message: "A person signing for a business must have a title or capacity.", partyId: signatory.partyId });
        if (!signatory.authorityConfirmed) results.push({ code: "SIGNATORY_AUTHORITY_UNCONFIRMED", classification: "CONFIRMATION_REQUIRED", message: "The signatory's authority has not been confirmed.", partyId: signatory.partyId });
    }
    if (/\b(?:d\/?b\/?a|dba|doing business as)\b/i.test(ownerBusinessDescription)) results.push({ code: "DBA_EMBEDDED_IN_DESCRIPTION", classification: "CONFIRMATION_REQUIRED", message: "DBA language appears in the business-description field; use the separate trade-name record instead." });
    return results;
}

export function projectIndependentContractor(snapshot: CanonicalSnapshot, ownerPartyId: string, contractorPartyId: string, ownerBusinessDescription = ""): ProjectionResult {
    const owner = snapshot.parties.find((party) => party.id === ownerPartyId);
    const contractor = snapshot.parties.find((party) => party.id === contractorPartyId);
    if (!owner || !contractor) return { fields: {}, provenance: {}, checks: [] };
    const ownerAddress = partyAddress(owner, snapshot);
    const contractorAddress = partyAddress(contractor, snapshot);
    const ownerLines = ownerAddress ? formatAddressProjection(ownerAddress) : { line1: "", line2: "" };
    const contractorLines = contractorAddress ? formatAddressProjection(contractorAddress) : { line1: "", line2: "" };
    const ownerSignatory = snapshot.signatories.find((item) => item.partyId === owner.id);
    const contractorSignatory = snapshot.signatories.find((item) => item.partyId === contractor.id);
    const fields: Record<string, string> = {
        owner_name: partyName(owner, snapshot), owner_add1: ownerLines.line1, owner_add2: ownerLines.line2,
        contractor_name: partyName(contractor, snapshot), contr_add1: contractorLines.line1, contr_add2: contractorLines.line2,
    };
    if (ownerSignatory) {
        fields.owner_signatory_name = signatoryName(ownerSignatory, snapshot);
        fields.owner_signatory_date = ownerSignatory.signatureDate;
    }
    if (contractorSignatory) {
        fields.contractor_signatory_name = signatoryName(contractorSignatory, snapshot);
        fields.contractor_signatory_date = contractorSignatory.signatureDate;
    }
    const provenance = Object.fromEntries(Object.keys(fields).map((fieldId) => [fieldId, "canonical encrypted vault projection"]));
    return { fields, provenance, checks: evaluateCanonicalConsistency(snapshot, ownerPartyId, contractorPartyId, ownerBusinessDescription) };
}

// Version history
// 20260715103800.0 - Added canonical party, person, business, address, signatory, provenance, migration parsing, consistency, and deterministic form projection primitives.
