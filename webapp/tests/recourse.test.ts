// ver 20260714141100.1

import assert from "node:assert/strict";
import test from "node:test";
import { RECOURSE_DEMO_POLICY, createIncidentRecord } from "../src/lib/recourse";
import { AssuranceRecord } from "../src/lib/vault";

test("incident record carries generation integrity, provider versions, warnings, and failure facts", () => {
    const assurance: AssuranceRecord = {
        generationId: "generation-integrity-test",
        timestamp: "2026-07-14T14:11:00.000Z",
        templateId: "independent-contractor-v1.1.docx",
        formVersion: "1.1",
        intakeVersion: "1.1",
        providerId: "legalflownc-demo-provider",
        inputsUsed: {},
        activeWarnings: [],
        resolvedWarnings: ["Prior California forum warning was resolved."],
        blockingConditions: [],
        informationalNotices: [],
        warnings: ["Prior California forum warning was resolved."],
        exclusions: [],
        outputSha256: "0123456789abcdef",
        packageSha256: "fedcba9876543210",
        fileName: "test.docx",
        matterId: "matter-test",
        approvalRepresentation: "demo-approved",
        documentLabel: "DEMONSTRATION DOCUMENT",
        reviewConfirmations: {},
    };
    const incident = createIncidentRecord(assurance, {
        whatHappened: "The receiving party rejected the document.",
        whoRejectedOrChallenged: "Receiving party",
        dateOfFailure: "2026-07-14",
        evidenceReferences: ["Email reference 1"],
    });
    assert.equal(incident.generationId, assurance.generationId);
    assert.equal(incident.outputSha256, assurance.outputSha256);
    assert.equal(incident.providerId, assurance.providerId);
    assert.equal(incident.formVersion, assurance.formVersion);
    assert.equal(incident.intakeVersion, assurance.intakeVersion);
    assert.deepEqual(incident.warnings, assurance.warnings);
    assert.equal(incident.whatHappened, "The receiving party rejected the document.");
    assert.equal(incident.whoRejectedOrChallenged, "Receiving party");
    assert.equal(incident.dateOfFailure, "2026-07-14");
    assert.deepEqual(incident.evidenceReferences, ["Email reference 1"]);
    assert.equal(incident.remedyPolicy, RECOURSE_DEMO_POLICY);
    assert.equal(incident.assuranceRecord, assurance);
});

// Version history
// 20260714141100.0 - Verified incident generation evidence and user-entered failure facts remain portable and intact.
// 20260714141100.1 - Carried v1.1 dual hashes, demo label, and review evidence through recourse integrity.
