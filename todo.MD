# ELV Project Roadmap

This document outlines the phased development of the **Encrypted Legal Vault (ELV)**.

## Phase 1: Foundation (MVP)

*Goal: Prove core loop of payment, encryption, and document generation.*

- [ ] **Core Authentication**
  - [ ] Implement passphrase-based key derivation (PBKDF2/Argon2).
  - [ ] Device registration and local token management.
- [ ] **Vault Engine**
  - [ ] Secure storage implementation (IndexedDB).
  - [ ] Client-side encryption/decryption utilities (WebCrypto).
  - [ ] Field-level sensitivity tagging.
- [ ] **Template & Marketplace Foundation**
  - [/] Initial template catalog (Independent Contractor refined).
  - [ ] Stripe Checkout integration.
  - [ ] Entitlement state machine (Active/Pending/Revoked).
- [ ] **Backend (FastAPI)**
  - [ ] API for catalog, entitlements, and encrypted blob storage.
  - [ ] Secure S3 sync for encrypted vault backups.

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
