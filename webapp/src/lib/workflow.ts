// ver 20260714133400.1

import { generateDocument, GeneratedDocument } from "./generate";
import { evaluateRegistryGate, getForm, getProvider } from "./registry";
import { INDEPENDENT_CONTRACTOR_FIELD_IDS } from "./variables";
import { ConsistencyResult, projectIndependentContractor } from "./canonical";
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

export interface WorkflowState {
    matter: MatterRecord;
    answers: Record<string, string>;
    provenance: Record<string, string>;
    consistencyChecks: ConsistencyResult[];
}

export async function loadCanonicalProjection(masterKey: CryptoKey, ownerBusinessDescription = "") {
    await migrateLegacyParties(masterKey);
    const [snapshot, relationships] = await Promise.all([getCanonicalSnapshot(masterKey), listRelationships()]);
    const relationship = relationships.find((item) => item.type === "company-contractor");
    if (!relationship) return { fields: {}, provenance: {}, checks: [] as ConsistencyResult[] };
    return projectIndependentContractor(snapshot, relationship.fromPartyId, relationship.toPartyId, ownerBusinessDescription);
}

export async function loadWorkflowState(masterKey: CryptoKey): Promise<WorkflowState> {
    const existing = await getMatter(INDEPENDENT_CONTRACTOR_MATTER_ID, masterKey);
    const matter: MatterRecord = existing ?? {
        id: INDEPENDENT_CONTRACTOR_MATTER_ID,
        workflowId: "independent-contractor-nc",
        answers: {},
        auditHistory: [],
        updatedAt: new Date().toISOString(),
    };
    const answers = { ...matter.answers };
    const provenance: Record<string, string> = Object.fromEntries(Object.keys(matter.answers).map((fieldId) => [fieldId, "saved matter answer"]));
    for (const fact of await listFacts(masterKey)) {
        if (INDEPENDENT_CONTRACTOR_FIELD_IDS.includes(fact.fieldId)) {
            answers[fact.fieldId] = fact.value;
            provenance[fact.fieldId] = `${fact.source} · confirmed ${new Date(fact.lastConfirmedAt).toLocaleDateString()}`;
        }
    }
    const canonical = await loadCanonicalProjection(masterKey, answers.owner_business_description ?? "");
    Object.assign(answers, canonical.fields);
    Object.assign(provenance, canonical.provenance);
    return { matter, answers, provenance, consistencyChecks: canonical.checks };
}

export async function persistMatter(
    masterKey: CryptoKey,
    answers: Record<string, string>,
    auditHistory: MatterAuditEvent[],
): Promise<MatterRecord> {
    const matter: MatterRecord = {
        id: INDEPENDENT_CONTRACTOR_MATTER_ID,
        workflowId: "independent-contractor-nc",
        answers,
        auditHistory,
        updatedAt: new Date().toISOString(),
    };
    await saveMatter(matter, masterKey);
    return matter;
}

export function updateScopeAudit(
    auditHistory: MatterAuditEvent[],
    code: string,
    message: string,
    isActive: boolean,
): MatterAuditEvent[] {
    const now = new Date().toISOString();
    const existingActive = auditHistory.some((event) => event.code === code && event.status === "active");
    if (isActive && !existingActive) {
        return [...auditHistory, { id: crypto.randomUUID(), timestamp: now, code, message, status: "active" }];
    }
    if (!isActive && existingActive) {
        return auditHistory.map((event) => event.code === code && event.status === "active" ? { ...event, status: "resolved" as const } : event);
    }
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

export async function generateWorkflowDocument(
    masterKey: CryptoKey,
    answers: Record<string, string>,
    provenance: Record<string, string>,
    auditHistory: MatterAuditEvent[],
    download = true,
): Promise<{ assurance: AssuranceRecord; generated: GeneratedDocument }> {
    const gate = getWorkflowGate(answers);
    if (!gate.canRepresentAsApproved) {
        throw new Error(`Generation blocked. ${gate.blockingConditions.join(" ")}`);
    }
    const canonical = await loadCanonicalProjection(masterKey, answers.owner_business_description ?? "");
    const canonicalBlocking = canonical.checks.filter((check) => check.classification === "BLOCKING");
    if (canonicalBlocking.length > 0) throw new Error(`Generation blocked. ${canonicalBlocking.map((check) => check.message).join(" ")}`);
    const inputs = Object.fromEntries(INDEPENDENT_CONTRACTOR_FIELD_IDS.map((fieldId) => [fieldId, answers[fieldId]?.trim() ?? ""]));
    const missing = Object.entries(inputs).filter(([, value]) => !value).map(([fieldId]) => fieldId);
    if (missing.length > 0) throw new Error(`Complete the missing fields before generation: ${missing.join(", ")}`);

    const form = getForm("independent-contractor-nc");
    const provider = getProvider(form.providerId);
    const generationId = crypto.randomUUID();
    const ownerSlug = inputs.owner_name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Owner";
    const fileName = `ELV-Independent-Contractor-${ownerSlug}-${generationId.slice(0, 8)}.docx`;
    const generated = await generateDocument("/templates/independent-contractor-fixed2.docx", inputs, fileName, download);
    const inputsUsed: Record<string, AssuranceInput> = Object.fromEntries(Object.entries(inputs).map(([fieldId, value]) => [fieldId, { value, provenance: provenance[fieldId] ?? "transaction-specific user entry" }]));
    const resolvedWarnings = auditHistory.filter((event) => event.status === "resolved").map((event) => event.message);
    const assurance: AssuranceRecord = {
        generationId,
        timestamp: new Date().toISOString(),
        templateId: form.templateId,
        formVersion: form.formVersion,
        intakeVersion: form.intakeVersion,
        providerId: provider.id,
        inputsUsed,
        activeWarnings: gate.activeWarnings,
        resolvedWarnings,
        blockingConditions: gate.blockingConditions,
        informationalNotices: [...gate.informationalNotices, ...canonical.checks.filter((check) => check.classification !== "BLOCKING").map((check) => `${check.classification}: ${check.message}`)],
        warnings: [...gate.activeWarnings, ...resolvedWarnings],
        exclusions: form.unsupportedCircumstances,
        outputSha256: generated.outputSha256,
        fileName,
        matterId: INDEPENDENT_CONTRACTOR_MATTER_ID,
        approvalRepresentation: "demo-approved",
    };
    await persistMatter(masterKey, answers, auditHistory);
    await saveGeneration(assurance, masterKey);
    await saveGeneratedDocument(generationId, generated.bytes, masterKey);
    return { assurance, generated };
}

// Version history
// 20260714133400.0 - Added vault-prefill provenance, persistent scope audit, gating, deterministic generation, and assurance persistence.
// 20260714133400.1 - Projected canonical party records into unchanged template tags and enforced canonical pre-generation checks.
