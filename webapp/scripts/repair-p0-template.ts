// ver 20260715131500.1

import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import PizZip from "pizzip";

const templatePath = path.resolve(process.cwd(), "public/templates/independent-contractor-fixed2.docx");

function paragraph(text: string, bold = false): string {
    return `<w:p><w:pPr><w:spacing w:line="216" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:eastAsia="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>${bold ? "<w:b/><w:bCs/>" : ""}<w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}

function plainText(value: string): string {
    return value.replace(/<w:tab\/>/g, "\t").replace(/<w:br\/>/g, "\n").replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, "");
}

function log_message(message: string): void {
    console.log(`${new Date().toISOString()} ${message}`);
}

async function main(): Promise<void> {
const source = new Uint8Array(await readFile(templatePath));
const zip = new PizZip(source);
let xml = zip.file("word/document.xml")?.asText();
assert.ok(xml, "word/document.xml must exist before repair");

const replacements: Array<[string, string]> = [
    [" years unless sooner terminated", " unless sooner terminated"],
    [" years following the termination", " following the termination"],
    [" years from the date of termination", " from the date of termination"],
    [" years thereafter", " thereafter"],
    [" years if the Court finds", " if the Court finds"],
    ["{{non_compete_states}}_,_______", "{{non_compete_states}}"],
    ["Contractor shall assign not any right", "Contractor shall not assign any right"],
    ["pay commissions as set forth in writing in this Agreement", "provide the compensation structure expressly confirmed in the Scope of Agreement"],
];
for (const [before, after] of replacements) {
    assert.ok(xml.includes(before), `Expected template text was not found: ${before}`);
    xml = xml.replace(before, after);
}

const paragraphMatches = Array.from(xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g));
const paragraphText = (match: RegExpMatchArray) => plainText(match[0]).trim();
const signatureStart = paragraphMatches.find((match) => paragraphText(match) === "OWNER");
const signatureEnd = paragraphMatches.find((match) => paragraphText(match).includes("{{contractor_signatory_date}}"));
assert.ok(signatureStart?.index !== undefined, "Owner signature block start was not found");
assert.ok(signatureEnd?.index !== undefined, "Contractor signature block end was not found");
const signatureXml = [
    paragraph("OWNER: {{owner_name}}", true),
    paragraph("By: _____________________________ (SEAL)"),
    paragraph("{{owner_signatory_name}}"),
    paragraph("Date: {{owner_signatory_date}}"),
    paragraph("CONTRACTOR: {{contractor_name}}", true),
    paragraph("By: _____________________________ (SEAL)"),
    paragraph("{{contractor_signatory_name}}"),
    paragraph("Date: {{contractor_signatory_date}}"),
].join("");
xml = `${xml.slice(0, signatureStart.index)}${signatureXml}${xml.slice(signatureEnd.index + signatureEnd[0].length)}`;

const repairedText = plainText(xml);
assert.doesNotMatch(repairedText, /pay commissions as set forth in writing/i);
assert.doesNotMatch(repairedText, /shall assign not any right/i);
assert.doesNotMatch(repairedText, /_,_______/);
assert.doesNotMatch(repairedText, /Date:_+/);
assert.match(repairedText, /OWNER: \{\{owner_name\}\}/);
assert.match(repairedText, /By:/);
assert.equal(new Set(Array.from(xml.matchAll(/\{\{([^{}]+)\}\}/g), (match) => match[1])).size, 29);

zip.file("word/document.xml", xml);
const output = zip.generate({ type: "uint8array", compression: "DEFLATE", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
await writeFile(templatePath, output);
log_message(`Repaired template written to ${templatePath}.`);
}

void main().catch((error: unknown) => {
    log_message(`Template repair failed: ${error instanceof Error ? error.message : "Unknown error."}`);
    process.exitCode = 1;
});

// Version history
// 20260715131500.0 - Applied bounded P0 corrections to duration grammar, forum punctuation, assignment order, compensation language, and signature/date binding.
// 20260715131500.1 - Wrapped execution for CommonJS compatibility and added timestamped operation/error logging.
