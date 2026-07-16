// ver 20260716032000.0

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import PizZip from "pizzip";
import { deriveMasterKey } from "../src/lib/crypto";
import { buildDocument } from "../src/lib/generate";
import { GenerationProvenanceEntry } from "../src/lib/provenance";
import { INDEPENDENT_CONTRACTOR_FIELDS } from "../src/lib/variables";
import { prepareGenerationInputs } from "../src/lib/workflow";
import { clearVault, listParties, migrateLegacyParties, saveParty } from "../src/lib/vault";

const templateV11Path = path.resolve(process.cwd(), "public/templates/independent-contractor-v1.1.docx");
const registryPath = path.resolve(process.cwd(), "src/registry/registry.json");
const workflowPagePath = path.resolve(process.cwd(), "src/app/workflow/independent-contractor/page.tsx");
const oldFixtureTestPath = path.resolve(process.cwd(), "e2e/p0-upgrade.spec.ts");
const now = "2026-07-16T03:20:00.000Z";

function approved(fieldId: string, value: string): GenerationProvenanceEntry {
    return { renderedValue: value, sourceRecord: `matter:picklesworth#${fieldId}`, classification: "CURRENT_INTAKE_CONFIRMED", lastConfirmedAt: now, transformationApplied: "none" };
}

function currentPayload(): { answers: Record<string, string>; provenance: Record<string, GenerationProvenanceEntry> } {
    const answers = Object.fromEntries(INDEPENDENT_CONTRACTOR_FIELDS.map((field, index) => [field.id, `PICKLESWORTH_${index + 1}`]));
    answers.compensation_structure = "fixed-fee";
    answers.execution_date_treatment = "signature-blanks";
    const provenance = Object.fromEntries(Object.entries(answers).map(([fieldId, value]) => [fieldId, approved(fieldId, value)]));
    return { answers, provenance };
}

test("T1 simulated migration failure preserves the encrypted old-schema parties", async () => {
    const key = await deriveMasterKey("moonshot-fixture-only", "moonshot-picklesworth@example.test");
    await clearVault();
    await saveParty({ id: "party-moonshot", kind: "business", name: "Moonshot Marmalade Industries, LLC", address1: "2915 Starmount Farms Dr.", address2: "Greensboro, NC 27408", createdAt: now }, key);
    await saveParty({ id: "party-picklesworth", kind: "person", name: "Peregrine Picklesworth", address1: "7 Preserves Place", address2: "High Point, NC 27260", createdAt: now }, key);
    const migrateWithFailure = migrateLegacyParties as unknown as (masterKey: CryptoKey, options: { simulateFailureAfterCanonicalWrites: number }) => Promise<unknown>;
    await assert.rejects(() => migrateWithFailure(key, { simulateFailureAfterCanonicalWrites: 1 }), /simulated migration failure/i);
    assert.deepEqual((await listParties(key)).map((party) => party.id).sort(), ["party-moonshot", "party-picklesworth"]);
});

test("T2 stale prior-transaction scope and business description cannot be generated", () => {
    const { answers, provenance } = currentPayload();
    answers.scope_agr_longtext = "STALE PICKLESWORTH SCOPE";
    answers.owner_business_description = "STALE MOONSHOT DESCRIPTION";
    provenance.scope_agr_longtext = approved("scope_agr_longtext", answers.scope_agr_longtext);
    provenance.owner_business_description = approved("owner_business_description", answers.owner_business_description);
    const prepareWithContext = prepareGenerationInputs as unknown as (answers: Record<string, string>, provenance: Record<string, GenerationProvenanceEntry>, context: { transactionId: string }) => ReturnType<typeof prepareGenerationInputs>;
    const prepared = prepareWithContext(answers, provenance, { transactionId: "picklesworth-current-transaction" });
    assert.ok(prepared.missingProvenance.includes("scope_agr_longtext"));
    assert.ok(prepared.missingProvenance.includes("owner_business_description"));
});

test("T3 v1.1 exposes 32 tags, complete ledger metadata, migration map, and package hash", async () => {
    assert.equal(existsSync(templateV11Path), true, "The permitted v1.1 template must exist.");
    assert.equal(INDEPENDENT_CONTRACTOR_FIELDS.length, 32);
    for (const required of ["owner_signatory_title", "contractor_signatory_title", "compensation_terms"]) assert.ok(INDEPENDENT_CONTRACTOR_FIELDS.some((field) => field.id === required));
    const registry = JSON.parse(await readFile(registryPath, "utf8")) as { forms: Array<Record<string, unknown>> };
    const form = registry.forms.find((item) => item.id === "independent-contractor-nc");
    assert.equal(form?.formVersion, "1.1");
    assert.equal(form?.intakeVersion, "1.1");
    assert.equal((form?.tagMigrationMap as Record<string, string> | undefined)?.owner_signatory_name, "owner_signatory_name");
    assert.ok(Array.isArray(form?.changelog));
    const template = new Uint8Array(await readFile(templateV11Path));
    const xml = new PizZip(template).file("word/document.xml")?.asText() ?? "";
    const tags = Array.from(new Set(Array.from(xml.matchAll(/\{\{([^{}]+)\}\}/g), (match) => match[1])));
    assert.equal(tags.length, 32);
    const payload = Object.fromEntries(tags.map((tag) => [tag, `VALUE_${tag}`]));
    const generated = await buildDocument(template, payload, "picklesworth-v1.1.docx");
    assert.equal(typeof (generated as unknown as { packageSha256?: string }).packageSha256, "string");
    const { answers, provenance } = currentPayload();
    const prepared = prepareGenerationInputs(answers, provenance);
    assert.equal(Object.keys(prepared.report).length, 32);
    for (const entry of Object.values(prepared.report) as Array<GenerationProvenanceEntry & Record<string, unknown>>) {
        for (const field of ["templateId", "templateVersion", "intakeVersion", "generationId", "timestamp", "sourceRecordId", "sourceField"]) assert.ok(entry[field], `Missing ledger field ${field}`);
    }
});

test("T4 review and rendering enforce granular confirmation and one execution-date mode", async () => {
    const source = await readFile(workflowPagePath, "utf8");
    assert.match(source, /Individual confirmation/);
    assert.match(source, /Grouped address confirmation/);
    assert.match(source, /Confirm with stated concern/);
    assert.match(source, /Execution-date treatment/);
    assert.doesNotMatch(source, /Confirm all displayed saved answers/);
    const { answers, provenance } = currentPayload();
    answers.execution_date_treatment = "populated-dates";
    answers.owner_signatory_date = "2026-07-16";
    answers.contractor_signatory_date = "";
    provenance.execution_date_treatment = approved("execution_date_treatment", "populated-dates");
    provenance.owner_signatory_date = approved("owner_signatory_date", "2026-07-16");
    provenance.contractor_signatory_date = approved("contractor_signatory_date", "");
    const prepared = prepareGenerationInputs(answers, provenance);
    assert.ok(prepared.missingValues.includes("contractor_signatory_date"));
    assert.ok(prepared.missingValues.includes("execution_date_treatment"));
});

test("fixture privacy permits only Moonshot Marmalade and Picklesworth identities", async () => {
    const fixtureSource = await readFile(oldFixtureTestPath, "utf8");
    assert.match(fixtureSource, /Moonshot Marmalade/);
    assert.match(fixtureSource, /Picklesworth/);
    assert.doesNotMatch(fixtureSource, /Basil Quince|Jane Q\. Contractor|Jeff Gordon Company|Joffry|Von Thurstenburg/);
});

// Version history
// 20260716032000.0 - Added the red T1-T4 trust-closure contracts and fictional-fixture privacy gate before production changes.
