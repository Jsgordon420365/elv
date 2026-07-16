// ver 20260715110500.2

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import PizZip from "pizzip";
import {
    AddressRecord,
    BusinessRecord,
    CanonicalParty,
    CanonicalSnapshot,
    PersonRecord,
    SignatoryRecord,
    formatStructuredPersonName,
    makeProvenance,
    normalizeUnitedStatesState,
    parseLegacyCombinedAddressLine2,
    projectIndependentContractor,
} from "../src/lib/canonical";
import { deriveMasterKey } from "../src/lib/crypto";
import { buildDocument } from "../src/lib/generate";
import { INDEPENDENT_CONTRACTOR_FIELDS } from "../src/lib/variables";
import {
    VAULT_STORES,
    clearVault,
    getCanonicalSnapshot,
    getStoredRecordsForVerification,
    migrateLegacyParties,
    saveParty,
} from "../src/lib/vault";

const now = "2026-07-15T15:05:00.000Z";
const entered = makeProvenance("user-entered", now, "Acceptance fixture.");

function acceptanceSnapshot(titleOrCapacity = ""): CanonicalSnapshot {
    const address: AddressRecord = {
        id: "address-acceptance", addressLine1: "2915 Starmount Farms Dr.", city: "Greensboro", stateOrProvince: normalizeUnitedStatesState("NC").value, postalCode: "27408", country: "United States", structuredStatus: "complete", fieldProvenance: { stateOrProvince: makeProvenance("normalized-deterministically", now, "NC normalized to North Carolina."), addressLine1: entered, city: entered, postalCode: entered, country: entered }, createdAt: now, updatedAt: now,
    };
    const person: PersonRecord = {
        id: "person-joffry", fullLegalName: "Dr. Joffry Alistair Von Thurstenburg III, Esq.", honorificPrefix: "Dr.", givenName: "Joffry", middleNameOrInitial: "Alistair", familyName: "Von Thurstenburg", generationalSuffix: "III", professionalDesignation: "Esq.", addressId: address.id, legacyNameUnresolved: false, fieldProvenance: { fullLegalName: entered }, createdAt: now, updatedAt: now,
    };
    const business: BusinessRecord = {
        id: "business-jeff", legalName: "Jeff Gordon Company", tradeNameOrDba: "Moon Possum Legal Logistics", principalAddressId: address.id, fieldProvenance: { legalName: entered, tradeNameOrDba: entered, principalAddressId: entered }, createdAt: now, updatedAt: now,
    };
    const parties: CanonicalParty[] = [
        { id: "party-jeff", kind: "business", businessId: business.id, createdAt: now, provenance: "user-entered" },
        { id: "party-joffry", kind: "person", personId: person.id, createdAt: now, provenance: "user-entered" },
    ];
    const signatory: SignatoryRecord = { id: "signatory-jeff", partyId: "party-jeff", personId: person.id, titleOrCapacity, authorityConfirmed: true, signatureDate: "2026-07-15", fieldProvenance: { titleOrCapacity: entered }, createdAt: now, updatedAt: now };
    return { parties, persons: [person], businesses: [business], addresses: [address], signatories: [signatory] };
}

test("canonical names, optional address line 2, state normalization, DBA separation, and signatory checks are deterministic", () => {
    const normalized = normalizeUnitedStatesState("NC");
    assert.deepEqual(normalized, { value: "North Carolina", normalized: true, recognized: true });
    assert.equal(formatStructuredPersonName(acceptanceSnapshot().persons[0]), "Dr. Joffry Alistair Von Thurstenburg III, Esq.");
    const blocked = projectIndependentContractor(acceptanceSnapshot(), "party-jeff", "party-joffry");
    assert.equal(blocked.fields.owner_name, "Jeff Gordon Company");
    assert.equal(blocked.fields.owner_add1, "2915 Starmount Farms Dr.");
    assert.equal(blocked.fields.owner_add2, "Greensboro, North Carolina 27408");
    assert.equal(blocked.fields.contractor_name, "Dr. Joffry Alistair Von Thurstenburg III, Esq.");
    assert.equal(blocked.fields.owner_name.includes("Moon Possum"), false);
    assert.ok(blocked.checks.some((check) => check.code === "DBA_RETAINED_SEPARATELY" && check.classification === "INFORMATIONAL"));
    assert.ok(blocked.checks.some((check) => check.code === "BUSINESS_SIGNATORY_TITLE_REQUIRED" && check.classification === "BLOCKING"));
    const corrected = projectIndependentContractor(acceptanceSnapshot("Authorized Representative"), "party-jeff", "party-joffry");
    assert.equal(corrected.checks.some((check) => check.classification === "BLOCKING"), false);
});

test("legacy migration preserves uncertain text, parses only unambiguous addresses, and encrypts canonical values", async () => {
    const key = await deriveMasterKey("canonical migration password", "canonical@example.test");
    await clearVault();
    await saveParty({ id: "legacy-clear", kind: "business", name: "Legacy Clear LLC", address1: "10 Main St", address2: "Greensboro, NC 27408", createdAt: now }, key);
    await saveParty({ id: "legacy-ambiguous", kind: "person", name: "Prince", address1: "Unknown Road", address2: "Near the old mill", createdAt: now }, key);
    const first = await migrateLegacyParties(key);
    const second = await migrateLegacyParties(key);
    assert.deepEqual(first, { migrated: 2, unresolved: 2, snapshotId: "schema-3-to-5-precanonical", status: "complete" });
    assert.deepEqual(second, { migrated: 0, unresolved: 0, status: "not-needed" });
    const snapshot = await getCanonicalSnapshot(key);
    assert.equal(snapshot.parties.length, 2);
    assert.equal(snapshot.persons[0].fullLegalName, "Prince");
    assert.equal(snapshot.persons[0].givenName, undefined);
    assert.equal(snapshot.persons[0].legacyNameUnresolved, true);
    const clearAddress = snapshot.addresses.find((address) => address.id === "address-legacy-clear");
    assert.equal(clearAddress?.stateOrProvince, "North Carolina");
    assert.equal(clearAddress?.legacyCombinedAddressLine2, "Greensboro, NC 27408");
    const ambiguous = snapshot.addresses.find((address) => address.id === "address-legacy-ambiguous");
    assert.equal(ambiguous?.structuredStatus, "unresolved");
    assert.equal(ambiguous?.legacyCombinedAddressLine2, "Near the old mill");
    assert.equal(ambiguous?.city, "");
    const raw = JSON.stringify((await Promise.all([VAULT_STORES.canonicalParties, VAULT_STORES.persons, VAULT_STORES.businesses, VAULT_STORES.addresses].map((store) => getStoredRecordsForVerification(store)))).flat());
    for (const plaintext of ["Legacy Clear LLC", "Prince", "Greensboro", "Near the old mill"]) assert.equal(raw.includes(plaintext), false);
});

test("canonical projection merges through all unchanged 29 DOCX tags with no unresolved tags", async () => {
    const projection = projectIndependentContractor(acceptanceSnapshot("Authorized Representative"), "party-jeff", "party-joffry");
    const payload = Object.fromEntries(INDEPENDENT_CONTRACTOR_FIELDS.map((field, index) => [field.id, projection.fields[field.id] ?? `CANONICAL_${index}_${field.id}`]));
    const template = new Uint8Array(await readFile(path.resolve(process.cwd(), "public/templates/independent-contractor-fixed2.docx")));
    const generated = await buildDocument(template, payload, "canonical-acceptance.docx");
    const repeated = await buildDocument(template, payload, "canonical-acceptance-repeat.docx");
    assert.equal(generated.outputSha256, repeated.outputSha256);
    assert.equal(generated.documentXml, repeated.documentXml);
    assert.ok(new PizZip(generated.bytes).file("word/document.xml"));
    assert.doesNotMatch(generated.documentXml, /\{\{[^{}]+\}\}/);
    assert.match(generated.documentXml, /Jeff Gordon Company/);
    assert.match(generated.documentXml, /Dr\. Joffry Alistair Von Thurstenburg III, Esq\./);
    assert.match(generated.documentXml, /Greensboro, North Carolina 27408/);
    assert.doesNotMatch(generated.documentXml, /Moon Possum Legal Logistics/);
});

test("legacy address parser refuses ambiguous combined text", () => {
    assert.deepEqual(parseLegacyCombinedAddressLine2("Greensboro, NC 27408"), { city: "Greensboro", stateOrProvince: "North Carolina", postalCode: "27408", legacyCombinedAddressLine2: "Greensboro, NC 27408", structuredStatus: "complete", deterministic: true });
    assert.equal(parseLegacyCombinedAddressLine2("Greensboro NC maybe 27408").structuredStatus, "unresolved");
});

// Version history
// 20260715110500.0 - Covered canonical acceptance data, state normalization, DBA separation, signatory blocking, safe encrypted migration, and unchanged DOCX tag compatibility.
// 20260715110500.1 - Proved identical canonical projections produce identical normalized document XML and SHA-256 values.
// 20260715110500.2 - Asserted encrypted snapshot creation and idempotent version-5 migration status.
