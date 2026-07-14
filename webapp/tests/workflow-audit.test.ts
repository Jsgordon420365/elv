// ver 20260714140200.0

import assert from "node:assert/strict";
import test from "node:test";
import { OUT_OF_SCOPE_MESSAGE, updateScopeAudit } from "../src/lib/workflow";

test("out-of-scope audit event remains recorded and becomes resolved after correction", () => {
    const message = `Out-of-North-Carolina forum encountered. ${OUT_OF_SCOPE_MESSAGE}`;
    const active = updateScopeAudit([], "OUT_OF_STATE_FORUM", message, true);
    assert.equal(active.length, 1);
    assert.equal(active[0].status, "active");
    const resolved = updateScopeAudit(active, "OUT_OF_STATE_FORUM", message, false);
    assert.equal(resolved.length, 1);
    assert.equal(resolved[0].status, "resolved");
    assert.equal(resolved[0].message, message);
});

// Version history
// 20260714140200.0 - Verified active scope warnings clear without erasing the prior audit event.
