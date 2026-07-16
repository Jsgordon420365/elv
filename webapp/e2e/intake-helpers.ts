// ver 20260715235500.4

import { Page } from "@playwright/test";

const fieldValues: Record<string, string> = {
    "Owner business description": "Operate a North Carolina business for the tested engagement",
    "Scope of services": "Provide the expressly reviewed services and written deliverables described by the parties",
    "Agreement start date": "2026-07-15",
    "Agreement duration in words": "One",
    "Agreement duration in years": "1",
    "Termination notice days": "30",
    "Arbitration city": "Greensboro",
    "Arbitration state": "North Carolina",
    "Court-amended radius in miles": "25",
    "Court-amended duration in years": "1",
    "Hire-away duration in years": "1",
    "Hire-away duration in words": "One",
    "Non-compete duration in years": "1",
    "Non-compete duration in words": "One",
    "Non-compete radius in miles": "25",
    "Non-compete states": "North Carolina",
    "Employee non-solicit duration in years": "1",
    "Employee non-solicit duration in words": "One",
    "Owner signatory name": "Confirmed Owner Signatory",
    "Owner signatory title or capacity": "Authorized Owner Representative",
    "Contractor signatory name": "Confirmed Contractor Signatory",
    "Contractor signatory title or capacity": "Independent Contractor",
};

export async function completeVisibleIndependentContractorIntake(page: Page): Promise<void> {
    await page.getByLabel("Forum state").fill("North Carolina");
    await page.getByLabel("Forum county").fill("Guilford County");
    await page.getByLabel("Relationship characterization").selectOption("independent-contractor");
    await page.getByLabel("Any minor party", { exact: true }).selectOption("no");
    await page.getByLabel("Compensation structure").selectOption("fixed-fee");
    await page.getByLabel("Execution-date treatment").selectOption("signature-blanks");
    for (const [label, value] of Object.entries(fieldValues)) {
        const field = page.getByLabel(label, { exact: true });
        if (await field.count()) await field.fill(value);
    }
}

export async function confirmAllRequiredReviewItems(page: Page): Promise<void> {
    const titles = ["Parties", "Signatories and capacities", "Scope of services", "Owner business description", "Compensation structure", "Effective date", "Execution-date treatment", "Covenant duration and territory", "Stable party addresses", "Owner address", "Contractor address", "Compensation and scope concern", "Covenant outlier concern"];
    for (const title of titles) {
        const article = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
        if (await article.count()) {
            const button = article.getByRole("button", { name: /Confirm/ });
            if (await button.count()) await button.click();
        }
    }
}

// Version history
// 20260715235500.0 - Added an explicit, visible, provenance-confirmed intake helper with no demo fallback prose.
// 20260715235500.1 - Matched the select's punctuation-free accessible name exactly.
// 20260715235500.2 - Added v1.1 titles, execution treatment, and explicit per-item review confirmation.
// 20260715235500.3 - Scoped review-card selection to each exact heading so explanatory prose cannot create ambiguous matches.
// 20260715235500.4 - Selected the explicit two-blank signature-date treatment for generic acceptance fixtures with no canonical execution date.
