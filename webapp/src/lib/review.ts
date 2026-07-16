// ver 20260716033500.0

import { GenerationProvenanceEntry } from "./provenance";

export type ReviewKind = "individual" | "grouped" | "stated-concern" | "informational";

export interface ReviewItem {
    id: string;
    title: string;
    kind: ReviewKind;
    fieldIds: string[];
    summary: string;
    required: boolean;
    concern?: string;
}

export interface ReviewConfirmation {
    itemId: string;
    kind: ReviewKind;
    fieldIds: string[];
    valueFingerprint: string;
    confirmedAt: string;
    transactionId: string;
    statedConcern?: string;
}

function normalizedOrUnstable(fieldIds: string[], provenance: Record<string, GenerationProvenanceEntry>): boolean {
    return fieldIds.some((fieldId) => {
        const item = provenance[fieldId];
        return !item || /normalized|legacy|unresolved|changed|stale|inconsistent/i.test(`${item.transformationApplied} ${item.sourceRecord}`);
    });
}

export function reviewFingerprint(fieldIds: string[], answers: Record<string, string>): string {
    return fieldIds.map((fieldId) => `${fieldId}=${answers[fieldId] ?? ""}`).join("\u001f");
}

export function buildReviewItems(answers: Record<string, string>, provenance: Record<string, GenerationProvenanceEntry>): ReviewItem[] {
    const items: ReviewItem[] = [
        { id: "parties", title: "Parties", kind: "individual", fieldIds: ["owner_name", "contractor_name"], summary: "Confirm both contracting parties by legal name.", required: true },
        { id: "signatories-capacities", title: "Signatories and capacities", kind: "individual", fieldIds: ["owner_signatory_name", "owner_signatory_title", "contractor_signatory_name", "contractor_signatory_title"], summary: "Confirm each human signatory and the title or capacity used for execution.", required: true },
        { id: "scope", title: "Scope of services", kind: "individual", fieldIds: ["scope_agr_longtext"], summary: "Confirm the services requested for this transaction.", required: true },
        { id: "business-description", title: "Owner business description", kind: "individual", fieldIds: ["owner_business_description"], summary: "Confirm the business description used by the covenant language.", required: true },
        { id: "compensation-structure", title: "Compensation structure", kind: "individual", fieldIds: ["compensation_structure", "compensation_terms"], summary: "Confirm the selected compensation structure and rendered compensation terms.", required: true },
        { id: "effective-date", title: "Effective date", kind: "individual", fieldIds: ["agreement_start_date"], summary: "Confirm when the agreement begins.", required: true },
        { id: "execution-date-treatment", title: "Execution-date treatment", kind: "individual", fieldIds: ["execution_date_treatment", "owner_signatory_date", "contractor_signatory_date"], summary: "Confirm either two populated execution dates or two blank signature-date lines.", required: true },
        { id: "covenants", title: "Covenant duration and territory", kind: "individual", fieldIds: ["court_amended_miles", "court_amended_years", "hire_away_duration_years_num", "hire_away_duration_years_text", "non_compete_duration_years_num", "non_compete_duration_years_text", "non_compete_radius_miles", "non_compete_states", "non_solicit_employees_duration_years_num", "non_solicit_employees_duration_years_text"], summary: "Confirm all restrictive-covenant durations and territory.", required: true },
    ];
    const ownerAddressFields = ["owner_add1", "owner_add2"];
    const contractorAddressFields = ["contr_add1", "contr_add2"];
    if (normalizedOrUnstable([...ownerAddressFields, ...contractorAddressFields], provenance)) {
        items.push({ id: "owner-address", title: "Owner address", kind: "individual", fieldIds: ownerAddressFields, summary: "This address was normalized, migrated, changed, stale, ambiguous, or inconsistent and requires individual confirmation.", required: true });
        items.push({ id: "contractor-address", title: "Contractor address", kind: "individual", fieldIds: contractorAddressFields, summary: "This address was normalized, migrated, changed, stale, ambiguous, or inconsistent and requires individual confirmation.", required: true });
    } else {
        items.push({ id: "stable-addresses", title: "Stable party addresses", kind: "grouped", fieldIds: [...ownerAddressFields, ...contractorAddressFields], summary: "Grouped address confirmation is permitted because both address projections are stable and unambiguous.", required: true });
    }
    if (answers.compensation_structure === "commissions" && !/commission|sales|revenue/i.test(answers.scope_agr_longtext ?? "")) {
        items.push({ id: "compensation-scope-concern", title: "Compensation and scope concern", kind: "stated-concern", fieldIds: ["compensation_structure", "scope_agr_longtext"], summary: "Commission compensation is selected but the scope does not describe commission, sales, or revenue work.", concern: "Software-detected compensation/scope mismatch; human confirmation does not resolve legal suitability.", required: true });
    }
    const covenantOutlier = ["court_amended_years", "hire_away_duration_years_num", "non_compete_duration_years_num", "non_solicit_employees_duration_years_num"].some((fieldId) => Number(answers[fieldId]) > 2)
        || Number(answers.non_compete_radius_miles) > 50
        || /,|;/.test(answers.non_compete_states ?? "");
    if (covenantOutlier) items.push({ id: "covenant-outlier-concern", title: "Covenant outlier concern", kind: "stated-concern", fieldIds: ["non_compete_duration_years_num", "non_compete_radius_miles", "non_compete_states"], summary: "One or more covenant values exceed the demonstration's ordinary review thresholds.", concern: "Software-detected covenant outlier; a human must decide whether to continue.", required: true });
    const normalizations = Object.entries(provenance).filter(([, item]) => /normalized/i.test(item.transformationApplied));
    if (normalizations.length > 0) items.push({ id: "normalizations", title: "Deterministic normalizations", kind: "informational", fieldIds: normalizations.map(([fieldId]) => fieldId), summary: normalizations.map(([fieldId, item]) => `${fieldId}: ${item.transformationApplied}`).join("; "), required: false });
    items.push({ id: "fixed-clauses", title: "Fixed template clauses", kind: "informational", fieldIds: [], summary: "The maintained v1.1 fixed clauses remain provider-controlled and are not supplied by hidden intake defaults.", required: false });
    return items;
}

export function createReviewConfirmation(item: ReviewItem, answers: Record<string, string>, transactionId: string, confirmedAt = new Date().toISOString()): ReviewConfirmation {
    return { itemId: item.id, kind: item.kind, fieldIds: item.fieldIds, valueFingerprint: reviewFingerprint(item.fieldIds, answers), confirmedAt, transactionId, statedConcern: item.kind === "stated-concern" ? item.concern : undefined };
}

export function missingReviewConfirmations(items: ReviewItem[], confirmations: Record<string, ReviewConfirmation>, answers: Record<string, string>, transactionId: string): string[] {
    return items.filter((item) => item.required).filter((item) => {
        const confirmation = confirmations[item.id];
        return !confirmation || confirmation.transactionId !== transactionId || confirmation.valueFingerprint !== reviewFingerprint(item.fieldIds, answers) || (item.kind === "stated-concern" && confirmation.statedConcern !== item.concern);
    }).map((item) => item.id);
}

// Version history
// 20260716033500.0 - Added granular, fingerprint-bound review items, grouped stable addresses, stated concerns, and informational notices.
