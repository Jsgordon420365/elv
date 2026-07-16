// ver 20260715130000.0

export type ApprovedSourceClassification =
    | "CURRENT_INTAKE_CONFIRMED"
    | "CANONICAL_VAULT_CONFIRMED"
    | "DETERMINISTIC_DERIVATION"
    | "APPROVED_FIXED_TEMPLATE_TEXT";

export interface GenerationProvenanceEntry {
    renderedValue: string;
    sourceRecord: string;
    classification: ApprovedSourceClassification;
    lastConfirmedAt: string;
    transformationApplied: string;
}

export interface SavedAnswerProvenance {
    sourceRecord: string;
    classification: ApprovedSourceClassification | "UNCONFIRMED_LEGACY";
    lastConfirmedAt: string;
    transformationApplied: string;
}

export function currentIntakeProvenance(fieldId: string, value: string, confirmedAt = new Date().toISOString()): GenerationProvenanceEntry {
    return {
        renderedValue: value,
        sourceRecord: `matter-answer:${fieldId}`,
        classification: "CURRENT_INTAKE_CONFIRMED",
        lastConfirmedAt: confirmedAt,
        transformationApplied: "none",
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
