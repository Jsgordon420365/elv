// ver 20260714144000.3

import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import PizZip from "pizzip";

const outputDirectory = path.resolve(process.cwd(), "../demo-output");
const firstDocxPath = path.join(outputDirectory, "accepted-generation-1.docx");
const secondDocxPath = path.join(outputDirectory, "accepted-generation-2-regenerated.docx");
const incidentPath = path.join(outputDirectory, "accepted-incident-record.json");
const exportPath = path.join(outputDirectory, "accepted-portable-export.zip");

function documentXml(bytes: Uint8Array): string {
    const xml = new PizZip(bytes).file("word/document.xml")?.asText();
    expect(xml, "word/document.xml must exist").toBeTruthy();
    return xml as string;
}

test("all twelve working-proof acceptance steps pass", async ({ page }) => {
    const stateChangingRequests: string[] = [];
    page.on("request", (request) => {
        if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) stateChangingRequests.push(`${request.method()} ${request.url()}`);
    });

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Create or unlock your local vault" })).toBeVisible();
    await page.getByRole("button", { name: "Unlock local vault" }).click();
    await expect(page.getByRole("heading", { name: "Independent Contractor working proof" })).toBeVisible();

    await Promise.all([
        page.waitForURL("**/vault"),
        page.getByRole("link", { name: "Open vault" }).click(),
    ]);
    await expect(page.getByText("Demo mode: all of your information is stored and encrypted-at-rest in this browser only (IndexedDB + WebCrypto). Nothing you type is transmitted to any server.")).toBeVisible();

    await page.getByLabel("Party kind").selectOption("business");
    await page.getByLabel("Legal name").fill("Acme Widgets LLC");
    await page.getByLabel("Address line 1").fill("123 Widget Way");
    await page.getByLabel("Address line 2").fill("Greensboro, NC 27401");
    await page.getByRole("button", { name: "Save encrypted party" }).click();
    await expect(page.getByText(/Acme Widgets LLC and its reusable facts were encrypted/)).toBeVisible();

    await page.getByLabel("Party kind").selectOption("person");
    await page.getByLabel("Legal name").fill("Jane Q. Contractor");
    await page.getByLabel("Address line 1").fill("456 Contractor Court");
    await page.getByLabel("Address line 2").fill("High Point, NC 27260");
    await page.getByRole("button", { name: "Save encrypted party" }).click();
    await expect(page.getByText(/Jane Q. Contractor and its reusable facts were encrypted/)).toBeVisible();

    await page.getByLabel("Company").selectOption({ label: "Acme Widgets LLC" });
    await page.getByLabel("Contractor", { exact: true }).selectOption({ label: "Jane Q. Contractor" });
    await page.getByRole("button", { name: "Relate parties" }).click();
    await expect(page.getByText("Company-contractor relationship saved locally.")).toBeVisible();
    const ownerFactRow = page.getByRole("row").filter({ hasText: "owner_name" });
    await expect(page.getByLabel("Fact owner_name")).toHaveValue("Acme Widgets LLC");
    await expect(ownerFactRow).toContainText("user-entered");
    await expect(ownerFactRow).toContainText("Independent Contractor intake");

    await page.getByRole("link", { name: "Independent Contractor" }).click();
    await expect(page.getByText("LegalFlowNC Demonstration Publisher")).toBeVisible();
    await expect(page.getByText("Good standing confirmed")).toBeVisible();
    await expect(page.getByText("North Carolina, USA")).toBeVisible();
    await expect(page.getByText("1.0-recovered-20251231")).toBeVisible();
    await expect(page.getByText("maintained-demo")).toBeVisible();
    await expect(page.getByText("Acme Widgets LLC")).toBeVisible();
    await expect(page.getByText(/user-entered · confirmed/).first()).toBeVisible();

    await page.getByLabel("Forum state").fill("California");
    await expect(page.getByRole("heading", { name: "Generation blocked by active scope conditions" })).toBeVisible();
    await expect(page.getByText(/This is outside what this workflow was designed to cover. Consider consulting a licensed attorney./).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Generate maintained DOCX" })).toBeDisabled();

    await page.getByLabel("Forum state").fill("North Carolina");
    await page.getByLabel("Forum county").fill("Guilford County");
    await expect(page.getByRole("heading", { name: "Generation blocked by active scope conditions" })).toHaveCount(0);
    await expect(page.getByText("Resolved scope events retained in matter history")).toBeVisible();
    await page.getByRole("button", { name: "Fill remaining demo values" }).click();
    await expect(page.getByText("Ready to generate a maintained demo output")).toBeVisible();

    const firstDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Generate maintained DOCX" }).click();
    const firstDownload = await firstDownloadPromise;
    await firstDownload.saveAs(firstDocxPath);
    await page.waitForURL(/\/confirmation\//);
    await expect(page.getByRole("heading", { name: "Maintained demo document generated" })).toBeVisible();
    await expect(page.getByText("Resolved warnings retained")).toBeVisible();
    await expect(page.getByText("Both parties sign and date the agreement.")).toBeVisible();

    const firstXml = documentXml(new Uint8Array(await readFile(firstDocxPath)));
    expect(firstXml).not.toMatch(/\{\{[^{}]+\}\}/);
    expect(firstXml).toContain("Acme Widgets LLC");
    expect(firstXml).toContain("Jane Q. Contractor");
    expect(firstXml).toContain("Guilford County, North Carolina");

    await page.getByRole("link", { name: "Vault" }).click();
    const addressFact = page.getByLabel("Fact owner_add1");
    await addressFact.fill("999 Updated Avenue");
    await addressFact.press("Tab");
    await expect(addressFact).toHaveValue("999 Updated Avenue");
    await page.getByRole("link", { name: "Assurance" }).first().click();
    const regenerateDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Regenerate with current vault facts" }).click();
    const regenerateDownload = await regenerateDownloadPromise;
    await regenerateDownload.saveAs(secondDocxPath);
    await page.waitForURL(/\/confirmation\//);
    const secondXml = documentXml(new Uint8Array(await readFile(secondDocxPath)));
    expect(secondXml).toContain("999 Updated Avenue");
    expect(secondXml).not.toMatch(/\{\{[^{}]+\}\}/);

    await page.getByRole("link", { name: /This document failed/ }).click();
    await expect(page.getByText(/DEMONSTRATION POLICY — the following support/)).toBeVisible();
    await page.getByLabel("What happened").fill("The recipient rejected the agreement during onboarding.");
    await page.getByLabel("Who rejected or challenged it").fill("Recipient onboarding team");
    await page.getByLabel("Date of failure").fill("2026-07-14");
    await page.getByLabel("Evidence references").fill("Email dated 2026-07-14\nOnboarding ticket ELV-42");
    await page.getByRole("button", { name: "Save encrypted incident" }).click();
    await expect(page.getByRole("heading", { name: "Incident record saved" })).toBeVisible();
    await expect(page.getByText(/First response owner:/)).toBeVisible();
    const incidentDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download incident record" }).click();
    const incidentDownload = await incidentDownloadPromise;
    await incidentDownload.saveAs(incidentPath);

    await page.getByRole("link", { name: "Vault" }).click();
    await expect(page.getByText(/Clicking Export is your explicit authorization/)).toBeVisible();
    const exportDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export customer ZIP" }).click();
    const exportDownload = await exportDownloadPromise;
    await exportDownload.saveAs(exportPath);
    await expect(page.getByText(/Portable customer archive created/)).toBeVisible();

    await page.screenshot({ path: path.join(outputDirectory, "acceptance-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(outputDirectory, "acceptance-mobile.png"), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const incidentJson = JSON.parse(await readFile(incidentPath, "utf8")) as Record<string, unknown>;
    expect(incidentJson.whatHappened).toBe("The recipient rejected the agreement during onboarding.");
    expect(incidentJson.outputSha256).toBeTruthy();
    expect(incidentJson.remedyPolicy).toContain("no commercial or legal remedy has been approved or is promised");

    const exportZip = new PizZip(new Uint8Array(await readFile(exportPath)));
    for (const required of ["vault-export.json", "latest-generated-document.docx", "latest-assurance-record.json", "incidents.json", "README.txt"]) {
        expect(exportZip.file(required), `${required} must exist`).toBeTruthy();
    }
    const exportedDocx = exportZip.file("latest-generated-document.docx")?.asUint8Array();
    expect(exportedDocx).toBeTruthy();
    const exportedXml = documentXml(exportedDocx as Uint8Array);
    expect(exportedXml).toContain("999 Updated Avenue");
    expect(exportedXml).not.toMatch(/\{\{[^{}]+\}\}/);
    const latestAssurance = JSON.parse(exportZip.file("latest-assurance-record.json")?.asText() ?? "{}") as Record<string, unknown>;
    expect(latestAssurance.approvalRepresentation).toBe("demo-approved");
    const incidents = JSON.parse(exportZip.file("incidents.json")?.asText() ?? "[]") as Array<Record<string, unknown>>;
    expect(incidents[0]?.whatHappened).toBe("The recipient rejected the agreement during onboarding.");
    expect(stateChangingRequests).toEqual([]);
});

// Version history
// 20260714144000.0 - Added full browser acceptance, downloads, DOCX/ZIP inspection, responsive screenshot, and no-transmission assertion.
// 20260714144000.1 - Waited on the explicit Open vault navigation target for cold development-route compilation.
// 20260714144000.2 - Disambiguated the contractor relationship select from fact and edit labels.
// 20260714144000.3 - Asserted the reusable fact's form value through its accessible input instead of row text content.
