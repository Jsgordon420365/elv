// ver 20260714124000.1

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import PizZip from "pizzip";
import { INDEPENDENT_CONTRACTOR_FIELDS } from "../src/lib/variables";
import { buildDocument } from "../src/lib/generate";

const templatePath = path.resolve(process.cwd(), "public/templates/independent-contractor-fixed2.docx");

async function readTemplate(): Promise<Uint8Array> {
    return new Uint8Array(await readFile(templatePath));
}

function extractTemplateTags(template: Uint8Array): string[] {
    const xml = new PizZip(template).file("word/document.xml")?.asText();
    assert.ok(xml, "word/document.xml must exist in the template");
    return Array.from(xml.matchAll(/\{\{([^{}]+)\}\}/g), (match) => match[1]).sort();
}

function completePayload(): Record<string, string> {
    return Object.fromEntries(INDEPENDENT_CONTRACTOR_FIELDS.map((field, index) => [field.id, `TEST_${index + 1}_${field.id}`]));
}

test("template tags and field schema cover the same 29 fields", async () => {
    const tags = extractTemplateTags(await readTemplate());
    const schemaIds = INDEPENDENT_CONTRACTOR_FIELDS.map((field) => field.id).sort();
    assert.equal(tags.length, 31);
    assert.equal(new Set(tags).size, 29);
    assert.deepEqual(schemaIds, Array.from(new Set(tags)).sort());
    assert.ok(INDEPENDENT_CONTRACTOR_FIELDS.every((field) => field.label && field.tooltip && field.category && field.whyWeAsk));
});

test("identical 29-field merges have deterministic document.xml hashes and no unresolved tags", async () => {
    const template = await readTemplate();
    const payload = completePayload();
    const first = await buildDocument(template, payload, "first.docx");
    const second = await buildDocument(template, payload, "second.docx");

    assert.equal(first.outputSha256, second.outputSha256);
    assert.equal(first.documentXml, second.documentXml);
    assert.doesNotMatch(first.documentXml, /\{\{[^{}]+\}\}/);
    assert.ok(first.bytes.byteLength > 0);
    assert.ok(new PizZip(first.bytes).file("word/document.xml"));
    for (const value of Object.values(payload)) {
        assert.ok(first.documentXml.includes(value), `Expected rendered value ${value}`);
    }
});

// Version history
// 20260714124000.0 - Added schema parity, DOCX validity, deterministic hash, value rendering, and unresolved-tag tests.
// 20260714124000.1 - Allowed owner and contractor legal-name tags to repeat in signature blocks while retaining exactly 29 unique schema tags.
