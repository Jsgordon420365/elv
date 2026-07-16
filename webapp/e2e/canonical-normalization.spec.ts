// ver 20260715112000.7

import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import PizZip from "pizzip";
import { completeVisibleIndependentContractorIntake, confirmAllRequiredReviewItems } from "./intake-helpers";

const outputDirectory = path.resolve(process.cwd(), "../demo-output");
const outputPath = path.join(outputDirectory, "canonical-normalization-acceptance.docx");

test("canonical vault data projects into the unchanged Independent Contractor template", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Unlock local vault" }).click();
    await page.getByRole("link", { name: "Open vault" }).click();

    await page.getByLabel("Full legal name").fill("Dr. Joffry Alistair Von Thurstenburg III, Esq.");
    await page.getByLabel("Honorific prefix").fill("Dr.");
    await page.getByLabel("Given name").fill("Joffry");
    await page.getByLabel("Middle name or initial").fill("Alistair");
    await page.getByLabel("Family name").fill("Von Thurstenburg");
    await page.getByLabel("Generational suffix").fill("III");
    await page.getByLabel("Professional designation").fill("Esq.");
    await page.getByLabel("Address line 1").fill("2915 Starmount Farms Dr.");
    await expect(page.getByLabel("Address line 2")).not.toHaveAttribute("required", "");
    await expect(page.getByLabel("Address line 2")).toHaveValue("");
    await page.getByLabel("City", { exact: true }).fill("Greensboro");
    await page.getByLabel("State or province").fill("NC");
    await page.getByLabel("Postal code").fill("27408");
    await page.getByRole("button", { name: "Save canonical encrypted party" }).click();
    await expect(page.getByText(/NC was normalized to North Carolina/)).toBeVisible();
    await expect(page.getByText("Dr. Joffry Alistair Von Thurstenburg III, Esq.", { exact: true }).first()).toBeVisible();

    await page.getByLabel("Party kind").selectOption("business");
    await page.getByLabel("Business legal name").fill("Jeff Gordon Company");
    await page.getByLabel("Trade name or DBA").fill("Moon Possum Legal Logistics");
    await page.getByLabel("Address line 1").fill("2915 Starmount Farms Dr.");
    await page.getByLabel("City", { exact: true }).fill("Greensboro");
    await page.getByLabel("State or province").fill("NC");
    await page.getByLabel("Postal code").fill("27408");
    await page.getByRole("button", { name: "Save canonical encrypted party" }).click();
    await expect(page.getByText("Jeff Gordon Company", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("DBA: Moon Possum Legal Logistics")).toBeVisible();
    await expect(page.getByText(/Greensboro, North Carolina 27408/).first()).toBeVisible();

    await page.getByLabel("Company", { exact: true }).selectOption({ label: "Jeff Gordon Company" });
    await page.getByLabel("Contractor", { exact: true }).selectOption({ label: "Dr. Joffry Alistair Von Thurstenburg III, Esq." });
    await page.getByRole("button", { name: "Relate parties" }).click();

    await page.getByLabel("Signing for party").selectOption({ label: "Jeff Gordon Company" });
    await page.getByLabel("Signatory person").selectOption({ label: "Dr. Joffry Alistair Von Thurstenburg III, Esq." });
    await page.getByLabel("Authority confirmed").check();
    await page.getByLabel("Signature date").fill("2026-07-15");
    await page.getByRole("button", { name: "Save encrypted signatory" }).click();
    await expect(page.getByText("TITLE REQUIRED")).toBeVisible();

    await page.getByRole("link", { name: "Independent Contractor" }).click();
    await expect(page.getByText("BUSINESS_SIGNATORY_TITLE_REQUIRED")).toHaveCount(0);
    await expect(page.getByText("A person signing for a business must have a title or capacity.")).toBeVisible();
    await expect(page.getByText("BLOCKING", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Generate maintained DOCX" })).toBeDisabled();
    await expect(page.getByText("Jeff Gordon Company", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Dr. Joffry Alistair Von Thurstenburg III, Esq.", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Moon Possum Legal Logistics remains a trade name and was not substituted for the legal entity name/)).toBeVisible();

    await page.getByRole("link", { name: "Vault" }).click();
    await page.getByRole("button", { name: "Edit signatory for Jeff Gordon Company" }).click();
    await page.getByLabel("Title or capacity").fill("Authorized Representative");
    await page.getByRole("button", { name: "Save encrypted signatory" }).click();
    await expect(page.getByText(/as Authorized Representative/)).toBeVisible();

    await page.getByRole("link", { name: "Independent Contractor" }).click();
    await expect(page.getByText("A person signing for a business must have a title or capacity.")).toHaveCount(0);
    await completeVisibleIndependentContractorIntake(page);
    await confirmAllRequiredReviewItems(page);
    await expect(page.getByText("Ready to generate with complete approved provenance and review")).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Generate maintained DOCX" }).click();
    const download = await downloadPromise;
    await download.saveAs(outputPath);
    await page.waitForURL(/\/confirmation\//);
    await page.screenshot({ path: path.join(outputDirectory, "canonical-normalization-confirmation.png"), fullPage: true });

    const bytes = new Uint8Array(await readFile(outputPath));
    const xml = new PizZip(bytes).file("word/document.xml")?.asText();
    expect(xml).toBeTruthy();
    expect(xml).not.toMatch(/\{\{[^{}]+\}\}/);
    expect(xml).toContain("Jeff Gordon Company");
    expect(xml).toContain("Dr. Joffry Alistair Von Thurstenburg III, Esq.");
    expect(xml).toContain("2915 Starmount Farms Dr.");
    expect(xml).toContain("Greensboro, North Carolina 27408");
    expect(xml).not.toContain("Moon Possum Legal Logistics");
});

// Version history
// 20260715112000.0 - Added browser acceptance for canonical names, optional address line 2, NC normalization, DBA separation, business-signatory blocking, and unchanged DOCX tags.
// 20260715112000.1 - Made the City locator exact so it cannot collide with the title-or-capacity control.
// 20260715112000.2 - Scoped repeated party-name assertions to the first exact visible text match.
// 20260715112000.3 - Made the Company relationship locator exact so it cannot match the party edit button.
// 20260715112000.4 - Asserted the visible DBA-separation notice instead of requiring the trade name to be absent from consistency guidance.
// 20260715112000.5 - Exercised explicit signatory editing when correcting the missing business-signatory title.
// 20260715112000.6 - Replaced removed demo defaults with explicit visible, provenance-confirmed intake values.
// 20260715112000.7 - Confirmed v1.1 execution treatment and each required provenance-ledger review item.
