// ver 20260716033000.0

import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import PizZip from "pizzip";

const sourcePath = path.resolve(process.cwd(), "public/templates/independent-contractor-fixed2.docx");
const outputPath = path.resolve(process.cwd(), "public/templates/independent-contractor-v1.1.docx");

function log_message(message: string): void {
    console.log(`${new Date().toISOString()} ${message}`);
}

function plainText(value: string): string {
    return value.replace(/<w:tab\/>/g, "\t").replace(/<w:br\/>/g, "\n").replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&apos;/g, "'").replace(/&quot;/g, '"').trim();
}

function paragraph(text: string, bold = false): string {
    return `<w:p><w:pPr><w:spacing w:line="216" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:eastAsia="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>${bold ? "<w:b/><w:bCs/>" : ""}<w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}

async function main(): Promise<void> {
    const zip = new PizZip(new Uint8Array(await readFile(sourcePath)));
    let xml = zip.file("word/document.xml")?.asText();
    assert.ok(xml, "The v1.0 source must contain word/document.xml.");

    const paragraphMatches = Array.from(xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g));
    const title = paragraphMatches.find((match) => plainText(match[0]) === "INDEPENDENT CONTRACTOR AGREEMENT");
    assert.ok(title?.index !== undefined, "The agreement title paragraph was not found.");
    const watermark = paragraph("DEMONSTRATION DOCUMENT — NOT REPRESENTED AS LEGAL ADVICE OR A COMMERCIAL REMEDY", true);
    xml = `${xml.slice(0, title.index + title[0].length)}${watermark}${xml.slice(title.index + title[0].length)}`;

    const updatedParagraphs = Array.from(xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g));
    const compensation = updatedParagraphs.find((match) => plainText(match[0]).startsWith("EXPENSES AND COMPENSATION -"));
    assert.ok(compensation?.index !== undefined, "The compensation paragraph was not found.");
    const compensationText = "EXPENSES AND COMPENSATION - Owner's obligation to Contractor is {{compensation_terms}}. Owner shall have no additional or further obligation to pay or reimburse Contractor for expenses of overhead, insurance, taxes, vehicle use or otherwise, except as the parties may agree by written agreement signed by both parties.";
    xml = `${xml.slice(0, compensation.index)}${paragraph(compensationText)}${xml.slice(compensation.index + compensation[0].length)}`;

    const signatureParagraphs = Array.from(xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g));
    const signatureStart = signatureParagraphs.find((match) => plainText(match[0]) === "OWNER: {{owner_name}}");
    const signatureEnd = signatureParagraphs.find((match) => plainText(match[0]) === "Date: {{contractor_signatory_date}}");
    assert.ok(signatureStart?.index !== undefined, "The owner signature start was not found.");
    assert.ok(signatureEnd?.index !== undefined, "The contractor signature end was not found.");
    const signature = [
        paragraph("OWNER: {{owner_name}}", true),
        paragraph("By: _____________________________ (SEAL)"),
        paragraph("Name: {{owner_signatory_name}}"),
        paragraph("Title/Capacity: {{owner_signatory_title}}"),
        paragraph("Date: {{owner_signatory_date}}"),
        paragraph("CONTRACTOR: {{contractor_name}}", true),
        paragraph("By: _____________________________ (SEAL)"),
        paragraph("Name: {{contractor_signatory_name}}"),
        paragraph("Title/Capacity: {{contractor_signatory_title}}"),
        paragraph("Date: {{contractor_signatory_date}}"),
    ].join("");
    xml = `${xml.slice(0, signatureStart.index)}${signature}${xml.slice(signatureEnd.index + signatureEnd[0].length)}`;

    const text = plainText(xml);
    const tags = Array.from(xml.matchAll(/\{\{([^{}]+)\}\}/g), (match) => match[1]);
    assert.equal(new Set(tags).size, 32);
    for (const required of ["owner_signatory_title", "contractor_signatory_title", "compensation_terms"]) assert.ok(tags.includes(required));
    for (const forbidden of ["One (1) years", "1 years", "North Carolina_,_______", "Contractor shall assign not any right", "pay commissions as set forth in writing"]) assert.equal(text.includes(forbidden), false, `Forbidden artifact remains: ${forbidden}`);

    zip.file("word/document.xml", xml);
    const output = zip.generate({ type: "uint8array", compression: "DEFLATE", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    await writeFile(outputPath, output);
    log_message(`Created v1.1 template at ${outputPath} with 32 unique tags.`);
}

void main().catch((error: unknown) => {
    log_message(`v1.1 template creation failed: ${error instanceof Error ? error.message : "Unknown error."}`);
    process.exitCode = 1;
});

// Version history
// 20260716033000.0 - Created the bounded v1.1 template from v1.0 with watermark, explicit compensation, separate titles, and one date block.
