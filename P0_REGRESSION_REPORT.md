<!-- ver 20260716002000.2 -->
# ELV P0 Trust-Closure Regression Report

## Result

PASS. A fictional schema-v3 Moonshot Marmalade / Picklesworth vault survived additive upgrade to schema 5, two reload-unlock cycles, generation, and export. All 32 v1.1 template tags have approved transaction-bound provenance and the generated DOCX has zero unresolved tags.

## Data continuity and recovery

The human-observed empty vault had two concrete causes. IndexedDB is origin-scoped, so changing the localhost port exposed a different database while the original remained at its original origin. The earlier canonical migration also wrote new records incrementally without an encrypted recovery snapshot or one atomic commit boundary.

Schema 5 now preserves legacy stores, the non-extractable WebCrypto key, encrypted payloads, IDs, timestamps, facts, matters, and relationships. Before canonical writes, it verifies decryptability and creates an encrypted snapshot. Canonical writes and migration metadata commit in one IndexedDB transaction. A simulated mid-migration failure aborts safely; the encrypted snapshot restores the old stores; retry succeeds; two further migration checks are idempotent. Ambiguous names remain opaque authoritative strings, and ambiguous combined addresses remain unchanged and marked for confirmation.

## Generation provenance

The unrequested scope and business-description sentences came from `demoDefaults` in the prior workflow page at commit `c35dcbf` and the former “Fill remaining demo values” path. Those defaults are removed. Scope and business description are now visible, individually confirmed inputs. The Moonshot proof records both as `CURRENT_INTAKE_CONFIRMED` from their respective `matter-answer` records.

The v1.1 ledger covers 32 tags and records rendered value, source record, classification, last-confirmed timestamp, transformation, transaction, template, intake, generation, and timestamp identity. Accepted classifications are `CURRENT_INTAKE_CONFIRMED`, `CANONICAL_VAULT_CONFIRMED`, `DETERMINISTIC_DERIVATION`, and `APPROVED_FIXED_TEMPLATE_TEXT`. Missing or stale provenance blocks generation. Review confirmations are granular and fingerprint-bound; the browser proof shows individual, grouped-address, stated-concern, and informational categories.

## Rendering corrections

The owner signature block separates Moonshot Marmalade Industries, LLC from human signatory Petunia Picklesworth and the confirmed title Chief Marmalade Officer. The contractor block separately renders Peregrine Picklesworth and capacity. The selected execution-date treatment supplies exactly two populated date lines or two blank date lines; mixed treatment blocks generation. Compensation comes only from the visible selected structure. The v1.1 template contains none of the listed pluralization, punctuation, assignment-grammar, forum-placeholder, duplicate-date, or unconditional-commission artifacts.

## Verification

`npm test`: 22 passed. `npm run lint`: passed. `npm run test:e2e`: 3 passed, including the schema-v3 browser migration and generation. `npm run build`: passed with 14 routes. The only build warning is the pre-existing multiple-lockfile workspace-root warning.

Logical `word/document.xml` SHA-256: `0e725091060fdf4ae0dd60fccdf6169eba592284058d114b9e36477bc6ff25ce`.

Downloaded DOCX package SHA-256: `d3a141fe11888782bf6508993b4d983e0a823365f5bfbdefa72ba56f89b4a5ac`.

Stable evidence is in `proof-p0`, including the fictional historical fixture, migration inventory, failure/recovery unit transcript, browser transcript, generated DOCX, 32-tag provenance JSON, and review screenshots. No actual user vault or export was copied into the repository or reports.

## Runtime identity

Verified ELV: `http://localhost:3004`, PID 16060, exact project `C:\Users\jsgor\Projects-Arc\elv\webapp`, HTTP 200, title `ELV | Encrypted Legal Vault`, started `2026-07-16T03:57:45.4607153-04:00`.

Verified Remotion listeners were not stopped or restarted: PID 3388 on port 3000 from `C:\Users\jsgor\Projects\XylephoneVideo`, and PID 62240 on port 3001 from `C:\Projects\XylephoneVideo`; both returned HTTP 200 with title `Remotion Studio`.

## Remaining ambiguity

Policy only: the demonstration publisher, approval, and remedy labels remain demonstration policy and promise no commercial or legal benefit. Technical ambiguity intentionally retained: personal-name components and nonconforming legacy combined addresses are not guessed and require human confirmation.

<!-- Version history
20260716002000.0 - Recorded the bounded P0 root causes, migration behavior, generation provenance, template corrections, and verified evidence.
20260716002000.1 - Added intake sequencing evidence and refreshed final test timing and artifact hashes.
20260716002000.2 - Updated the report for v1.1, 32-tag provenance, fictional fixture privacy, recovery evidence, dual hashes, and verified runtime coexistence.
-->
