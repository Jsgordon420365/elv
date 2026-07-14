// ver 20260714141100.0

import PizZip from "pizzip";
import { DOCX_MIME_TYPE } from "./generate";
import {
    getGeneratedDocument,
    listFacts,
    listGenerations,
    listIncidents,
    listParties,
    listRelationships,
} from "./vault";

export interface PortableExport {
    bytes: Uint8Array;
    blob: Blob;
    fileName: string;
    generationId: string;
}

export async function buildPortableExport(masterKey: CryptoKey): Promise<PortableExport> {
    const [parties, relationships, facts, generations, incidents] = await Promise.all([
        listParties(masterKey),
        listRelationships(),
        listFacts(masterKey),
        listGenerations(masterKey),
        listIncidents(masterKey),
    ]);
    const latest = generations.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
    if (!latest) throw new Error("Generate at least one document before exporting.");
    const documentBytes = await getGeneratedDocument(latest.generationId, masterKey);
    if (!documentBytes) throw new Error("The latest generated DOCX is missing from the encrypted vault.");

    const generatedAt = new Date().toISOString();
    const vaultExport = {
        exportVersion: "1.0",
        generatedAt,
        authorization: "The user explicitly initiated Export, authorizing local decryption and packaging.",
        parties,
        relationships,
        facts,
        assuranceRecords: generations,
        incidentRecords: incidents,
    };
    const zip = new PizZip();
    zip.file("vault-export.json", JSON.stringify(vaultExport, null, 2));
    zip.file("latest-generated-document.docx", documentBytes, { binary: true });
    zip.file("latest-assurance-record.json", JSON.stringify(latest, null, 2));
    if (incidents.length > 0) zip.file("incidents.json", JSON.stringify(incidents, null, 2));
    zip.file("README.txt", [
        "ELV / LegalFlowNC portable customer export",
        `Generated: ${generatedAt}`,
        "",
        "vault-export.json — decrypted structured parties, relationships, facts, provenance metadata, assurance records, and incident records.",
        "latest-generated-document.docx — the latest generated document.",
        "latest-assurance-record.json — evidence for the latest generation.",
        "incidents.json — portable recourse records, included when incidents exist.",
        "",
        "This archive was created only after the user explicitly selected Export and accepted the visible plaintext packaging warning.",
    ].join("\r\n"));
    const bytes = zip.generate({ type: "uint8array", compression: "DEFLATE", mimeType: "application/zip" });
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return {
        bytes,
        blob: new Blob([copy.buffer], { type: "application/zip" }),
        fileName: `ELV-portable-export-${latest.generationId.slice(0, 8)}.zip`,
        generationId: latest.generationId,
    };
}

export function isDocxMimeType(value: string): boolean {
    return value === DOCX_MIME_TYPE;
}

// Version history
// 20260714141100.0 - Added one-click ZIP packaging of decrypted customer data, latest DOCX, assurance evidence, incidents, and README.
