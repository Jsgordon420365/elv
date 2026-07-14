# ELV / LegalFlowNC Working Proof Demo

## Start

Repository: `C:\Users\jsgor\Projects-Arc\elv`

Command Prompt launcher: `START_DEMO.cmd`

PowerShell launcher: `.\RUN_DEMO.ps1`

Local URL: `http://localhost:3000`

The launcher checks for Node.js, installs dependencies only when `webapp\node_modules` is absent, sets `NEXT_PUBLIC_DEMO_MODE=1`, opens the URL, and keeps the Next.js development server attached to the launcher window.

## Acceptance click path

Open the local URL and unlock the prefilled local demo vault. Open Vault. Add business `Acme Widgets LLC` with two address lines. Add person `Jane Q. Contractor` with two address lines. Relate Acme to Jane as `company-contractor`. Confirm each reusable fact row shows value, source, last-confirmed time, and its Independent Contractor intake role.

Open Independent Contractor. Confirm provider, good-standing badge, jurisdiction, form/intake versions, scope, and maintenance status are registry-backed. Confirm the six party/address fields appear as vault-prefilled values with provenance and are not asked again. Enter `California` in Forum state and confirm generation is blocked with the attorney-escalation warning. Change Forum state to `North Carolina`, set Forum county to `Guilford County`, and confirm the active block clears while the prior event remains under resolved scope events. Select Fill remaining demo values and generate.

On confirmation, confirm the DOCX download, assurance record, `word/document.xml` SHA-256, resolved warning, and completion checklist. Return to Vault, edit Acme's `owner_add1` reusable fact, open the latest assurance, and select Regenerate with current vault facts. Confirm a new DOCX and assurance record are created without re-answering the intake.

Select the document-failure recourse action. Complete all required fields, save the encrypted incident, confirm the first-response owner and demonstration remedy banner, and download the incident JSON. Return to Vault and select Export customer ZIP after reading the plaintext packaging warning.

## Browser-only boundary

Demo mode: all of your information is stored and encrypted-at-rest in this browser only (IndexedDB + WebCrypto). Nothing you type is transmitted to any server.

## Stable review artifacts

Verified generated documents and the portable export are written to `C:\Users\jsgor\Projects-Arc\elv\demo-output` during final acceptance. The running process ID and final artifact names are appended after launch.

## Current acceptance runtime

The full functional browser path passed at `http://localhost:3001` in installed Chrome because an unrelated Remotion Studio process already owns the required port 3000. The restarted, healthy ELV Next.js listener is Node PID `37400`, address `::`, port `3001`, and returned HTTP 200 after final build. Server output is retained in `demo-output\server.stdout.log` and `demo-output\server.stderr.log`.

The exact `http://localhost:3000` launcher acceptance remains blocked by unrelated Node PID `59884`, whose HTTP response identifies itself as `Remotion Studio` and project `XylephoneVideo`. The launchers now check this non-destructively and stop with an exact error instead of opening the unrelated application or silently changing ELV's port. No unrelated process was terminated.

Final stable artifacts:

`demo-output\accepted-generation-1.docx`

`demo-output\accepted-generation-2-regenerated.docx`

`demo-output\accepted-incident-record.json`

`demo-output\accepted-portable-export.zip`

`demo-output\acceptance-desktop.png`

`demo-output\acceptance-mobile.png`
