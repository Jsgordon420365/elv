// ver 20260714125800.3

import { deleteDB, openDB, IDBPDatabase } from "idb";
import { decryptField, encryptField, EncryptedField } from "./crypto";
import {
    AddressRecord,
    BusinessRecord,
    CanonicalParty,
    CanonicalSnapshot,
    FactProvenance,
    PersonRecord,
    SignatoryRecord,
    makeProvenance,
    normalizeUnitedStatesState,
    parseLegacyCombinedAddressLine2,
} from "./canonical";

const DB_NAME = "ELV_VAULT";
const DB_VERSION = 4;

export const VAULT_STORES = {
    vaultItems: "vault_items",
    parties: "parties",
    relationships: "relationships",
    facts: "facts",
    matters: "matters",
    generations: "generations",
    incidents: "incidents",
    documents: "documents",
    canonicalParties: "canonical_parties",
    persons: "persons",
    businesses: "businesses",
    addresses: "addresses",
    signatories: "signatories",
} as const;

type VaultStoreName = typeof VAULT_STORES[keyof typeof VAULT_STORES];

export interface Party {
    id: string;
    kind: "person" | "business";
    name: string;
    address1: string;
    address2: string;
    createdAt: string;
}

export interface Relationship {
    id: string;
    fromPartyId: string;
    toPartyId: string;
    type: "company-contractor" | "company-authorized-rep";
    createdAt: string;
}

export interface VaultFact {
    id: string;
    partyId?: string;
    fieldId: string;
    value: string;
    source: FactProvenance | "imported";
    lastConfirmedAt: string;
    notes: string;
}

export interface MatterAuditEvent {
    id: string;
    timestamp: string;
    code: string;
    message: string;
    status: "active" | "resolved" | "informational";
}

export interface MatterRecord {
    id: string;
    workflowId: string;
    answers: Record<string, string>;
    auditHistory: MatterAuditEvent[];
    updatedAt: string;
}

export interface AssuranceInput {
    value: string;
    provenance: string;
}

export interface AssuranceRecord {
    generationId: string;
    timestamp: string;
    templateId: string;
    formVersion: string;
    intakeVersion: string;
    providerId: string;
    inputsUsed: Record<string, AssuranceInput>;
    activeWarnings: string[];
    resolvedWarnings: string[];
    blockingConditions: string[];
    informationalNotices: string[];
    warnings: string[];
    exclusions: string[];
    outputSha256: string;
    fileName: string;
    matterId: string;
    approvalRepresentation: "demo-approved" | "blocked" | "diagnostic-draft";
}

export interface IncidentRecord {
    id: string;
    generationId: string;
    createdAt: string;
    whatHappened: string;
    whoRejectedOrChallenged: string;
    dateOfFailure: string;
    evidenceReferences: string[];
    firstResponseOwner: string;
    remedyPolicy: string;
    assuranceRecord: AssuranceRecord;
    outputSha256: string;
    providerId: string;
    formVersion: string;
    intakeVersion: string;
    warnings: string[];
}

interface SecureEnvelope {
    payload: EncryptedField;
}

interface StoredParty extends SecureEnvelope {
    id: string;
    kind: Party["kind"];
    createdAt: string;
}

interface StoredFact extends SecureEnvelope {
    id: string;
    partyId?: string;
    fieldId: string;
    source: VaultFact["source"];
    lastConfirmedAt: string;
}

interface StoredMatter extends SecureEnvelope {
    id: string;
    workflowId: string;
    updatedAt: string;
}

interface StoredGeneration extends SecureEnvelope {
    generationId: string;
    timestamp: string;
    outputSha256: string;
    matterId: string;
}

interface StoredIncident extends SecureEnvelope {
    id: string;
    generationId: string;
    createdAt: string;
    outputSha256: string;
}

interface StoredDocument extends SecureEnvelope {
    generationId: string;
    createdAt: string;
}

interface StoredCanonicalRecord extends SecureEnvelope {
    id: string;
    recordType: "canonical-party" | "person" | "business" | "address" | "signatory";
    createdAt: string;
}

function isEncryptedField(value: unknown): value is EncryptedField {
    return Boolean(value && typeof value === "object" && "ciphertext" in value && "iv" in value);
}

async function getDB(): Promise<IDBPDatabase> {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(VAULT_STORES.vaultItems)) {
                db.createObjectStore(VAULT_STORES.vaultItems);
            }
            if (!db.objectStoreNames.contains(VAULT_STORES.parties)) {
                db.createObjectStore(VAULT_STORES.parties, { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains(VAULT_STORES.relationships)) {
                db.createObjectStore(VAULT_STORES.relationships, { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains(VAULT_STORES.facts)) {
                db.createObjectStore(VAULT_STORES.facts, { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains(VAULT_STORES.matters)) {
                db.createObjectStore(VAULT_STORES.matters, { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains(VAULT_STORES.generations)) {
                db.createObjectStore(VAULT_STORES.generations, { keyPath: "generationId" });
            }
            if (!db.objectStoreNames.contains(VAULT_STORES.incidents)) {
                db.createObjectStore(VAULT_STORES.incidents, { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains(VAULT_STORES.documents)) {
                db.createObjectStore(VAULT_STORES.documents, { keyPath: "generationId" });
            }
            for (const storeName of [VAULT_STORES.canonicalParties, VAULT_STORES.persons, VAULT_STORES.businesses, VAULT_STORES.addresses, VAULT_STORES.signatories]) {
                if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName, { keyPath: "id" });
            }
        },
    });
}

async function encryptJson(value: unknown, masterKey: CryptoKey): Promise<EncryptedField> {
    return encryptField(JSON.stringify(value), masterKey);
}

async function decryptJson<T>(payload: EncryptedField, masterKey: CryptoKey): Promise<T> {
    return JSON.parse(await decryptField(payload, masterKey)) as T;
}

export function createVaultId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID()}`;
}

export async function saveVaultItem(key: string, value: string, masterKey: CryptoKey): Promise<void> {
    const db = await getDB();
    await db.put(VAULT_STORES.vaultItems, await encryptField(value, masterKey), key);
}

export async function getVaultItem(key: string, masterKey: CryptoKey): Promise<string | null> {
    const db = await getDB();
    const data: unknown = await db.get(VAULT_STORES.vaultItems, key);
    if (data === undefined || data === null) return null;
    if (isEncryptedField(data)) return decryptField(data, masterKey);
    return String(data);
}

export async function syncToVault(data: Record<string, string>, masterKey: CryptoKey): Promise<void> {
    for (const [key, value] of Object.entries(data)) {
        await saveVaultItem(key, value, masterKey);
    }
}

export async function getAllVaultItems(): Promise<Record<string, unknown>> {
    const db = await getDB();
    const keys = await db.getAllKeys(VAULT_STORES.vaultItems);
    const values = await db.getAll(VAULT_STORES.vaultItems);
    return Object.fromEntries(keys.map((key, index) => [String(key), values[index] as unknown]));
}

export async function saveParty(party: Party, masterKey: CryptoKey): Promise<void> {
    const stored: StoredParty = {
        id: party.id,
        kind: party.kind,
        createdAt: party.createdAt,
        payload: await encryptJson({ name: party.name, address1: party.address1, address2: party.address2 }, masterKey),
    };
    const db = await getDB();
    await db.put(VAULT_STORES.parties, stored);
}

export async function listParties(masterKey: CryptoKey): Promise<Party[]> {
    const db = await getDB();
    const stored = await db.getAll(VAULT_STORES.parties) as StoredParty[];
    return Promise.all(stored.map(async (item) => ({
        id: item.id,
        kind: item.kind,
        createdAt: item.createdAt,
        ...await decryptJson<Pick<Party, "name" | "address1" | "address2">>(item.payload, masterKey),
    })));
}

async function saveCanonicalRecord<T extends { id: string; createdAt: string }>(storeName: VaultStoreName, recordType: StoredCanonicalRecord["recordType"], record: T, masterKey: CryptoKey): Promise<void> {
    const stored: StoredCanonicalRecord = { id: record.id, recordType, createdAt: record.createdAt, payload: await encryptJson(record, masterKey) };
    const db = await getDB();
    await db.put(storeName, stored);
}

async function listCanonicalRecords<T>(storeName: VaultStoreName, masterKey: CryptoKey): Promise<T[]> {
    const db = await getDB();
    const stored = await db.getAll(storeName) as StoredCanonicalRecord[];
    return Promise.all(stored.map((item) => decryptJson<T>(item.payload, masterKey)));
}

export async function saveCanonicalParty(record: CanonicalParty, masterKey: CryptoKey): Promise<void> {
    await saveCanonicalRecord(VAULT_STORES.canonicalParties, "canonical-party", record, masterKey);
}

export async function listCanonicalParties(masterKey: CryptoKey): Promise<CanonicalParty[]> {
    return listCanonicalRecords<CanonicalParty>(VAULT_STORES.canonicalParties, masterKey);
}

export async function savePerson(record: PersonRecord, masterKey: CryptoKey): Promise<void> {
    await saveCanonicalRecord(VAULT_STORES.persons, "person", record, masterKey);
}

export async function listPersons(masterKey: CryptoKey): Promise<PersonRecord[]> {
    return listCanonicalRecords<PersonRecord>(VAULT_STORES.persons, masterKey);
}

export async function saveBusiness(record: BusinessRecord, masterKey: CryptoKey): Promise<void> {
    await saveCanonicalRecord(VAULT_STORES.businesses, "business", record, masterKey);
}

export async function listBusinesses(masterKey: CryptoKey): Promise<BusinessRecord[]> {
    return listCanonicalRecords<BusinessRecord>(VAULT_STORES.businesses, masterKey);
}

export async function saveAddress(record: AddressRecord, masterKey: CryptoKey): Promise<void> {
    const normalized = normalizeUnitedStatesState(record.stateOrProvince);
    const nextRecord = { ...record, stateOrProvince: normalized.recognized ? normalized.value : record.stateOrProvince };
    await saveCanonicalRecord(VAULT_STORES.addresses, "address", nextRecord, masterKey);
}

export async function listAddresses(masterKey: CryptoKey): Promise<AddressRecord[]> {
    return listCanonicalRecords<AddressRecord>(VAULT_STORES.addresses, masterKey);
}

export async function saveSignatory(record: SignatoryRecord, masterKey: CryptoKey): Promise<void> {
    await saveCanonicalRecord(VAULT_STORES.signatories, "signatory", record, masterKey);
}

export async function listSignatories(masterKey: CryptoKey): Promise<SignatoryRecord[]> {
    return listCanonicalRecords<SignatoryRecord>(VAULT_STORES.signatories, masterKey);
}

export async function getCanonicalSnapshot(masterKey: CryptoKey): Promise<CanonicalSnapshot> {
    const [parties, persons, businesses, addresses, signatories] = await Promise.all([
        listCanonicalParties(masterKey), listPersons(masterKey), listBusinesses(masterKey), listAddresses(masterKey), listSignatories(masterKey),
    ]);
    return { parties, persons, businesses, addresses, signatories };
}

export async function migrateLegacyParties(masterKey: CryptoKey): Promise<{ migrated: number; unresolved: number }> {
    const [legacyParties, existingCanonical] = await Promise.all([listParties(masterKey), listCanonicalParties(masterKey)]);
    const existingIds = new Set(existingCanonical.map((party) => party.id));
    let migrated = 0;
    let unresolved = 0;
    for (const legacy of legacyParties) {
        if (existingIds.has(legacy.id)) continue;
        const now = new Date().toISOString();
        const addressId = `address-${legacy.id}`;
        const parsed = parseLegacyCombinedAddressLine2(legacy.address2);
        const addressProvenance = parsed.deterministic ? "normalized-deterministically" : "inferred-awaiting-confirmation";
        const address: AddressRecord = {
            id: addressId,
            addressLine1: legacy.address1,
            addressLine2: undefined,
            city: parsed.city,
            stateOrProvince: parsed.stateOrProvince,
            postalCode: parsed.postalCode,
            country: "United States",
            legacyCombinedAddressLine2: parsed.legacyCombinedAddressLine2,
            structuredStatus: parsed.structuredStatus,
            fieldProvenance: {
                addressLine1: makeProvenance("migrated-unchanged", now, "Copied exactly from the legacy party record."),
                legacyCombinedAddressLine2: makeProvenance("migrated-unchanged", now, "Original combined address text retained exactly."),
                city: makeProvenance(addressProvenance, now, parsed.deterministic ? "Parsed from an unambiguous city, state, postal pattern." : "Awaiting user confirmation."),
                stateOrProvince: makeProvenance(addressProvenance, now, parsed.deterministic ? "Recognized United States state normalized deterministically." : "Awaiting user confirmation."),
                postalCode: makeProvenance(addressProvenance, now, parsed.deterministic ? "Parsed from an unambiguous city, state, postal pattern." : "Awaiting user confirmation."),
            },
            createdAt: legacy.createdAt,
            updatedAt: now,
        };
        await saveAddress(address, masterKey);
        if (legacy.kind === "person") {
            const personId = `person-${legacy.id}`;
            await savePerson({
                id: personId, fullLegalName: legacy.name, addressId, legacyNameUnresolved: true,
                fieldProvenance: { fullLegalName: makeProvenance("migrated-unchanged", now, "Preserved as authoritative full legal name; no name components were guessed.") },
                createdAt: legacy.createdAt, updatedAt: now,
            }, masterKey);
            await saveCanonicalParty({ id: legacy.id, kind: "person", personId, createdAt: legacy.createdAt, provenance: "migrated-unchanged" }, masterKey);
            unresolved += 1;
        } else {
            const businessId = `business-${legacy.id}`;
            await saveBusiness({
                id: businessId, legalName: legacy.name, principalAddressId: addressId,
                fieldProvenance: { legalName: makeProvenance("migrated-unchanged", now, "Copied exactly; no entity type or DBA was inferred.") },
                createdAt: legacy.createdAt, updatedAt: now,
            }, masterKey);
            await saveCanonicalParty({ id: legacy.id, kind: "business", businessId, createdAt: legacy.createdAt, provenance: "migrated-unchanged" }, masterKey);
        }
        if (!parsed.deterministic) unresolved += 1;
        migrated += 1;
    }
    return { migrated, unresolved };
}

export async function saveRelationship(relationship: Relationship): Promise<void> {
    const db = await getDB();
    await db.put(VAULT_STORES.relationships, relationship);
}

export async function listRelationships(): Promise<Relationship[]> {
    const db = await getDB();
    return db.getAll(VAULT_STORES.relationships) as Promise<Relationship[]>;
}

export async function saveFact(fact: VaultFact, masterKey: CryptoKey): Promise<void> {
    const stored: StoredFact = {
        id: fact.id,
        partyId: fact.partyId,
        fieldId: fact.fieldId,
        source: fact.source,
        lastConfirmedAt: fact.lastConfirmedAt,
        payload: await encryptJson({ value: fact.value, notes: fact.notes }, masterKey),
    };
    const db = await getDB();
    await db.put(VAULT_STORES.facts, stored);
}

export async function listFacts(masterKey: CryptoKey): Promise<VaultFact[]> {
    const db = await getDB();
    const stored = await db.getAll(VAULT_STORES.facts) as StoredFact[];
    return Promise.all(stored.map(async (item) => ({
        id: item.id,
        partyId: item.partyId,
        fieldId: item.fieldId,
        source: item.source,
        lastConfirmedAt: item.lastConfirmedAt,
        ...await decryptJson<Pick<VaultFact, "value" | "notes">>(item.payload, masterKey),
    })));
}

export async function saveMatter(matter: MatterRecord, masterKey: CryptoKey): Promise<void> {
    const stored: StoredMatter = {
        id: matter.id,
        workflowId: matter.workflowId,
        updatedAt: matter.updatedAt,
        payload: await encryptJson({ answers: matter.answers, auditHistory: matter.auditHistory }, masterKey),
    };
    const db = await getDB();
    await db.put(VAULT_STORES.matters, stored);
}

export async function getMatter(id: string, masterKey: CryptoKey): Promise<MatterRecord | null> {
    const db = await getDB();
    const stored = await db.get(VAULT_STORES.matters, id) as StoredMatter | undefined;
    if (!stored) return null;
    const payload = await decryptJson<Pick<MatterRecord, "answers" | "auditHistory">>(stored.payload, masterKey);
    return { id: stored.id, workflowId: stored.workflowId, updatedAt: stored.updatedAt, ...payload };
}

export async function saveGeneration(record: AssuranceRecord, masterKey: CryptoKey): Promise<void> {
    const stored: StoredGeneration = {
        generationId: record.generationId,
        timestamp: record.timestamp,
        outputSha256: record.outputSha256,
        matterId: record.matterId,
        payload: await encryptJson(record, masterKey),
    };
    const db = await getDB();
    await db.put(VAULT_STORES.generations, stored);
}

export async function listGenerations(masterKey: CryptoKey): Promise<AssuranceRecord[]> {
    const db = await getDB();
    const stored = await db.getAll(VAULT_STORES.generations) as StoredGeneration[];
    return Promise.all(stored.map((item) => decryptJson<AssuranceRecord>(item.payload, masterKey)));
}

export async function getGeneration(id: string, masterKey: CryptoKey): Promise<AssuranceRecord | null> {
    const db = await getDB();
    const stored = await db.get(VAULT_STORES.generations, id) as StoredGeneration | undefined;
    return stored ? decryptJson<AssuranceRecord>(stored.payload, masterKey) : null;
}

export async function saveIncident(record: IncidentRecord, masterKey: CryptoKey): Promise<void> {
    const stored: StoredIncident = {
        id: record.id,
        generationId: record.generationId,
        createdAt: record.createdAt,
        outputSha256: record.outputSha256,
        payload: await encryptJson(record, masterKey),
    };
    const db = await getDB();
    await db.put(VAULT_STORES.incidents, stored);
}

export async function listIncidents(masterKey: CryptoKey): Promise<IncidentRecord[]> {
    const db = await getDB();
    const stored = await db.getAll(VAULT_STORES.incidents) as StoredIncident[];
    return Promise.all(stored.map((item) => decryptJson<IncidentRecord>(item.payload, masterKey)));
}

export async function getIncident(id: string, masterKey: CryptoKey): Promise<IncidentRecord | null> {
    const db = await getDB();
    const stored = await db.get(VAULT_STORES.incidents, id) as StoredIncident | undefined;
    return stored ? decryptJson<IncidentRecord>(stored.payload, masterKey) : null;
}

export async function saveGeneratedDocument(generationId: string, bytes: Uint8Array, masterKey: CryptoKey): Promise<void> {
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
    const stored: StoredDocument = {
        generationId,
        createdAt: new Date().toISOString(),
        payload: await encryptJson({ base64: btoa(binary) }, masterKey),
    };
    const db = await getDB();
    await db.put(VAULT_STORES.documents, stored);
}

export async function getGeneratedDocument(generationId: string, masterKey: CryptoKey): Promise<Uint8Array | null> {
    const db = await getDB();
    const stored = await db.get(VAULT_STORES.documents, generationId) as StoredDocument | undefined;
    if (!stored) return null;
    const { base64 } = await decryptJson<{ base64: string }>(stored.payload, masterKey);
    return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export async function getStoredRecordsForVerification(storeName: VaultStoreName): Promise<unknown[]> {
    const db = await getDB();
    return db.getAll(storeName) as Promise<unknown[]>;
}

export async function clearVault(): Promise<void> {
    const db = await getDB();
    const transaction = db.transaction(Object.values(VAULT_STORES), "readwrite");
    await Promise.all(Object.values(VAULT_STORES).map((storeName) => transaction.objectStore(storeName).clear()));
    await transaction.done;
}

export async function resetVaultDatabaseForTests(): Promise<void> {
    await deleteDB(DB_NAME);
}

// Version history
// 20260714125800.0 - Added encrypted parties, facts, matters, assurances, and incidents while retaining the encrypted key-value API.
// 20260714125800.1 - Added encrypted generated-DOCX persistence for regeneration and portable export.
// 20260714125800.2 - Advanced the IndexedDB version so existing Phase 2 databases receive the document store upgrade.
// 20260714125800.3 - Added encrypted canonical party, person, business, address, and signatory stores plus idempotent legacy migration.
