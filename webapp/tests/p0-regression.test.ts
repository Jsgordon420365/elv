// ver 20260715124500.1

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import PizZip from "pizzip";
import { projectIndependentContractor } from "../src/lib/canonical";

const templatePath = path.resolve(process.cwd(), "public/templates/independent-contractor-v1.1.docx");
const intakePath = path.resolve(process.cwd(), "src/app/workflow/independent-contractor/page.tsx");

function plainDocumentText(xml: string): string {
    return xml.replace(/<w:tab\/>/g, "\t").replace(/<w:br\/>/g, "\n").replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&apos;/g, "'").replace(/&quot;/g, '"');
}

test("the essential intake contains no hidden demo prose", async () => {
    const source = await readFile(intakePath, "utf8");
    assert.doesNotMatch(source, /demoDefaults/);
    assert.doesNotMatch(source, /Manufacture and sell commercial widgets/);
    assert.doesNotMatch(source, /Provide independent product-design consulting/);
    assert.doesNotMatch(source, /Fill remaining demo values/);
});

test("the maintained v1.1 template contains 32 unique tags and none of the approved P0 artifacts", async () => {
    const bytes = new Uint8Array(await readFile(templatePath));
    const xml = new PizZip(bytes).file("word/document.xml")?.asText();
    assert.ok(xml);
    const text = plainDocumentText(xml);
    const tags = Array.from(xml.matchAll(/\{\{([^{}]+)\}\}/g), (match) => match[1]);
    assert.equal(new Set(tags).size, 32);
    assert.doesNotMatch(text, /pay commissions as set forth in writing/i);
    assert.doesNotMatch(text, /shall assign not any right/i);
    assert.doesNotMatch(text, /_,_______/);
    assert.doesNotMatch(text, /Date:_+/);
    assert.match(text, /By:/);
    assert.ok(tags.filter((tag) => tag === "owner_name").length >= 2, "Owner legal name must appear in the signature block");
});

test("canonical projection exposes structured approved provenance instead of display-only strings", () => {
    const projection = projectIndependentContractor({
        parties: [
            { id: "owner", kind: "business", businessId: "business", createdAt: "2026-07-15T12:45:00.000Z", provenance: "user-entered" },
            { id: "contractor", kind: "person", personId: "person", createdAt: "2026-07-15T12:45:00.000Z", provenance: "user-entered" },
        ],
        businesses: [{ id: "business", legalName: "Moonshot Marmalade Industries, LLC", principalAddressId: "address", fieldProvenance: {}, createdAt: "2026-07-15T12:45:00.000Z", updatedAt: "2026-07-15T12:45:00.000Z" }],
        persons: [{ id: "person", fullLegalName: "Basil Quince", addressId: "address", legacyNameUnresolved: false, fieldProvenance: {}, createdAt: "2026-07-15T12:45:00.000Z", updatedAt: "2026-07-15T12:45:00.000Z" }],
        addresses: [{ id: "address", addressLine1: "1 Citrus Way", city: "Greensboro", stateOrProvince: "North Carolina", postalCode: "27408", country: "United States", structuredStatus: "complete", fieldProvenance: {}, createdAt: "2026-07-15T12:45:00.000Z", updatedAt: "2026-07-15T12:45:00.000Z" }],
        signatories: [],
    }, "owner", "contractor");
    const entry = projection.provenance.owner_name as unknown as Record<string, unknown>;
    assert.equal(entry.classification, "CANONICAL_VAULT_CONFIRMED");
    assert.equal(entry.sourceRecord, "business:business");
    assert.equal(entry.lastConfirmedAt, "2026-07-15T12:45:00.000Z");
});

// Version history
// 20260715124500.0 - Added failing P0 tests for hidden prose, template artifacts, signature binding, and structured canonical provenance.
// 20260715124500.1 - Moved template-artifact coverage to v1.1 and required its 32 unique tags.
