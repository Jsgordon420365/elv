// ver 20260714131300.0

import assert from "node:assert/strict";
import test from "node:test";
import { evaluateRegistryGate, getForm, getProvider } from "../src/lib/registry";

const testDate = new Date("2026-07-14T13:13:00.000Z");

test("maintained in-scope registry state is representable as demo-approved", () => {
    const result = evaluateRegistryGate(
        getProvider("legalflownc-demo-provider"),
        getForm("independent-contractor-nc"),
        { relationshipCharacterization: "independent-contractor", forumState: "North Carolina", arbitrationState: "North Carolina" },
        testDate,
    );
    assert.equal(result.canRepresentAsApproved, true);
    assert.equal(result.representation, "demo-approved");
    assert.deepEqual(result.blockingConditions, []);
});

test("provider not in good standing cannot be represented as approved and records a warning", () => {
    const provider = { ...getProvider("legalflownc-demo-provider"), goodStanding: false };
    const result = evaluateRegistryGate(provider, getForm("independent-contractor-nc"), {}, testDate);
    assert.equal(result.canRepresentAsApproved, false);
    assert.equal(result.representation, "blocked");
    assert.ok(result.blockingConditions.some((warning) => warning.includes("good standing")));
    assert.ok(result.activeWarnings.length > 0);
});

test("suspended form cannot be represented as approved and records a warning", () => {
    const form = { ...getForm("independent-contractor-nc"), lifecycle: "suspended" as const };
    const result = evaluateRegistryGate(getProvider("legalflownc-demo-provider"), form, {}, testDate);
    assert.equal(result.canRepresentAsApproved, false);
    assert.equal(result.representation, "blocked");
    assert.ok(result.blockingConditions.some((warning) => warning.includes("suspended")));
    assert.ok(result.activeWarnings.length > 0);
});

test("out-of-state forum and employment characterization are blocking scope warnings", () => {
    const result = evaluateRegistryGate(
        getProvider("legalflownc-demo-provider"),
        getForm("independent-contractor-nc"),
        { relationshipCharacterization: "employment", forumState: "California" },
        testDate,
    );
    assert.equal(result.canRepresentAsApproved, false);
    assert.equal(result.blockingConditions.length, 2);
    assert.ok(result.activeWarnings.every((warning) => warning.includes("Consider consulting a licensed attorney.")));
});

// Version history
// 20260714131300.0 - Covered maintained approval, provider standing, suspension, and unsupported intake gating.
