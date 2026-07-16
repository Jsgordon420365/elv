<!-- ver 20260716002000.1 -->
# ELV P0 Regression Report

## Result

PASS. The version-3 encrypted browser vault fixture survives reopen and the additive version-5 upgrade with party, fact, matter, relationship, record ID, timestamp, and provenance continuity. The preserved records generate the Moonshot Marmalade DOCX with 29 documented tag sources and zero unresolved tags.

## Data-loss cause and correction

The observed empty vault was caused first by changing the localhost port: IndexedDB is scoped to the exact origin, so an ELV session moved from one port to another opens a different database while the older database remains at its original origin. The launchers are now fixed to `http://localhost:3004` and refuse silent port fallback.

The prior canonical migration also lacked a recoverable snapshot and atomic canonical write boundary. Schema version 5 adds encrypted `migration_snapshots` and `migration_meta` stores. Migration verifies the existing non-extractable key, decryptability, and raw legacy data before mutation; encrypts a full pre-migration snapshot; prepares canonical records without changing legacy stores; and commits canonical people, businesses, addresses, parties, and migration metadata in one IndexedDB transaction. Failure aborts that transaction and leaves the original stores plus encrypted snapshot intact. Unlock with a wrong identity or passphrase stops instead of creating an empty vault. The workflow now waits for saved-matter decryption before exposing intake controls and serializes rapid edits, preventing late loads or overlapping writes from dropping confirmed provenance.

Legacy names remain authoritative opaque strings and are marked for confirmation. Combined legacy address line 2 is retained verbatim; it is split only for the exact recognized `city, state postal-code` pattern. IDs, relationships, facts, matters, timestamps, and encrypted payloads are preserved unchanged.

## Hidden generation values and provenance

Both unrequested sentences came from `demoDefaults` in the prior Independent Contractor page and were injected by the removed “Fill remaining demo values” action. That fallback and its prose are gone. Scope, business description, compensation, and all other variable inputs now require visible entry or confirmation.

Generation blocks unless every one of the 29 tags has a rendered value where required and one approved classification: `CURRENT_INTAKE_CONFIRMED`, `CANONICAL_VAULT_CONFIRMED`, `DETERMINISTIC_DERIVATION`, or `APPROVED_FIXED_TEMPLATE_TEXT`. The assurance record retains rendered value, source record, classification, confirmation timestamp, and transformation for every tag. Moonshot scope is a documented deterministic derivation from the confirmed scope plus selected fixed-fee compensation; business description is current-intake confirmed.

## Signature and template corrections

The owner signature block renders `Moonshot Marmalade Industries, LLC`, one `By:` line, `Penelope Fizzlebottom`, `Chief Marmalade Officer`, and one owner date treatment. The contractor block has its own single date treatment. A business signatory without a confirmed title or capacity blocks generation.

The bounded template repair removes the listed pluralization artifacts, stray North Carolina underscores/commas, double terminal punctuation introduced by merged values, reversed assignment grammar, duplicate execution dates, and unconditional commission compensation. Compensation is rendered only from the visible selected structure. No unrelated substantive legal-language rewrite was made.

## Evidence

`npm run lint` passed. `npm test` passed 16 of 16. `npm run build` passed with 14 routes; the existing multiple-lockfile workspace-root warning remains informational. `npm run test:e2e` passed all 3 browser cases in 33.9 seconds. The timing-sensitive canonical browser case also passed three consecutive isolated repetitions after the load/persistence sequencing correction.

Stable artifacts are `demo-output/moonshot-marmalade-p0.docx`, `demo-output/moonshot-marmalade-p0-provenance.json`, and `demo-output/moonshot-marmalade-p0-migration-evidence.json`.

DOCX SHA-256: `F99AFF41820ADBF24B918400EDFDD38809405034427707E046843646D24F6377`.

Provenance JSON SHA-256: `101E79927006188EE4B9043D6C3999626257A27463053E43B6066723434F23D1`.

Migration evidence SHA-256: `E8F1BE561B53926B9C1F2D56A5F44874AAF8FF89AD33F1E468A1C4D5C64CB698`.

## Remaining ambiguity

The migration intentionally does not guess personal-name components or split nonconforming legacy address text. Those values remain preserved and flagged for confirmation. IndexedDB cannot be read across localhost ports by web application code; the fixed launcher origin prevents recurrence, but an older vault must be opened at its original exact origin for browser-authorized export or migration.

<!-- Version history
20260716002000.0 - Recorded the bounded P0 root causes, migration behavior, generation provenance, template corrections, and verified evidence.
20260716002000.1 - Added intake sequencing evidence and refreshed final test timing and artifact hashes.
-->
