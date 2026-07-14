// ver 20260714141100.0

import { getProvider } from "./registry";
import { AssuranceRecord, IncidentRecord, createVaultId } from "./vault";

export const RECOURSE_DEMO_POLICY = "DEMONSTRATION POLICY — the following support, correction, reissue, refund/credit, review, and escalation paths illustrate the mechanism; no commercial or legal remedy has been approved or is promised.";

export interface FailureFacts {
    whatHappened: string;
    whoRejectedOrChallenged: string;
    dateOfFailure: string;
    evidenceReferences: string[];
}

export function createIncidentRecord(assurance: AssuranceRecord, facts: FailureFacts): IncidentRecord {
    const provider = getProvider(assurance.providerId);
    return {
        id: createVaultId("incident"),
        generationId: assurance.generationId,
        createdAt: new Date().toISOString(),
        whatHappened: facts.whatHappened,
        whoRejectedOrChallenged: facts.whoRejectedOrChallenged,
        dateOfFailure: facts.dateOfFailure,
        evidenceReferences: facts.evidenceReferences,
        firstResponseOwner: provider.escalationContact,
        remedyPolicy: RECOURSE_DEMO_POLICY,
        assuranceRecord: assurance,
        outputSha256: assurance.outputSha256,
        providerId: assurance.providerId,
        formVersion: assurance.formVersion,
        intakeVersion: assurance.intakeVersion,
        warnings: assurance.warnings,
    };
}

// Version history
// 20260714141100.0 - Added portable incident construction with full generation evidence and demonstration remedy policy.
