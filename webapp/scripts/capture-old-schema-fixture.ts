// ver 20260716034000.0

import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import PizZip from "pizzip";

const oldUrl = process.env.ELV_OLD_SCHEMA_URL ?? "http://localhost:3005";
const outputPath = path.resolve(process.cwd(), "../proof-p0/old-schema-moonshot-picklesworth-v3.zip");

function log_message(message: string): void {
    console.log(`${new Date().toISOString()} ${message}`);
}

async function main(): Promise<void> {
    const browser = await chromium.launch({ channel: "chrome", headless: true });
    try {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: false });
        const page = await context.newPage();
        await page.goto(`${oldUrl}/vault`);
        await page.getByRole("button", { name: "Unlock local vault" }).click();

        await page.getByLabel("Party kind").selectOption("business");
        await page.getByLabel("Legal name").fill("Moonshot Marmalade Industries, LLC");
        await page.getByLabel("Address line 1").fill("2915 Starmount Farms Dr.");
        await page.getByLabel("Address line 2").fill("Greensboro, NC 27408");
        await page.getByRole("button", { name: "Save encrypted party" }).click();
        await page.getByText(/Moonshot Marmalade Industries, LLC and its reusable facts were encrypted/).waitFor();

        await page.getByLabel("Party kind").selectOption("person");
        await page.getByLabel("Legal name").fill("Peregrine Picklesworth");
        await page.getByLabel("Address line 1").fill("7 Preserves Place");
        await page.getByLabel("Address line 2").fill("High Point, NC 27260");
        await page.getByRole("button", { name: "Save encrypted party" }).click();
        await page.getByText(/Peregrine Picklesworth and its reusable facts were encrypted/).waitFor();

        await page.getByLabel("Company", { exact: true }).selectOption({ label: "Moonshot Marmalade Industries, LLC" });
        await page.getByLabel("Contractor", { exact: true }).selectOption({ label: "Peregrine Picklesworth" });
        await page.getByRole("button", { name: "Relate parties" }).click();
        await page.getByText("Company-contractor relationship saved locally.").waitFor();

        await page.getByRole("link", { name: "Independent Contractor" }).click();
        const values: Record<string, string> = {
            "Owner business description": "Moonshot Marmalade Industries makes and distributes fictional marmalade",
            "Scope of services": "Peregrine Picklesworth will prepare a fictional wholesale distribution plan for Moonshot Marmalade",
            "Agreement start date": "2026-07-16",
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
            "Owner signatory name": "Petunia Picklesworth",
            "Owner signature date": "2026-07-16",
            "Contractor signatory name": "Peregrine Picklesworth",
            "Contractor signature date": "2026-07-16"
        };
        for (const [label, value] of Object.entries(values)) {
            const control = page.getByLabel(label, { exact: true });
            if (await control.count()) await control.fill(value);
        }
        await page.getByLabel("Relationship characterization").selectOption("independent-contractor");
        await page.getByLabel("Any minor party", { exact: true }).selectOption("no");
        await page.getByLabel("Forum state").fill("North Carolina");
        await page.getByLabel("Forum county").fill("Guilford County");

        const fixture = await page.evaluate(async () => {
            const database = await new Promise<IDBDatabase>((resolve, reject) => {
                const request = indexedDB.open("ELV_VAULT");
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            const stores: Record<string, { keys: IDBValidKey[]; records: unknown[] }> = {};
            for (const storeName of Array.from(database.objectStoreNames)) {
                const transaction = database.transaction(storeName, "readonly");
                const store = transaction.objectStore(storeName);
                const keys = await new Promise<IDBValidKey[]>((resolve, reject) => { const request = store.getAllKeys(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
                const records = await new Promise<unknown[]>((resolve, reject) => { const request = store.getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
                stores[storeName] = { keys, records };
            }
            const version = database.version;
            database.close();
            return { dbName: "ELV_VAULT", dbVersion: version, sourceCommit: "1acfa72", capturedAt: new Date().toISOString(), stores };
        });
        assert.equal(fixture.dbVersion, 3);
        assert.equal(fixture.stores.parties.records.length, 2);
        assert.equal(fixture.stores.relationships.records.length, 1);
        assert.equal(fixture.stores.facts.records.length, 6);
        assert.equal(fixture.stores.matters.records.length, 1);
        const serialized = JSON.stringify(fixture, null, 2);
        for (const forbidden of ["Basil Quince", "Penelope Fizzlebottom", "Jane Q. Contractor", "Jeff Gordon Company", "Joffry", "Von Thurstenburg"]) assert.equal(serialized.includes(forbidden), false);
        const archive = new PizZip();
        archive.file("fixture.json", `${serialized}\n`);
        archive.file("README.txt", "Fictional encrypted ELV schema-v3 fixture created by running commit 1acfa72 at a separate localhost origin. Contains only Moonshot Marmalade / Picklesworth test identities.\n");
        await mkdir(path.dirname(outputPath), { recursive: true });
        await writeFile(outputPath, archive.generate({ type: "uint8array", compression: "DEFLATE" }));
        log_message(`Captured fictional schema-v3 fixture at ${outputPath}.`);
        await context.close();
    } finally {
        await browser.close();
    }
}

void main().catch((error: unknown) => {
    log_message(`Old-schema fixture capture failed: ${error instanceof Error ? error.message : "Unknown error."}`);
    process.exitCode = 1;
});

// Version history
// 20260716034000.0 - Added prior-version UI fixture capture for fictional Moonshot Marmalade and Picklesworth encrypted schema-v3 records.
