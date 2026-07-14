// ver 20260714131300.0

import registryData from "@/registry/registry.json";

export interface ProviderRecord {
    id: string;
    name: string;
    type: "law-firm-maintained-template-publisher";
    professionalStatus: string;
    goodStanding: boolean;
    effectiveDate: string;
    expirationDate: string;
    contactEmail: string;
    escalationContact: string;
    responsibleMaintainer: string;
    requiredAttestations: string[];
    insuranceOrIndemnification: {
        configured: boolean;
        note: string;
    };
}

export interface FormRecord {
    id: string;
    providerId: string;
    templateId: string;
    jurisdiction: string;
    scope: string;
    formVersion: string;
    intakeVersion: string;
    approvalStatus: "demo-approved" | "unreviewed" | "suspended";
    maintenanceStatus: "maintained-demo" | "unreviewed" | "suspended";
    effectiveDate: string;
    expirationDate: string;
    supportedCircumstances: string[];
    unsupportedCircumstances: string[];
    executionRequirements: string[];
    lifecycle: "active" | "suspended" | "expired";
}

export interface RegistryData {
    providers: ProviderRecord[];
    forms: FormRecord[];
}

export interface ScopeAnswers {
    relationshipCharacterization?: "independent-contractor" | "employment";
    forumState?: string;
    arbitrationState?: string;
    includesMinor?: boolean;
}

export interface GatingResult {
    canRepresentAsApproved: boolean;
    representation: "demo-approved" | "blocked";
    activeWarnings: string[];
    blockingConditions: string[];
    informationalNotices: string[];
}

export const registry = registryData as RegistryData;

export function getProvider(providerId: string): ProviderRecord {
    const provider = registry.providers.find((item) => item.id === providerId);
    if (!provider) throw new Error(`Provider not found: ${providerId}`);
    return provider;
}

export function getForm(formId: string): FormRecord {
    const form = registry.forms.find((item) => item.id === formId);
    if (!form) throw new Error(`Form not found: ${formId}`);
    return form;
}

function isDateInsideWindow(date: Date, effectiveDate: string, expirationDate: string): boolean {
    const day = date.toISOString().slice(0, 10);
    return day >= effectiveDate && day <= expirationDate;
}

export function evaluateRegistryGate(
    provider: ProviderRecord,
    form: FormRecord,
    answers: ScopeAnswers,
    now = new Date(),
): GatingResult {
    const blockingConditions: string[] = [];

    if (!provider.goodStanding) {
        blockingConditions.push("Provider good standing is not confirmed.");
    }
    if (!isDateInsideWindow(now, provider.effectiveDate, provider.expirationDate)) {
        blockingConditions.push("Provider registry record is not currently effective.");
    }
    if (form.approvalStatus !== "demo-approved") {
        blockingConditions.push(`Form approval status is ${form.approvalStatus}.`);
    }
    if (form.maintenanceStatus !== "maintained-demo") {
        blockingConditions.push(`Form maintenance status is ${form.maintenanceStatus}.`);
    }
    if (form.lifecycle !== "active" || !isDateInsideWindow(now, form.effectiveDate, form.expirationDate)) {
        blockingConditions.push("Form is suspended, expired, or outside its effective window.");
    }
    if (answers.relationshipCharacterization === "employment") {
        blockingConditions.push("Employee relationships are outside this workflow's supported circumstances.");
    }
    if (answers.includesMinor) {
        blockingConditions.push("Minors as parties are outside this workflow's supported circumstances.");
    }
    if (answers.forumState && answers.forumState.trim().toLowerCase() !== "north carolina") {
        blockingConditions.push("An out-of-North-Carolina forum is outside this workflow's supported circumstances.");
    }
    if (answers.arbitrationState && answers.arbitrationState.trim().toLowerCase() !== "north carolina") {
        blockingConditions.push("An out-of-North-Carolina arbitration state is outside this workflow's supported circumstances.");
    }

    const activeWarnings = blockingConditions.map((condition) => `${condition} This is outside what this workflow was designed to cover. Consider consulting a licensed attorney.`);
    return {
        canRepresentAsApproved: blockingConditions.length === 0,
        representation: blockingConditions.length === 0 ? "demo-approved" : "blocked",
        activeWarnings,
        blockingConditions,
        informationalNotices: [provider.insuranceOrIndemnification.note],
    };
}

// Version history
// 20260714131300.0 - Added typed local registry access and executable provider, form-status, date, and intake-scope gating.
