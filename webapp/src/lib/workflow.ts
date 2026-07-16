// ver 20260714133400.4

import { generateDocument, GeneratedDocument } from "./generate";
import { evaluateRegistryGate, getForm, getProvider } from "./registry";
import { INDEPENDENT_CONTRACTOR_FIELD_IDS } from "./variables";
import { ConsistencyResult, projectIndependentContractor } from "./canonical";
import { GenerationProvenanceEntry, isApprovedGenerationProvenance } from "./provenance";
import { ReviewConfirmation, buildReviewItems, missingReviewConfirmations } from "./review";
import {
    AssuranceInput,
    AssuranceRecord,
    MatterAuditEvent,
    MatterRecord,
    getMatter,
    getCanonicalSnapshot,
    listFacts,
    listRelationships,
    migrateLegacyParties,
    saveGeneratedDocument,
    saveGeneration,
    saveMatter,
} from "./vault";

export const INDEPENDENT_CONTRACTOR_MATTER_ID = "independent-contractor-demo-matter";
export const OUT_OF_SCOPE_MESSAGE = "This is outside what this workflow was designed to cover. Consider consulting a licensed attorney.";

const DATE_FIELDS = ["owner_signatory_date", "contractor_signatory_date"] as const;
const DURATION_NUMBER_FIELDS = new Set([
    "agreement_duration_years_num",
    "court_amended_years",
    "hire_away_duration_years_num",
    "non_compete_duration_years_num",
    "non_solicit_employees_duration_years_num",
]);
const TEMPLATE_PUNCTUATED_FIELDS = new Set(["owner_business_description", "non_compete_states", "arbitration_state", "forum_county_comma_state"]);

export interface WorkflowState {
    matter: MatterRecord;
    answers: Record<string, string>;
    provenance: Record<string, GenerationProvenanceEntry>;
    consistencyChecks: ConsistencyResult[];
    unconfirmedFields: string[];
    reviewConfirmations: Record<string, ReviewConfirmation>;
}

export interface PreparedGeneration {
    inputs: Record<string, string>;
    report: Record<string, GenerationProvenanceEntry>;
    missingValues: string[];
    missingProvenance: string[];
}

export interface PreparationContext {
    transactionId?: string;
    templateId?: string;
    templateVersion?: string;
    intakeVersion?: string;
    generationId?: string;
    timestamp?: string;
}

export async function loadCanonicalProjection(masterKey: CryptoKey, ownerBusinessDescription = "") {
    await migrateLegacyParties(masterKey);
    const [snapshot, relationships] = await Promise.all([getCanonicalSnapshot(masterKey), listRelationships()]);
    const relationship = relationships.find((item) => item.type === "company-contractor");
    if (!relationship) return { fields: {}, provenance: {}, checks: [] as ConsistencyResult[] };
    return projectIndependentContractor(snapshot, relationship.fromPartyId, relationship.toPartyId, ownerBusinessDescription);
}

function savedEntry(fieldId: string, value: string, matter: MatterRecord): GenerationProvenanceEntry | null {
    const saved = matter.answerProvenance?.[fieldId];
    if (!saved || saved.classification === "UNCONFIRMED_LEGACY") return null;
    return { renderedValue: value, sourceRecord: saved.sourceRecord, classification: saved.classification, lastConfirmedAt: saved.lastConfirmedAt, transformationApplied: saved.transformationApplied, transactionId: saved.transactionId };
}

export async function loadWorkflowState(masterKey: CryptoKey): Promise<WorkflowState> {
    const existing = await getMatter(INDEPENDENT_CONTRACTOR_MATTER_ID, masterKey);
    const matter: MatterRecord = existing ?? { id: INDEPENDENT_CONTRACTOR_MATTER_ID, workflowId: "independent-contractor-nc", answers: {}, auditHistory: [], answerProvenance: {}, reviewConfirmations: {}, updatedAt: new Date().toISOString() };
    const answers = { ...matter.answers };
    const provenance: Record<string, GenerationProvenanceEntry> = {};
    for (const [fieldId, value] of Object.entries(answers)) {
        const entry = savedEntry(fieldId, value, matter);
        if (entry) provenance[fieldId] = entry;
    }
    for (const fact of await listFacts(masterKey)) {
        if (INDEPENDENT_CONTRACTOR_FIELD_IDS.includes(fact.fieldId)) {
            answers[fact.fieldId] = fact.value;
            provenance[fact.fieldId] = { renderedValue: fact.value, sourceRecord: `legacy-fact:${fact.id}`, classification: "CANONICAL_VAULT_CONFIRMED", lastConfirmedAt: fact.lastConfirmedAt, transformationApplied: "preserved legacy compatibility fact" };
        }
    }
    const canonical = await loadCanonicalProjection(masterKey, answers.owner_business_description ?? "");
    Object.assign(answers, canonical.fields);
    Object.assign(provenance, canonical.provenance);
    if (answers.forum_county && answers.forum_state && provenance.forum_county && provenance.forum_state) {
        const renderedValue = `${answers.forum_county}, ${answers.forum_state}`;
        answers.forum_county_comma_state = renderedValue;
        provenance.forum_county_comma_state = { renderedValue, sourceRecord: `${provenance.forum_county.sourceRecord};${provenance.forum_state.sourceRecord}`, classification: "DETERMINISTIC_DERIVATION", lastConfirmedAt: [provenance.forum_county.lastConfirmedAt, provenance.forum_state.lastConfirmedAt].sort().at(-1) ?? matter.updatedAt, transformationApplied: "joined separately confirmed county and state" };
    }
    const unconfirmedFields = Object.entries(answers).filter(([fieldId, value]) => value.trim() && !isApprovedGenerationProvenance(provenance[fieldId]) && fieldId !== "forum_county_comma_state").map(([fieldId]) => fieldId);
    return { matter, answers, provenance, consistencyChecks: canonical.checks, unconfirmedFields, reviewConfirmations: matter.reviewConfirmations ?? {} };
}

export async function persistMatter(masterKey: CryptoKey, answers: Record<string, string>, auditHistory: MatterAuditEvent[], provenance: Record<string, GenerationProvenanceEntry>, reviewConfirmations: Record<string, ReviewConfirmation> = {}): Promise<MatterRecord> {
    const answerProvenance = Object.fromEntries(Object.entries(answers).map(([fieldId]) => {
        const entry = provenance[fieldId];
        return [fieldId, entry ? { sourceRecord: entry.sourceRecord, classification: entry.classification, lastConfirmedAt: entry.lastConfirmedAt, transformationApplied: entry.transformationApplied, transactionId: entry.transactionId } : { sourceRecord: `legacy-matter-answer:${fieldId}`, classification: "UNCONFIRMED_LEGACY" as const, lastConfirmedAt: "", transformationApplied: "none" }];
    }));
    const matter: MatterRecord = { id: INDEPENDENT_CONTRACTOR_MATTER_ID, workflowId: "independent-contractor-nc", answers, auditHistory, answerProvenance, reviewConfirmations, updatedAt: new Date().toISOString() };
    await saveMatter(matter, masterKey);
    return matter;
}

export function updateScopeAudit(auditHistory: MatterAuditEvent[], code: string, message: string, isActive: boolean): MatterAuditEvent[] {
    const now = new Date().toISOString();
    const existingActive = auditHistory.some((event) => event.code === code && event.status === "active");
    if (isActive && !existingActive) return [...auditHistory, { id: crypto.randomUUID(), timestamp: now, code, message, status: "active" }];
    if (!isActive && existingActive) return auditHistory.map((event) => event.code === code && event.status === "active" ? { ...event, status: "resolved" as const } : event);
    return auditHistory;
}

export function getWorkflowGate(answers: Record<string, string>) {
    const form = getForm("independent-contractor-nc");
    const provider = getProvider(form.providerId);
    return evaluateRegistryGate(provider, form, {
        relationshipCharacterization: answers.relationship_characterization === "employment" ? "employment" : "independent-contractor",
        forumState: answers.forum_state,
        arbitrationState: answers.arbitration_state,
        includesMinor: answers.includes_minor === "yes",
    });
}

function compensationLabel(value: string): string {
    const labels: Record<string, string> = { "fixed-fee": "Fixed fee", hourly: "Hourly compensation", commissions: "Commissions", "other-confirmed": "Other expressly confirmed compensation" };
    return labels[value] ?? "";
}

function newestTimestamp(...values: Array<string | undefined>): string {
    return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? "";
}

function ledgerEntry(fieldId: string, value: string, source: GenerationProvenanceEntry, context: PreparationContext): GenerationProvenanceEntry {
    const sourceRecordId = source.sourceRecord.split(";")[0] || source.sourceRecord;
    return {
        ...source,
        tag: fieldId,
        value,
        renderedValue: value,
        sourceRecordId,
        sourceField: fieldId,
        sourceClass: source.classification,
        transformation: source.transformationApplied,
        templateId: context.templateId ?? "independent-contractor-v1.1.docx",
        templateVersion: context.templateVersion ?? "1.1",
        intakeVersion: context.intakeVersion ?? "1.1",
        generationId: context.generationId ?? "pre-generation-review",
        timestamp: context.timestamp ?? source.lastConfirmedAt ?? new Date().toISOString(),
    };
}

function approvedForTransaction(source: GenerationProvenanceEntry | undefined, context: PreparationContext): source is GenerationProvenanceEntry {
    if (!isApprovedGenerationProvenance(source)) return false;
    if (context.transactionId && source.classification === "CURRENT_INTAKE_CONFIRMED" && source.transactionId !== context.transactionId) return false;
    return true;
}

export function prepareGenerationInputs(answers: Record<string, string>, provenance: Record<string, GenerationProvenanceEntry>, context: PreparationContext = {}): PreparedGeneration {
    const inputs: Record<string, string> = {};
    const report: Record<string, GenerationProvenanceEntry> = {};
    const missingValues: string[] = [];
    const missingProvenance: string[] = [];
    for (const fieldId of INDEPENDENT_CONTRACTOR_FIELD_IDS) {
        if (fieldId === "compensation_terms") continue;
        const original = answers[fieldId]?.trim() ?? "";
        const source = provenance[fieldId];
        if (!original && !DATE_FIELDS.includes(fieldId as typeof DATE_FIELDS[number])) missingValues.push(fieldId);
        if (!approvedForTransaction(source, context) && !DATE_FIELDS.includes(fieldId as typeof DATE_FIELDS[number])) missingProvenance.push(fieldId);
        inputs[fieldId] = original;
        if (source) report[fieldId] = ledgerEntry(fieldId, original, source, context);
    }
    const compensationSource = provenance.compensation_structure;
    const compensation = compensationLabel(answers.compensation_structure ?? "");
    if (!compensation) missingValues.push("compensation_structure");
    if (!approvedForTransaction(compensationSource, context)) missingProvenance.push("compensation_structure");
    if (compensation && approvedForTransaction(compensationSource, context)) {
        const renderedValue = compensation === "Fixed fee" ? "to pay the fixed-fee compensation expressly confirmed by the parties" : compensation === "Hourly compensation" ? "to pay the hourly compensation expressly confirmed by the parties" : compensation === "Commissions" ? "to pay the commission compensation expressly confirmed by the parties" : "to provide the other compensation structure expressly confirmed by the parties";
        inputs.compensation_terms = renderedValue;
        report.compensation_terms = ledgerEntry("compensation_terms", renderedValue, { renderedValue, sourceRecord: compensationSource.sourceRecord, classification: "DETERMINISTIC_DERIVATION", lastConfirmedAt: compensationSource.lastConfirmedAt, transformationApplied: "mapped visibly selected compensation structure to v1.1 compensation terms", transactionId: compensationSource.transactionId }, context);
    }
    for (const fieldId of DURATION_NUMBER_FIELDS) {
        const source = provenance[fieldId];
        const number = Number(answers[fieldId]);
        if (Number.isFinite(number) && answers[fieldId]?.trim() && approvedForTransaction(source, context)) {
            const renderedValue = `${answers[fieldId].trim()} ${number === 1 ? "year" : "years"}`;
            inputs[fieldId] = renderedValue;
            report[fieldId] = ledgerEntry(fieldId, renderedValue, { ...source, renderedValue, classification: "DETERMINISTIC_DERIVATION", transformationApplied: "added singular or plural year unit from confirmed numeric value" }, context);
        }
    }
    for (const fieldId of TEMPLATE_PUNCTUATED_FIELDS) {
        const source = provenance[fieldId];
        if (inputs[fieldId] && approvedForTransaction(source, context)) {
            const renderedValue = inputs[fieldId].replace(/[\s.,;:!?]+$/g, "");
            inputs[fieldId] = renderedValue;
            report[fieldId] = ledgerEntry(fieldId, renderedValue, { ...source, renderedValue, classification: renderedValue === source.renderedValue ? source.classification : "DETERMINISTIC_DERIVATION", transformationApplied: renderedValue === source.renderedValue ? source.transformationApplied : "removed terminal punctuation because the template supplies it" }, context);
        }
    }
    const dateMode = answers.execution_date_treatment;
    const dateModeSource = provenance.execution_date_treatment;
    if (!dateMode || !approvedForTransaction(dateModeSource, context)) {
        missingValues.push("execution_date_treatment");
        missingProvenance.push("execution_date_treatment");
    } else if (dateMode === "signature-blanks") {
        for (const fieldId of DATE_FIELDS) {
            inputs[fieldId] = "";
            report[fieldId] = ledgerEntry(fieldId, "", { renderedValue: "", sourceRecord: dateModeSource.sourceRecord, classification: "DETERMINISTIC_DERIVATION", lastConfirmedAt: dateModeSource.lastConfirmedAt, transformationApplied: "confirmed signature-blanks treatment projected both execution dates as blank", transactionId: dateModeSource.transactionId }, context);
        }
    } else if (dateMode === "populated-dates") {
        const mixed = DATE_FIELDS.some((fieldId) => !(answers[fieldId] ?? "").trim());
        if (mixed) {
            for (const fieldId of DATE_FIELDS.filter((id) => !(answers[id] ?? "").trim())) missingValues.push(fieldId);
            missingValues.push("execution_date_treatment");
        }
    } else {
        missingValues.push("execution_date_treatment");
    }
    return { inputs, report, missingValues: Array.from(new Set(missingValues)), missingProvenance: Array.from(new Set(missingProvenance)) };
}

export async function generateWorkflowDocument(masterKey: CryptoKey, answers: Record<string, string>, provenance: Record<string, GenerationProvenanceEntry>, auditHistory: MatterAuditEvent[], reviewConfirmations: Record<string, ReviewConfirmation>, download = true): Promise<{ assurance: AssuranceRecord; generated: GeneratedDocument }> {
    const gate = getWorkflowGate(answers);
    if (!gate.canRepresentAsApproved) throw new Error(`Generation blocked. ${gate.blockingConditions.join(" ")}`);
    const canonical = await loadCanonicalProjection(masterKey, answers.owner_business_description ?? "");
    const canonicalBlocking = canonical.checks.filter((check) => check.classification === "BLOCKING");
    if (canonicalBlocking.length > 0) throw new Error(`Generation blocked. ${canonicalBlocking.map((check) => check.message).join(" ")}`);
    const currentAnswers = { ...answers, ...canonical.fields };
    const currentProvenance = { ...provenance, ...canonical.provenance };
    if (currentAnswers.forum_county && currentAnswers.forum_state && currentProvenance.forum_county && currentProvenance.forum_state) {
        const renderedValue = `${currentAnswers.forum_county}, ${currentAnswers.forum_state}`;
        currentAnswers.forum_county_comma_state = renderedValue;
        currentProvenance.forum_county_comma_state = { renderedValue, sourceRecord: `${currentProvenance.forum_county.sourceRecord};${currentProvenance.forum_state.sourceRecord}`, classification: "DETERMINISTIC_DERIVATION", lastConfirmedAt: newestTimestamp(currentProvenance.forum_county.lastConfirmedAt, currentProvenance.forum_state.lastConfirmedAt), transformationApplied: "joined separately confirmed county and state" };
    }
    const form = getForm("independent-contractor-nc");
    const provider = getProvider(form.providerId);
    const generationId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const prepared = prepareGenerationInputs(currentAnswers, currentProvenance, { transactionId: INDEPENDENT_CONTRACTOR_MATTER_ID, templateId: form.templateId, templateVersion: form.formVersion, intakeVersion: form.intakeVersion, generationId, timestamp });
    if (prepared.missingValues.length > 0) throw new Error(`Complete the missing fields before generation: ${prepared.missingValues.join(", ")}`);
    if (prepared.missingProvenance.length > 0) throw new Error(`Generation blocked because approved provenance is missing for: ${prepared.missingProvenance.join(", ")}`);
    const reviewItems = buildReviewItems(currentAnswers, currentProvenance);
    const missingReview = missingReviewConfirmations(reviewItems, reviewConfirmations, currentAnswers, INDEPENDENT_CONTRACTOR_MATTER_ID);
    if (missingReview.length > 0) throw new Error(`Generation blocked until pre-generation review is confirmed: ${missingReview.join(", ")}`);
    const ownerSlug = prepared.inputs.owner_name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Owner";
    const fileName = `ELV-Independent-Contractor-${ownerSlug}-${generationId.slice(0, 8)}.docx`;
    const generated = await generateDocument(`/templates/${form.templateId}`, prepared.inputs, fileName, download);
    const inputsUsed: Record<string, AssuranceInput> = Object.fromEntries(Object.entries(prepared.report).map(([fieldId, entry]) => [fieldId, { value: entry.renderedValue, provenance: entry.classification, sourceRecord: entry.sourceRecord, classification: entry.classification, lastConfirmedAt: entry.lastConfirmedAt, transformationApplied: entry.transformationApplied }]));
    const resolvedWarnings = auditHistory.filter((event) => event.status === "resolved").map((event) => event.message);
    const assurance: AssuranceRecord = {
        generationId, timestamp, templateId: form.templateId, formVersion: form.formVersion, intakeVersion: form.intakeVersion, providerId: provider.id, inputsUsed, provenanceReport: prepared.report,
        activeWarnings: gate.activeWarnings, resolvedWarnings, blockingConditions: gate.blockingConditions,
        informationalNotices: [...gate.informationalNotices, ...canonical.checks.filter((check) => check.classification !== "BLOCKING").map((check) => `${check.classification}: ${check.message}`)],
        warnings: [...gate.activeWarnings, ...resolvedWarnings], exclusions: form.unsupportedCircumstances, outputSha256: generated.outputSha256, packageSha256: generated.packageSha256, fileName, matterId: INDEPENDENT_CONTRACTOR_MATTER_ID, approvalRepresentation: "demo-approved", documentLabel: "DEMONSTRATION DOCUMENT", reviewConfirmations,
    };
    await persistMatter(masterKey, currentAnswers, auditHistory, currentProvenance, reviewConfirmations);
    await saveGeneration(assurance, masterKey);
    await saveGeneratedDocument(generationId, generated.bytes, masterKey);
    return { assurance, generated };
}

// Version history
// 20260714133400.0 - Added vault-prefill provenance, persistent scope audit, gating, deterministic generation, and assurance persistence.
// 20260714133400.1 - Projected canonical party records into unchanged template tags and enforced canonical pre-generation checks.
// 20260714133400.2 - Removed hidden defaults, required approved provenance for all 29 tags, transformed grammar deterministically, and recorded a complete generation provenance report.
// 20260714133400.3 - Added transaction-bound 32-tag ledger entries, explicit compensation, one date mode, granular review gating, and dual hashes.
// 20260714133400.4 - Deferred execution-date provenance checks to the selected treatment so two confirmed blank lines derive from one approved choice.
