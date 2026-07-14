// ver 20260714124000.1

import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

export const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface GeneratedDocument {
    bytes: Uint8Array;
    blob: Blob;
    documentXml: string;
    outputSha256: string;
    fileName: string;
}

export function mergeTemplateBytes(template: ArrayBuffer | Uint8Array, data: Record<string, string>): Uint8Array {
    const zip = new PizZip(template);
    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: "{{", end: "}}" },
    });

    doc.render(data);

    return doc.getZip().generate({
        type: "uint8array",
        compression: "DEFLATE",
        mimeType: DOCX_MIME_TYPE,
    });
}

export function readDocumentXml(docxBytes: ArrayBuffer | Uint8Array): string {
    const zip = new PizZip(docxBytes);
    const documentXml = zip.file("word/document.xml")?.asText();
    if (!documentXml) {
        throw new Error("Invalid DOCX package: word/document.xml is missing.");
    }
    return documentXml;
}

function copyToArrayBuffer(value: ArrayBuffer | Uint8Array): ArrayBuffer {
    const source = value instanceof Uint8Array ? value : new Uint8Array(value);
    const copy = new Uint8Array(source.byteLength);
    copy.set(source);
    return copy.buffer;
}

export async function sha256Hex(value: string | ArrayBuffer | Uint8Array): Promise<string> {
    const valueBytes = typeof value === "string"
        ? new TextEncoder().encode(value)
        : value;
    const digest = await crypto.subtle.digest("SHA-256", copyToArrayBuffer(valueBytes));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function buildDocument(
    template: ArrayBuffer | Uint8Array,
    data: Record<string, string>,
    fileName: string,
): Promise<GeneratedDocument> {
    const bytes = mergeTemplateBytes(template, data);
    const documentXml = readDocumentXml(bytes);
    const outputSha256 = await sha256Hex(documentXml);
    const blob = new Blob([copyToArrayBuffer(bytes)], { type: DOCX_MIME_TYPE });
    return { bytes, blob, documentXml, outputSha256, fileName };
}

export async function generateDocument(
    templatePath: string,
    data: Record<string, string>,
    fileName: string,
    download = true,
): Promise<GeneratedDocument> {
    const response = await fetch(templatePath);
    if (!response.ok) {
        throw new Error(`Failed to fetch template: ${templatePath}`);
    }

    try {
        const generated = await buildDocument(await response.arrayBuffer(), data, fileName);
        if (download) {
            const { saveAs } = await import("file-saver");
            saveAs(generated.blob, fileName);
        }
        return generated;
    } catch (error: unknown) {
        const templateError = error as { properties?: { errors?: Array<{ message: string }> } };
        if (Array.isArray(templateError.properties?.errors)) {
            const messages = templateError.properties.errors.map((item) => item.message).join("\n");
            throw new Error(`Template Error: ${messages}`);
        }
        throw error;
    }
}

// Version history
// 20260714124000.0 - Added double-brace delimiters, deterministic merge helpers, package validation, and document.xml hashing.
// 20260714124000.1 - Copied typed-array data into owned ArrayBuffers for strict WebCrypto and Blob typing.
