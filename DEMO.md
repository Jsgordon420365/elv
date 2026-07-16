<!-- ver 20260716001500.1 -->
# ELV / LegalFlowNC Working Proof Demo

## Start

Repository: `C:\Users\jsgor\Projects-Arc\elv`

Command Prompt launcher: `START_DEMO.cmd`

PowerShell launcher: `.\RUN_DEMO.ps1`

Local URL and fixed IndexedDB vault origin: `http://localhost:3004`

The launcher checks for Node.js, installs dependencies only when `webapp\node_modules` is absent, sets `NEXT_PUBLIC_DEMO_MODE=1`, opens the URL, and keeps the Next.js development server attached to the launcher window.

## Acceptance click path

Open the exact local URL and unlock the local demo vault. Open Vault. Add business `Acme Widgets LLC`, leaving address line 2 blank and entering city, state, and postal code separately. Add person `Jane Q. Contractor` the same way. Relate Acme to Jane as `company-contractor`, add a human signatory for Acme, and confirm the signatory's title or capacity. Confirm each compatibility projection shows value, source, last-confirmed time, and its Independent Contractor intake role.

Open Independent Contractor. Confirm provider, good-standing badge, jurisdiction, form/intake versions, scope, and maintenance status are registry-backed. Confirm the party/address fields appear as vault-prefilled values with provenance. Enter `California` in Forum state and confirm generation is blocked with the attorney-escalation warning. Change Forum state to `North Carolina`, set Forum county to `Guilford County`, and confirm the active block clears while the prior event remains under resolved scope events. Visibly enter or confirm scope of services, business description, compensation structure, and every remaining requested value. Confirm all 29 provenance rows have approved classifications, then generate.

On confirmation, confirm the DOCX download, assurance record, 29-tag provenance report, `word/document.xml` SHA-256, resolved warning, and completion checklist. Return to Vault, edit Acme's structured address, open the latest assurance, and select Regenerate with current confirmed records. Confirm a new DOCX and assurance record are created without re-answering the intake.

Select the document-failure recourse action. Complete all required fields, save the encrypted incident, confirm the first-response owner and demonstration remedy banner, and download the incident JSON. Return to Vault and select Export customer ZIP after reading the plaintext packaging warning.

## Browser-only boundary

Demo mode: all of your information is stored and encrypted-at-rest in this browser only (IndexedDB + WebCrypto). Nothing you type is transmitted to any server.

## Stable review artifacts

Verified generated documents and the portable export are written to `C:\Users\jsgor\Projects-Arc\elv\demo-output` during final acceptance. The running process ID and final artifact names are appended after launch.

## Current acceptance runtime

The P0 browser regression suite passed at the fixed origin `http://localhost:3004`. IndexedDB is origin-scoped, so changing a localhost port opens a different browser database even though the older encrypted records remain intact at their original origin. Both launchers now refuse to move silently and always target port 3004. After the final production build, the ELV-owned development server was restarted on the same origin. Node listener PID `2240` returns HTTP 200 with title `ELV | Encrypted Legal Vault`.

Final stable artifacts:

`demo-output\accepted-generation-1.docx`

`demo-output\accepted-generation-2-regenerated.docx`

`demo-output\accepted-incident-record.json`

`demo-output\accepted-portable-export.zip`

`demo-output\acceptance-desktop.png`

`demo-output\acceptance-mobile.png`

`demo-output\moonshot-marmalade-p0.docx`

`demo-output\moonshot-marmalade-p0-provenance.json`

`demo-output\moonshot-marmalade-p0-migration-evidence.json`

<!-- Version history
20260716001500.0 - Fixed the documented vault origin at port 3004 and replaced hidden demo-fill instructions with explicit provenance review.
20260716001500.1 - Recorded the final same-origin ELV listener PID and HTTP health receipt.
-->
