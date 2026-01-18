# ELV Project Roadmap

This document outlines the phased development of the **Encrypted Legal Vault (ELV)**.

## Phase 1: Foundation (MVP)

*Goal: Prove core loop of payment, encryption, and document generation.*

- [x] **Core Authentication**
  - [x] Implement passphrase-based key derivation (PBKDF2/Argon2).
  - [x] Device registration and local token management.
- [x] **Vault Engine**
  - [x] Secure storage implementation (IndexedDB).
  - [x] Client-side encryption/decryption utilities (WebCrypto).
  - [x] Field-level sensitivity tagging.
- [x] **Template & Marketplace Foundation**
  - [x] Initial template catalog (Independent Contractor refined).
  - [x] Stripe Checkout integration.
  - [x] Entitlement state machine (Active/Pending/Revoked).
- [x] **Document Merge logic**
  - [x] Integrate `docxtemplater` for in-memory merging.
  - [x] Implement browser-side generation and download (`file-saver`).
  - [x] Host base templates in public directory.
- [x] **Backend (FastAPI)**
  - [x] API for catalog, entitlements, and encrypted blob storage.
  - [x] Secure S3/R2 sync for encrypted vault backups.

## Phase 2: Growth & Retention

*Goal: Increase data gravity and provide user value through intelligence.*

- [ ] **Recommendation Engine (Privacy-Preserving)**
  - [ ] Metadata-only analysis of vault completeness.
  - [ ] "Structure-aware" upsells (e.g., "80% ready for Lease").
- [ ] **Vertical Bundles**
  - [ ] **Therapist Practice Kit**: 5-10 templates for clinicians.
  - [ ] **Startup Founder Kit**: Incorporation, bylaws, NDAs.
  - [ ] **Landlord Kit**: Leases, notices, checklists.
- [ ] **Multi-Device Sync**
  - [ ] Conflict resolution (Last-Write-Wins).
  - [ ] Device management dashboard.

## Phase 3: Scale & Utility

*Goal: Expand beyond ELV templates and address enterprise needs.*

- [ ] **"Trojan Horse" Mode**
  - [ ] Extension-based external form injection.
  - [ ] User-controlled mapping for government (IRS/Secretary of State) forms.
- [ ] **Premium Compliance Tiers**
  - [ ] B2B features: Audit logs, SSO, RBAC.
  - [ ] HIPAA/GDPR compliance certifications/BAAs.
- [ ] **White-Labeling**
  - [ ] Partner portal for professional associations.
  - [ ] Co-branded vault deployments.
