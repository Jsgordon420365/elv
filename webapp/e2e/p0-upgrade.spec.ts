// ver 20260715124500.8

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import PizZip from "pizzip";

const outputDirectory = path.resolve("..", "demo-output");
const documentOutputPath = path.join(outputDirectory, "moonshot-marmalade-p0.docx");
const provenanceOutputPath = path.join(outputDirectory, "moonshot-marmalade-p0-provenance.json");
const migrationEvidencePath = path.join(outputDirectory, "moonshot-marmalade-p0-migration-evidence.json");

const oldMatterAnswers: Record<string, string> = {
    owner_business_description: "Moonshot Marmalade Industries manufactures and distributes specialty marmalades",
    scope_agr_longtext: "Develop and document a regional wholesale distribution plan for Moonshot Marmalade products",
    agreement_start_date: "2026-07-15",
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
    owner_signatory_name: "Petunia Picklesworth",
    owner_signatory_title: "Chief Marmalade Officer",
    owner_signatory_date: "2026-07-15",
    contractor_signatory_name: "Peregrine Picklesworth",
    contractor_signatory_title: "Independent Contractor",
    contractor_signatory_date: "2026-07-15",
    relationship_characterization: "independent-contractor",
    includes_minor: "no",
    compensation_structure: "fixed-fee",
    execution_date_treatment: "populated-dates",
};

test("version-3 encrypted records survive restart, schema upgrade, migration, and generation", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async ({ answers }) => {
        await new Promise<void>((resolve, reject) => {
            const request = indexedDB.deleteDatabase("ELV_VAULT");
            request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); request.onblocked = () => reject(new Error("Legacy database deletion was blocked during isolated test setup."));
        });
        const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode("legalflownc-demo"), "PBKDF2", false, ["deriveKey"]);
        const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: new TextEncoder().encode("elv-demo:demo@local.test"), iterations: 600000, hash: "SHA-256" }, keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
        if (key.extractable) throw new Error("Legacy key fixture must be non-extractable.");
        const base64 = (value: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(value)));
        const encrypt = async (value: unknown) => { const iv = crypto.getRandomValues(new Uint8Array(12)); const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, new TextEncoder().encode(JSON.stringify(value))); return { ciphertext: base64(ciphertext), iv: base64(iv.buffer) }; };
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("ELV_VAULT", 3);
            request.onupgradeneeded = () => {
                const next = request.result;
                next.createObjectStore("vault_items");
                next.createObjectStore("parties", { keyPath: "id" });
                next.createObjectStore("relationships", { keyPath: "id" });
                next.createObjectStore("facts", { keyPath: "id" });
                next.createObjectStore("matters", { keyPath: "id" });
                next.createObjectStore("generations", { keyPath: "generationId" });
                next.createObjectStore("incidents", { keyPath: "id" });
                next.createObjectStore("documents", { keyPath: "generationId" });
            };
            request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
        });
        const createdAt = "2026-07-14T16:00:00.000Z";
        const parties = [
            { id: "party-moonshot", kind: "business", name: "Moonshot Marmalade Industries, LLC", address1: "2915 Starmount Farms Dr.", address2: "Greensboro, NC 27408", createdAt },
            { id: "party-petunia", kind: "person", name: "Petunia Picklesworth", address1: "44 Effervescence Lane", address2: "Greensboro, NC 27408", createdAt },
            { id: "party-peregrine", kind: "person", name: "Peregrine Picklesworth", address1: "7 Preserves Place", address2: "High Point, NC 27260", createdAt },
        ];
        const transaction = db.transaction(["parties", "relationships", "facts", "matters"], "readwrite");
        for (const party of parties) transaction.objectStore("parties").put({ id: party.id, kind: party.kind, createdAt: party.createdAt, payload: await encrypt({ name: party.name, address1: party.address1, address2: party.address2 }) });
        transaction.objectStore("relationships").put({ id: "relationship-moonshot-peregrine", fromPartyId: "party-moonshot", toPartyId: "party-peregrine", type: "company-contractor", createdAt });
        transaction.objectStore("relationships").put({ id: "relationship-moonshot-petunia", fromPartyId: "party-moonshot", toPartyId: "party-petunia", type: "company-authorized-rep", createdAt });
        const facts = [
            ["owner_name", "Moonshot Marmalade Industries, LLC", "party-moonshot"], ["owner_add1", "2915 Starmount Farms Dr.", "party-moonshot"], ["owner_add2", "Greensboro, NC 27408", "party-moonshot"],
            ["contractor_name", "Peregrine Picklesworth", "party-peregrine"], ["contr_add1", "7 Preserves Place", "party-peregrine"], ["contr_add2", "High Point, NC 27260", "party-peregrine"],
        ];
        for (const [fieldId, value, partyId] of facts) transaction.objectStore("facts").put({ id: `${partyId}:${fieldId}`, partyId, fieldId, source: "user-entered", lastConfirmedAt: createdAt, payload: await encrypt({ value, notes: "Legacy confirmed fact." }) });
        transaction.objectStore("matters").put({ id: "independent-contractor-demo-matter", workflowId: "independent-contractor-nc", updatedAt: createdAt, payload: await encrypt({ answers, auditHistory: [] }) });
        await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
        db.close();
    }, { answers: oldMatterAnswers });

    await page.goto("/vault");
    await page.getByRole("button", { name: "Unlock local vault" }).click();
    await expect(page.getByRole("button", { name: "Edit Moonshot Marmalade Industries, LLC" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit Petunia Picklesworth" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit Peregrine Picklesworth" })).toBeVisible();
    await expect(page.getByText(/Moonshot Marmalade Industries, LLC company-contractor Peregrine Picklesworth/)).toBeVisible();
    await expect(page.getByText(/Moonshot Marmalade Industries, LLC company-authorized-rep Petunia Picklesworth/)).toBeVisible();
    const preserved = await page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open("ELV_VAULT"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const transaction = db.transaction(["parties", "relationships", "facts", "matters", "migration_snapshots"], "readonly");
        const getAll = (store: string) => new Promise<unknown[]>((resolve, reject) => { const request = transaction.objectStore(store).getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const [parties, relationships, facts, matters, snapshots] = await Promise.all([getAll("parties"), getAll("relationships"), getAll("facts"), getAll("matters"), getAll("migration_snapshots")]);
        db.close();
        return { partyIds: parties.map((item) => (item as { id: string }).id).sort(), relationshipIds: relationships.map((item) => (item as { id: string }).id).sort(), factIds: facts.map((item) => (item as { id: string }).id).sort(), matterIds: matters.map((item) => (item as { id: string }).id).sort(), snapshotCount: snapshots.length, encryptedSnapshotContainsPlaintext: JSON.stringify(snapshots).includes("Moonshot Marmalade") };
    });
    expect(preserved.partyIds).toEqual(["party-moonshot", "party-peregrine", "party-petunia"]);
    expect(preserved.relationshipIds).toEqual(["relationship-moonshot-peregrine", "relationship-moonshot-petunia"]);
    expect(preserved.factIds).toHaveLength(6);
    expect(preserved.matterIds).toEqual(["independent-contractor-demo-matter"]);
    expect(preserved.snapshotCount).toBeGreaterThan(0);
    expect(preserved.encryptedSnapshotContainsPlaintext).toBe(false);

    await page.getByLabel("Signing for party").selectOption({ label: "Moonshot Marmalade Industries, LLC" });
    await page.getByLabel("Signatory person").selectOption({ label: "Petunia Picklesworth" });
    await page.getByLabel("Title or capacity").fill("Chief Marmalade Officer");
    await page.getByLabel("Signature date").fill("2026-07-15");
    await page.getByLabel("Authority confirmed").check();
    await page.getByRole("button", { name: "Save encrypted signatory" }).click();
    await expect(page.getByText(/Petunia Picklesworth signs for Moonshot Marmalade Industries, LLC as Chief Marmalade Officer/)).toBeVisible();

    await expect(page.getByRole("status")).toContainText("Encrypted signatory record saved");
    await page.locator('a[href="/workflow/independent-contractor"]').click();
    await page.waitForURL(/\/workflow\/independent-contractor/);
    await expect(page.getByLabel("Owner business description")).toHaveValue(oldMatterAnswers.owner_business_description);
    await expect(page.getByLabel("Scope of services")).toHaveValue(oldMatterAnswers.scope_agr_longtext);
    await expect(page.getByLabel("Compensation structure")).toHaveValue("fixed-fee");
    await page.getByRole("button", { name: /Confirm all displayed saved answers/ }).click();
    await expect(page.getByText("Ready to generate with complete approved provenance")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Generation provenance review — 29 template tags" })).toBeVisible();

    await mkdir(outputDirectory, { recursive: true });
    const generationDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Generate maintained DOCX" }).click();
    const generated = await generationDownload;
    await generated.saveAs(documentOutputPath);
    await expect(page.getByRole("heading", { name: "Maintained demo document generated" })).toBeVisible();

    const provenanceDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download provenance JSON" }).click();
    const provenance = await provenanceDownload;
    await provenance.saveAs(provenanceOutputPath);

    const documentBytes = await readFile(documentOutputPath);
    const zip = new PizZip(documentBytes);
    const documentXmlFile = zip.file("word/document.xml");
    expect(documentXmlFile).not.toBeNull();
    const documentXml = documentXmlFile!.asText();
    expect(documentXml).not.toMatch(/{{[^{}]+}}/);
    expect(documentXml).toContain("Moonshot Marmalade Industries, LLC");
    expect(documentXml).toContain("Penelope Fizzlebottom");
    expect(documentXml).toContain("Chief Marmalade Officer");
    expect(documentXml).toContain(oldMatterAnswers.scope_agr_longtext);
    expect(documentXml).toContain(oldMatterAnswers.owner_business_description);
    expect(documentXml).toContain("Compensation structure: Fixed fee.");
    expect(documentXml).not.toContain("Provide independent product-design consulting and written recommendations for the owner's widget catalog.");
    expect(documentXml).not.toContain("Manufacture and sell commercial widgets.");
    expect(documentXml).not.toContain("One (1) years");
    expect(documentXml).not.toContain("1 years");
    expect(documentXml).not.toContain("North Carolina_,_______");
    expect(documentXml).not.toContain("Contractor shall assign not any right");
    expect(documentXml).not.toContain("Owner shall compensate Contractor on a commission basis");
    expect((documentXml.match(/Date:/g) ?? [])).toHaveLength(2);

    const provenanceRecord = JSON.parse(await readFile(provenanceOutputPath, "utf8")) as { provenanceReport: Record<string, { renderedValue: string; sourceRecord: string; classification: string; lastConfirmedAt: string; transformationApplied: string }> };
    expect(Object.keys(provenanceRecord.provenanceReport)).toHaveLength(29);
    const allowedClassifications = new Set(["CURRENT_INTAKE_CONFIRMED", "CANONICAL_VAULT_CONFIRMED", "DETERMINISTIC_DERIVATION", "APPROVED_FIXED_TEMPLATE_TEXT"]);
    for (const entry of Object.values(provenanceRecord.provenanceReport)) {
        expect(allowedClassifications.has(entry.classification)).toBe(true);
        expect(entry.sourceRecord).not.toBe("");
        expect(entry.lastConfirmedAt).not.toBe("");
        expect(entry.transformationApplied).not.toBe("");
    }
    expect(provenanceRecord.provenanceReport.scope_agr_longtext.classification).toBe("DETERMINISTIC_DERIVATION");
    expect(provenanceRecord.provenanceReport.scope_agr_longtext.sourceRecord).toContain("matter-answer:scope_agr_longtext");
    expect(provenanceRecord.provenanceReport.owner_business_description.classification).toBe("CURRENT_INTAKE_CONFIRMED");

    const migrationEvidence = {
        testedAt: new Date().toISOString(),
        sourceSchemaVersion: 3,
        targetSchemaVersion: 5,
        preserved,
        decryptedVisibleRecords: ["Moonshot Marmalade Industries, LLC", "Petunia Picklesworth", "Peregrine Picklesworth"],
        generatedDocument: path.basename(documentOutputPath),
        provenanceRecord: path.basename(provenanceOutputPath),
        unresolvedTemplateTags: 0,
    };
    await writeFile(migrationEvidencePath, `${JSON.stringify(migrationEvidence, null, 2)}\n`, "utf8");
});

// Version history
// 20260715124500.0 - Added a real browser version-3 encrypted database fixture and preservation assertions across restart and upgrade.
// 20260715124500.1 - Targeted visible party-card edit controls instead of hidden select options.
// 20260715124500.2 - Completed Moonshot signatory, generation, DOCX artifact, provenance, and stable migration-evidence assertions.
// 20260715124500.3 - Used direct workflow navigation after asynchronous vault signatory persistence.
// 20260715124500.4 - Preserved the in-memory non-extractable key by using client-side navigation after vault persistence settled.
// 20260715124500.5 - Reopened directly on the vault route to avoid a development-server home-page navigation race.
// 20260715124500.6 - Matched the confirmation page's actual maintained-document heading.
// 20260715124500.7 - Asserted the scope's documented deterministic compensation-clause derivation.
// 20260715124500.8 - Limited the committed old-schema fixture to fictional Moonshot Marmalade and Picklesworth identities and added v1.1 fields.
