// ver 20260714125800.2

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test from "node:test";
import { deriveMasterKey } from "../src/lib/crypto";
import {
    AssuranceRecord,
    IncidentRecord,
    MatterRecord,
    Party,
    VAULT_STORES,
    VaultFact,
    clearVault,
    getMatter,
    getVaultItem,
    getStoredRecordsForVerification,
    listFacts,
    listIncidents,
    listParties,
    listRelationships,
    saveFact,
    saveGeneration,
    saveIncident,
    saveMatter,
    saveParty,
    saveRelationship,
    saveVaultItem,
} from "../src/lib/vault";

test("all user-authored vault values are encrypted at rest and decrypt through the vault key", async () => {
    const masterKey = await deriveMasterKey("correct horse battery staple", "demo@example.test");
    await clearVault();

    const party: Party = {
        id: "party-business",
        kind: "business",
        name: "ACME_SECRET_NAME",
        address1: "ACME_SECRET_ADDRESS_1",
        address2: "ACME_SECRET_ADDRESS_2",
        createdAt: "2026-07-14T12:58:00.000Z",
    };
    const fact: VaultFact = {
        id: "fact-owner-name",
        partyId: party.id,
        fieldId: "owner_name",
        value: "FACT_SECRET_VALUE",
        source: "user-entered",
        lastConfirmedAt: "2026-07-14T12:58:00.000Z",
        notes: "FACT_SECRET_NOTES",
    };
    const matter: MatterRecord = {
        id: "matter-demo",
        workflowId: "independent-contractor-nc",
        answers: { scope_agr_longtext: "TRANSACTION_SECRET_ANSWER" },
        auditHistory: [],
        updatedAt: "2026-07-14T12:58:00.000Z",
    };
    const assurance: AssuranceRecord = {
        generationId: "generation-demo",
        timestamp: "2026-07-14T12:58:00.000Z",
        templateId: "independent-contractor-fixed2.docx",
        formVersion: "1.0-recovered-20251231",
        intakeVersion: "1.0",
        providerId: "provider-demo",
        inputsUsed: { owner_name: { value: "ASSURANCE_SECRET_INPUT", provenance: "vault" } },
        activeWarnings: [],
        resolvedWarnings: [],
        blockingConditions: [],
        informationalNotices: [],
        warnings: [],
        exclusions: [],
        outputSha256: "abc123",
        fileName: "demo.docx",
        matterId: matter.id,
        approvalRepresentation: "demo-approved",
    };
    const incident: IncidentRecord = {
        id: "incident-demo",
        generationId: assurance.generationId,
        createdAt: "2026-07-14T12:58:00.000Z",
        whatHappened: "INCIDENT_SECRET_NARRATIVE",
        whoRejectedOrChallenged: "INCIDENT_SECRET_CHALLENGER",
        dateOfFailure: "2026-07-14",
        evidenceReferences: ["INCIDENT_SECRET_EVIDENCE"],
        firstResponseOwner: "provider@example.test",
        remedyPolicy: "DEMONSTRATION POLICY",
        assuranceRecord: assurance,
        outputSha256: assurance.outputSha256,
        providerId: assurance.providerId,
        formVersion: assurance.formVersion,
        intakeVersion: assurance.intakeVersion,
        warnings: assurance.warnings,
    };

    await saveParty(party, masterKey);
    await saveRelationship({
        id: "relationship-demo",
        fromPartyId: party.id,
        toPartyId: "party-contractor",
        type: "company-contractor",
        createdAt: "2026-07-14T12:58:00.000Z",
    });
    await saveFact(fact, masterKey);
    await saveMatter(matter, masterKey);
    await saveGeneration(assurance, masterKey);
    await saveIncident(incident, masterKey);
    await saveVaultItem("legacy-compatible-key", "LEGACY_SECRET_VALUE", masterKey);

    const rawStores = await Promise.all([
        VAULT_STORES.vaultItems,
        VAULT_STORES.parties,
        VAULT_STORES.facts,
        VAULT_STORES.matters,
        VAULT_STORES.generations,
        VAULT_STORES.incidents,
    ].map((storeName) => getStoredRecordsForVerification(storeName)));
    const rawJson = JSON.stringify(rawStores);
    for (const secret of [
        party.name,
        party.address1,
        party.address2,
        fact.value,
        fact.notes,
        matter.answers.scope_agr_longtext,
        assurance.inputsUsed.owner_name.value,
        incident.whatHappened,
        incident.whoRejectedOrChallenged,
        incident.evidenceReferences[0],
        "LEGACY_SECRET_VALUE",
    ]) {
        assert.equal(rawJson.includes(secret), false, `Raw IndexedDB data exposed ${secret}`);
    }

    assert.deepEqual(await listParties(masterKey), [party]);
    assert.equal((await listRelationships())[0]?.type, "company-contractor");
    assert.deepEqual(await listFacts(masterKey), [fact]);
    assert.deepEqual(await getMatter(matter.id, masterKey), matter);
    assert.deepEqual(await listIncidents(masterKey), [incident]);
    assert.equal(await getVaultItem("legacy-compatible-key", masterKey), "LEGACY_SECRET_VALUE");
});

// Version history
// 20260714125800.0 - Verified raw IndexedDB records omit party, fact, matter, assurance-input, and incident plaintext.
// 20260714125800.1 - Covered relationship persistence and the retained encrypted key-value API.
// 20260714125800.2 - Included retained key-value records in the raw-at-rest plaintext scan.
