# 01_PRODUCT_OVERVIEW.md

## 1. Executive Summary

The **Encrypted Legal Vault (ELV)** is a privacy-first, zero-knowledge platform that functions as a specialized password manager for legal and regulatory data. It enables high-trust professionals (lawyers, clinicians, business operators, family offices) to:

- **Store** sensitive legal data (entity information, ownership structures, addresses, identities) in a client-side encrypted vault
- **Auto-populate** DOCX legal templates with stored data (merge happens client-side; server never sees plaintext)
- **Track progress** toward document readiness without exposing content (metadata-only analytics)
- **Receive privacy-preserving recommendations** ("You are 80% ready for a Commercial Lease"; "Commonly used with: NDA Template")
- **Sync encrypted backups** to cloud storage for multi-device access and disaster recovery

The platform rejects the "loss leader" model of incumbents (LegalZoom, Rocket Lawyer, ZenBusiness) in favor of **direct software monetization**: subscription vault access + marketplace template purchases + premium compliance tiers.

## Differentiators

1. **Zero-Knowledge Architecture** – Server never stores or observes plaintext field values; all encryption/decryption occurs on the client device.
2. **Data Gravity** – Retention engine based on utility, not fear or "negative option" billing; reuse of structured data increases stickiness.
3. **Privacy Premium** – Regulatory-compliant (transparent cancellation, no dark patterns); market-aligned with FTC enforcement against dark patterns.
4. **"Trojan Horse" Extension** – Vault data can be injected into *any* web form (government filings, bank applications), not just our templates.
5. **Structure-Aware Recommendations** – Recommendations based on metadata (e.g., "FieldID 402 is filled") without content analysis; avoids UPL risk.

## 2. What the ELV Is NOT

- **Not a legal service provider** – We do not provide legal advice, document review, or attorney consultation.
- **Not a document generator** – We do not generate content; we provide templates + auto-fill from user data.
- **Not a compliance service** – We do not monitor annual filings, tax deadlines, or compliance obligations (intentionally left to specialized services).
- **Not a fintech platform** – We do not offer banking, investment, or accounting services; we integrate with them via the extension.

## 3. Value Proposition by Persona

### High-Trust Professional (Primary Target)

**Problem:** Sensitive client data (medical records, legal documents, NDAs) is scattered across email, cloud drives, and Word documents. Using "free" platforms like LegalZoom means data is mined for marketing and sold to third parties.

**Solution:** ELV provides a secure, structured vault where data never leaves the user's device. New documents can be generated instantly using stored variables.

**Benefit:** Risk mitigation (no data breaches on our servers), efficiency (reuse across templates), compliance (audit-ready encryption).

### DIY Operator / Founder (Secondary Target)

**Problem:** Switching platforms for different documents (business formation, contracts, intellectual property) means re-entering data repeatedly. Most platforms require credit card for "free trials" that auto-renew.

**Solution:** Single vault holds all data; pay once for templates, never pay for the vault as a feature.

**Benefit:** Convenience, transparency, no surprise renewals.

## 4. Core Features – MVP

### Phase 1: Vault + Marketplace

1. **Web App**
   - User registration (email + passphrase-based key derivation)
   - Vault dashboard: view stored fields, edit, delete
   - Marketplace: browse, buy, and unlock template packages
   - Entitlement dashboard: show active subscriptions, purchase history

2. **Extension (Manifest V3)**
   - Intercept DOCX downloads from the marketplace
   - Interview-style UI to gather required fields
   - Store encrypted values in local IndexedDB
   - Merge stored values into DOCX template (client-side) and allow download
   - Sync encrypted backups to server

3. **Backend**
   - User authentication (passphrase key derivation; optional: OAuth via Chrome Identity API)
   - Template catalog (versioned DOCX + field schemas)
   - Stripe Checkout integration for one-time and subscription payments
   - Entitlement state machine (pending → active → revoked)
   - Encrypted blob storage (S3) for vault backups
   - Metadata-only analytics

### Phase 2: Recommendations + Vertical Bundles

4. **Recommendations Engine**
   - Analyze user's vault metadata (which FieldIDs are filled)
   - Recommend templates based on completion status
   - Avoid content-based recommendations

5. **Vertical Bundles**
   - Pre-configured template packages for specific professions
   - Wizard that interviews user once and populates vault
   - Higher perceived value; reduces cold-start friction

### Phase 3: "Trojan Horse" Extension

6. **External Form Injection**
   - User maps vault fields to external form fields
   - Extension auto-fills external forms with user's encrypted vault data
   - Makes extension useful beyond our template marketplace

## 5. Revenue Streams

| Stream | Model | Target | Metrics |
|--------|-------|--------|---------|
| **Vault Subscription** | $6–$10/mo; optional annual discount | All users | MRR, churn rate |
| **Template Purchases** | $9–$49 per template (one-time) | Marketplace browsers | ARPU per user |
| **Vertical Bundles** | $99–$499 per bundle (discounted vs. individual) | Vertical segments | Bundle attach rate, LTV increase |
| **Premium Tier (B2B)** | $99–$499/mo; audit logs, SSO, HIPAA, GDPR | Law firms, clinics, enterprises | ARR per account |
| **Partner Revenue** | White-label vault + bundles | Professional associations | Revenue share |

## 6. Success Metrics (North Star)

| Metric | Target (Year 1) | Definition |
|--------|-----------------|------------|
| **Vault Subscriptions** | 500 active | Paying monthly vault users |
| **Bundle Revenue** | $50k | Total revenue from vertical bundles |
| **Template Sales** | $30k | Total one-time template revenue |
| **Monthly Churn Rate** | < 5% | Vault subscription cancellations |
| **Time to First Document** | < 5 min | User → interviews → template merge |
| **Data Gravity Index** | 3+ fields/user by week 4 | Avg. fields stored per active user |
| **UPL Incidents** | 0 | Regulatory complaints |

## 7. Scope & Out-of-Scope

### In Scope
- Encrypted data storage and sync
- DOCX template merge (client-side)
- Metadata-based recommendations
- Payment processing (Stripe)
- Multi-device vault access
- Browser extension (Manifest V3)

### Out of Scope (Intentionally)
- Legal advisory or document review
- Attorney networks or referrals
- Annual report filing or compliance monitoring
- Banking, accounting, or tax services
- AI-powered document generation (future)
- Mobile apps (extension covers mobile web)

## 8. Key Constraints & Assumptions

### Assumptions
1. **User has a passphrase** – No account recovery without passphrase; this is a feature (zero-knowledge), not a limitation.
2. **Client-side encryption is sufficient** – We assume users trust WebCrypto and don't need HSM-grade key management.
3. **Legal users understand conditional language** – "Commonly used with" is understood as informational, not advisory.
4. **DOCX is the standard** – We assume users work with DOCX templates; PDF forms are out of scope for MVP.

### Constraints
1. **Zero-knowledge means zero support** – If a user forgets their passphrase, we cannot reset it.
2. **No server-side document logic** – Complex conditional clauses must be evaluated client-side or baked into DOCX.
3. **UPL line is narrow** – Recommendations must be framed carefully.
4. **Browser extension permissions are limited** – We must minimize permissions.

## 9. Competitive Position

**vs. LegalZoom/Rocket Lawyer:**
- They sell services; we sell data utility
- They use data to cross-sell; we guarantee no data mining
- They have high CAC (paid search); we focus on low-CAC verticals
- They have 37% churn; we design for retention via data gravity

**vs. Password Managers (1Password, Bitwarden):**
- They are generic; we are legal-domain-specific
- They don't merge documents; we do
- We cannot compete on password use cases; we don't try

**vs. Free templates (US Legal Forms, LawDepot):**
- They commoditize content; we commoditize data management
- AI makes template content free; our moat is data structure, not text
- They have dark patterns (trials, renewals); we are transparent

## 10. Risk Register (High-Level)

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| UPL complaint filed | Medium | High | Strict recommendation phrasing; zero content analysis; legal review |
| User forgets passphrase | High | Low | Clear messaging on zero-knowledge at signup |
| Extension bugs | Medium | High | Extensive testing; user-friendly error messages |
| CAC higher than projected | High | High | Pivot to vertical partnerships early |
| Data gravity slower than projected | Medium | Medium | Vertical Bundles + Wizard to front-load data entry |
| AI commoditizes templates | Low | Medium | Our moat is data management, not text |