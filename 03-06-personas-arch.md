# ELV PLANNING DOCUMENTS 03-06

## 03_USER_PERSONAS_AND_JOBS.md

### Primary Persona: Dr. Sarah Chen, Therapist

**Demographics:**
- Age: 38
- Profession: Licensed Marriage & Family Therapist (LMFT), private practice
- Location: Portland, OR
- Income: $120k/year
- Tech Comfort: Moderate

**Context:**
- Operates solo therapy practice (3 employees + herself)
- Manages client files, treatment plans, consent forms, billing agreements
- Bound by HIPAA and ethical confidentiality rules
- Uses Google Drive, Dropbox, and email (compliance risk)

**Pain Points:**
1. Data Privacy Risk – Cloud storage for client files; compliance risk
2. Document Management Chaos – Forms scattered across folders, emails
3. Time Wasted on Repetition – Re-enter info into three different systems
4. Liability Concern – Fears data breach
5. Vendor Distrust – Aware "free" vendors mine her data

**Jobs to Be Done (Functional):**
1. Store client information securely – Encrypted, auditable
2. Quickly generate new client onboarding documents
3. Back up critical documents (encrypted)
4. Re-use form templates across clients

**Jobs to Be Done (Emotional):**
1. Feel in control – Know exactly what data is stored and who can access
2. Sleep at night – Reduce anxiety about liability
3. Maintain professionalism – Use trustworthy software

**Willingness to Pay:**
- Monthly Subscription: $8–$15/mo
- Template Bundle: $99–$199 for "Therapist Practice Kit"
- Premium Tier: Maybe $40/mo for audit logs

**How She'd Use ELV:**
1. Sign up; create vault with passphrase
2. Download "Therapist Intake Kit" (5 templates)
3. Fill vault once: practice name, address, insurance info
4. Generate intake form, fee agreement, consent to treatment
5. Periodically sync encrypted vault backup

---

### Secondary Persona: Raj Patel, Solo Founder

**Demographics:**
- Age: 32
- Profession: Startup Founder (AI SaaS)
- Location: San Francisco, CA
- Income: $0 (pre-revenue); Y Combinator funded
- Tech Comfort: High (engineer)

**Context:**
- Founded startup 6 months ago
- Managing multiple legal entities (holding company, operating company, IP entity)
- Documents: incorporation, cap table, SAFEs, NDAs, employment agreements
- Currently: personal Google Drive, email, Dropbox

**Pain Points:**
1. Scattered Documentation – Cap table in email, SAFE terms elsewhere
2. Version Control Hell – Multiple versions of bylaws
3. Data Re-entry – Copy-paste company name, EIN into 10 documents
4. Efficiency – Wants to focus on product, not legal paperwork
5. Investor Concerns – Need clean documentation

**Jobs to Be Done (Functional):**
1. Organize all startup documents in one place
2. Auto-fill company info in new documents
3. Share documents securely with investors/lawyers
4. Generate missing documents

**Willingness to Pay:**
- Monthly Subscription: Yes, $8/mo
- Startup Bundle: $199–$299 for "Founder Kit"
- Time Savings: Would pay $50+ for template saving 5 hours

**How He'd Use ELV:**
1. Sign up; create vault
2. Download "Startup Founder Bundle"
3. Fill vault: company name, EIN, founders, addresses, cap table
4. Generate bylaws, cap table document, equity grant letters
5. Update vault when cap table changes

---

### Tertiary Persona: Michelle Hart, Family Office Manager

**Demographics:**
- Age: 45
- Profession: COO, Family Office (~$500M AUM)
- Location: New York, NY
- Income: $200k/year + bonus
- Tech Comfort: Moderate

**Context:**
- Manages legal infrastructure for family (multiple trusts, LLCs, real estate)
- Coordinates with external lawyers, accountants, tax advisors
- Currently: email, institutional document management, password-protected drives

**Pain Points:**
1. Fragmented Systems – Different advisors use different tools
2. Data Leakage Risk – Documents via email/Dropbox are uncontrolled
3. Audit Trail Gaps – Who accessed what? When?
4. Liability – High-net-worth families are targets; wants minimal surface area
5. Advisor Coordination – Need granular access controls

**Willingness to Pay:**
- Monthly Subscription: $99–$499/mo (business overhead)
- Premium Tier: Yes, for multi-user access, audit logs, SSO
- Implementation Support: Would pay $5k for setup

---

## 04_SYSTEM_ARCHITECTURE.md

### Architecture Overview

**Four Interconnected Systems:**

1. **Web App** – User registration, marketplace, entitlements dashboard, vault management UI
2. **Chromium Extension (MV3)** – Client-side encryption/decryption, DOCX merge, vault sync
3. **Backend Services** – Auth, catalog management, payments (Stripe), entitlements, encrypted blob storage
4. **Storage Layer** – PostgreSQL for metadata; S3 for encrypted blobs; CDN for templates

**Core Design Principle:** Zero-knowledge – server stores encrypted blobs and metadata only.

### Component Details

#### Web App
**Technology Stack:**
- Frontend: Vue.js 3 or React 18+
- State Management: Pinia or Zustand
- Build: Vite
- UI: shadcn/ui or Material UI
- Styling: Tailwind CSS

**Pages:**
1. Authentication – Signup, login, passphrase recovery
2. Vault Dashboard – View/edit vault fields; sync status
3. Marketplace – Browse templates; purchases; ratings
4. Entitlements Dashboard – Active subscriptions; purchase history
5. Account Settings – Change passphrase; manage extensions

#### Chromium Extension (MV3)
**Manifest Structure:**
```json
{
  "manifest_version": 3,
  "name": "Encrypted Legal Vault",
  "permissions": ["storage", "scripting", "webRequest", "tabs"],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"]
  }]
}
```

**Architecture:**
- **background.js** – Service worker; handles crypto, storage sync, API calls
- **popup.html/js** – User-facing UI; vault access, field editing
- **content.js** – Injects into pages; enables form-filling
- **IndexedDB** – Local encrypted storage

**Key Flows:**

**Flow 1: Download & Fill Template**
```
User clicks "Download & Fill" on marketplace
→ Browser downloads DOCX; extension intercepts
→ Extension opens "Interview" UI
→ User fills missing fields
→ Extension decrypts vault locally
→ Extension merges fields into DOCX (client-side)
→ Extension triggers download of filled DOCX
```

**Flow 2: Vault Sync to Cloud**
```
User fills new vault fields
→ Extension encrypts field values using user's key
→ Extension packages encrypted blob (JSON)
→ Extension POSTs blob to /api/vault/backup
→ Server stores encrypted blob in S3
→ User sees "Last backed up: 2 minutes ago"
```

#### Backend API (FastAPI)
**Technology Stack:**
- Framework: FastAPI (Python 3.11+)
- Database: PostgreSQL 14+
- Cache: Redis
- Async: Uvicorn + asyncio
- Deployment: Docker on AWS ECS or Heroku

**Key Endpoints:**
| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| POST | `/auth/signup` | Create user | None |
| POST | `/auth/login` | Verify passphrase | Email + PoW |
| GET | `/vault/backup` | Fetch encrypted blob | JWT |
| POST | `/vault/backup` | Store encrypted blob | JWT |
| GET | `/templates/catalog` | List templates | None |
| POST | `/purchases` | Initiate Stripe payment | JWT |
| POST | `/webhooks/stripe` | Handle payment | Stripe sig |
| GET | `/entitlements` | Check template access | JWT |

#### Storage Layer

**PostgreSQL Schema:**
```sql
-- Users (no plaintext passphrases)
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR UNIQUE NOT NULL,
    passphrase_hash VARCHAR NOT NULL,
    device_key_id VARCHAR,
    created_at TIMESTAMP
);

-- Templates catalog
CREATE TABLE templates (
    id UUID PRIMARY KEY,
    name VARCHAR NOT NULL,
    slug VARCHAR UNIQUE,
    category VARCHAR,
    price DECIMAL(8, 2),
    field_schema JSONB,
    version INTEGER,
    docx_hash VARCHAR,
    created_at TIMESTAMP
);

-- Purchases
CREATE TABLE purchases (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    template_id UUID REFERENCES templates(id),
    stripe_payment_id VARCHAR,
    amount DECIMAL(8, 2),
    status VARCHAR,
    purchased_at TIMESTAMP
);

-- Entitlements
CREATE TABLE entitlements (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    template_id UUID REFERENCES templates(id),
    source VARCHAR,
    expires_at TIMESTAMP,
    created_at TIMESTAMP,
    UNIQUE (user_id, template_id)
);

-- Vault metadata (structure only; no content)
CREATE TABLE vault_metadata (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    field_count INTEGER,
    last_backup_at TIMESTAMP,
    backup_size_bytes INTEGER,
    device_count INTEGER
);
```

**S3 Encrypted Blob Storage:**
- Bucket: `elv-vault-backups`
- Key Format: `/{user_id}/{device_id}/{timestamp}.encrypted`
- Encryption: Client-side key wrapping + S3 server-side AES-256
- Lifecycle: Delete backups after 1 year

---

## 05_DATA_MODEL_AND_METADATA_SCHEMA.md

### Field Schema (Template Definition)

**JSON Format (stored in PostgreSQL `templates.field_schema`):**

```json
{
  "template_id": "550e8400-e29b-41d4-a716-446655440000",
  "version": 1,
  "fields": [
    {
      "id": "402",
      "label": "Legal Entity Name",
      "type": "text",
      "required": true,
      "validation": {
        "min_length": 1,
        "max_length": 255
      },
      "sensitivity": "non-pii",
      "help_text": "Official name of your business entity"
    },
    {
      "id": "403",
      "label": "State of Formation",
      "type": "select",
      "required": true,
      "options": ["AL", "AK", "AZ", "...", "WY"],
      "sensitivity": "non-pii"
    },
    {
      "id": "404",
      "label": "Business Owner SSN",
      "type": "text",
      "required": false,
      "validation": {
        "pattern": "^[0-9]{3}-[0-9]{2}-[0-9]{4}$"
      },
      "sensitivity": "pii"
    }
  ]
}
```

**Field Types:**
- `text` – Free-form text
- `email` – Email (validated client-side)
- `select` – Dropdown
- `multi-select` – Multiple choice
- `date` – ISO 8601
- `textarea` – Multi-line
- `checkbox` – Boolean
- `nested` – Complex object

**Sensitivity Classes:**
- `non-pii` – Public info (company name, state)
- `pii` – Personally identifiable (SSN, address)
- `sensitive` – Highly confidential (trade secrets, medical info)

### Client-Side Encrypted Field Storage

**IndexedDB Structure:**
```javascript
{
  field_id: "402",
  field_label: "Legal Entity Name",
  template_id: "550e8400-...",
  encrypted_value: "U2FsdGVkX1...", // Base64 AES-GCM
  field_type: "text",
  sensitivity: "non-pii",
  created_at: "2024-01-10T15:00:00Z",
  last_edited_at: "2024-01-10T15:30:00Z",
  reuse_count: 3,
  last_used_at: "2024-01-12T10:00:00Z"
}
```

### Vault Backup Format (Encrypted Blob)

```json
{
  "version": 1,
  "exported_at": "2024-01-10T15:30:00Z",
  "user_id": "550e8400-...",
  "device_id": "device-abc123",
  "backup_hash": "sha256:abc123...",
  "fields": [
    {
      "field_id": "402",
      "field_label": "Legal Entity Name",
      "template_id": "550e8400-...",
      "encrypted_value": "U2FsdGVkX1...",
      "field_type": "text",
      "created_at": "2024-01-05T10:00:00Z"
    }
  ]
}
```

---

## 06_CRYPTO_AND_ZERO_KNOWLEDGE_DESIGN.md

### Zero-Knowledge Architecture

**Core Principle:** Server must be mathematically unable to observe user field values.

**Trust Model:**
- **User trusts:** Browser/extension (WebCrypto API) and own passphrase
- **User does NOT trust:** Server, ISP, hosting provider
- **Server capability:** Cannot decrypt vault even if subpoenaed

### Key Derivation

**Algorithm:** PBKDF2 + SHA-256

```javascript
async function deriveEncryptionKey(passphrase, deviceId) {
  const salt = new TextEncoder().encode(`${passphrase}:${deviceId}`);
  
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: salt,
      iterations: 100000
    },
    key,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  
  return derivedKey;
}
```

### Field Encryption (AES-GCM)

```javascript
async function encryptFieldValue(fieldValue, userEncryptionKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    userEncryptionKey,
    new TextEncoder().encode(fieldValue)
  );
  
  return {
    iv: btoa(String.fromCharCode(...new Uint8Array(iv))),
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(cipher))),
    algorithm: "AES-256-GCM"
  };
}
```

### Threat Model

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| **Passphrase Brute-Force** | Medium | High | PBKDF2 100k iterations |
| **S3 Bucket Breach** | Low | Low | Encrypted blobs; key never sent |
| **Database Breach** | Low | Low | No plaintext in DB |
| **MITM (HTTPS)** | Low | Low | TLS 1.3 enforced |
| **Extension Compromise** | Medium | High | Minimal permissions; CSP headers |
| **User Forgets Passphrase** | High | Critical | No recovery (accepted limitation) |
| **Device Theft** | Medium | Medium | Encrypted vault in IndexedDB |
| **Server Compromise** | Low | Low | Zero-knowledge guarantees safety |

### What Server Knows vs. Doesn't Know

| Aspect | Server Knows | Server Does NOT Know |
|--------|--------------|----------------------|
| **User Identity** | Email, passphrase hash | Passphrase plaintext |
| **Vault Data** | 47 fields total; 80% ready for Lease | Field values |
| **Template Usage** | Bought "Lease"; completed 12/15 fields | Which fields filled |
| **Backup** | 3.2 KB encrypted blob; 2 devices synced | Backup contents |
| **Entitlements** | Has access to "Lease" | Personal/business info |
| **Analytics** | Lease is popular; users take 30s | User details |