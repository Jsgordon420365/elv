// ver 20260715130000.1

export type ApprovedSourceClassification =
    | "CURRENT_INTAKE_CONFIRMED"
    | "CANONICAL_VAULT_CONFIRMED"
    | "DETERMINISTIC_DERIVATION"
    | "APPROVED_FIXED_TEMPLATE_TEXT";

export interface GenerationProvenanceEntry {
    tag?: string;
    value?: string;
    renderedValue: string;
    sourceRecord: string;
    sourceRecordId?: string;
    sourceField?: string;
    classification: ApprovedSourceClassification;
    sourceClass?: ApprovedSourceClassification;
    lastConfirmedAt: string;
    transformationApplied: string;
    transformation?: string;
    templateId?: string;
    templateVersion?: string;
    intakeVersion?: string;
    generationId?: string;
    timestamp?: string;
    transactionId?: string;
}

export interface SavedAnswerProvenance {
    sourceRecord: string;
    classification: ApprovedSourceClassification | "UNCONFIRMED_LEGACY";
    lastConfirmedAt: string;
    transformationApplied: string;
    transactionId?: string;
}

export function currentIntakeProvenance(fieldId: string, value: string, confirmedAt = new Date().toISOString(), transactionId?: string): GenerationProvenanceEntry {
    return {
        renderedValue: value,
        sourceRecord: `matter-answer:${fieldId}`,
        classification: "CURRENT_INTAKE_CONFIRMED",
        lastConfirmedAt: confirmedAt,
        transformationApplied: "none",
        transactionId,
    };
}

export function isApprovedGenerationProvenance(value: unknown): value is GenerationProvenanceEntry {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<GenerationProvenanceEntry>;
    return ["CURRENT_INTAKE_CONFIRMED", "CANONICAL_VAULT_CONFIRMED", "DETERMINISTIC_DERIVATION", "APPROVED_FIXED_TEMPLATE_TEXT"].includes(candidate.classification ?? "")
        && typeof candidate.sourceRecord === "string"
        && typeof candidate.lastConfirmedAt === "string"
        && typeof candidate.transformationApplied === "string";
}

// Version history
// 20260715130000.0 - Added the four approved generation-source classifications and structured provenance records.
// 20260715130000.1 - Added transaction binding and complete ledger metadata fields while retaining compatibility aliases.
