# ENCRYPTED LEGAL VAULT (ELV) - REMAINING PLANNING DOCUMENTATION (PART 2)

## 04_SYSTEM_ARCHITECTURE.md

```markdown
# System Architecture

## 1. Architecture Overview

The ELV consists of four interconnected systems:

1. **Web App** – User registration, marketplace, entitlements dashboard, vault management UI
2. **Chromium Extension (MV3)** – Client-side encryption/decryption, DOCX merge, vault sync, external form injection
3. **Backend Services** – Auth, catalog management, payments (Stripe), entitlements, encrypted blob storage, analytics
4. **Storage Layer** – Database (PostgreSQL) for metadata/users/entitlements; S3 for encrypted blobs; CDN for template distribution

**Core Design Principle:** Zero-knowledge – server stores encrypted blobs and metadata only; plaintext values never leave client device.

---

## 2. High-Level Architecture Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                         USER DEVICE                             │
│                                                                 │
│  ┌──────────────┐           ┌─────────────────────────────┐   │
│  │ Web Browser  │           │   Browser Extension (MV3)   │   │
│  │              │           │                             │   │
│  │ - Marketplace│◄─────────►│ - Vault UI                  │   │
│  │ - Dashboard  │           │ - Encryption Engine         │   │
│  │ - Auth UI    │           │ - DOCX Merge (WASM)         │   │
│  └──────┬───────┘           │ - Form Autofill             │   │
│         │                   │ - IndexedDB (encrypted)     │   │
│         │                   └─────────┬───────────────────┘   │
│         │                             │                       │
└─────────┼─────────────────────────────┼───────────────────────┘
          │                             │
          │ HTTPS                       │ HTTPS
          │                             │
┌─────────▼─────────────────────────────▼───────────────────────┐
│                      BACKEND SERVICES                          │
│                                                                │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ Auth API    │  │ Template API │  │ Entitlement API    │  │
│  │             │  │              │  │                    │  │
│  │ - Signup    │  │ - Catalog    │  │ - Purchase State  │  │
│  │ - Login     │  │ - Version    │  │ - Subscription    │  │
│  │ - Device    │  │ - Download   │  │ - Access Check    │  │
│  └──────┬──────┘  └──────┬───────┘  └─────────┬──────────┘  │
│         │                │                     │             │
│         │                │                     │             │
│  ┌──────▼────────────────▼─────────────────────▼──────────┐ │
│  │              Core Business Logic Layer                   │ │
│  │                                                          │ │
│  │  - User Management    - Payment Processing              │ │
│  │  - Vault Metadata     - Analytics (metadata only)       │ │
│  │  - Recommendation     - Audit Logs                      │ │
│  └──────┬────────────────────────────────────┬─────────────┘ │
│         │                                    │               │
└─────────┼────────────────────────────────────┼───────────────┘
          │                                    │
          │                                    │
┌─────────▼────────────────────┐   ┌──────────▼──────────────┐
│     PostgreSQL Database      │   │   Amazon S3 Storage     │
│                              │   │                         │
│  - Users (no plaintext pwd)  │   │ - Encrypted Vault Blobs│
│  - Entitlements              │   │ - User Key Backups     │
│  - Template Metadata         │   │ - Audit Logs (signed)  │
│  - Vault Metadata (FieldIDs) │   │                         │
│  - Analytics Events          │   │                         │
└──────────────────────────────┘   └─────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                          │
│                                                               │
│  ┌─────────────────┐        ┌────────────────────────────┐  │
│  │  Stripe         │        │  CloudFront CDN            │  │
│  │                 │        │                            │  │
│  │  - Checkout     │        │  - DOCX Template Files     │  │
│  │  - Subscriptions│        │  - Static Assets           │  │
│  │  - Webhooks     │        │                            │  │
│  └─────────────────┘        └────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Component Breakdown

### 3.1. Web App

**Tech Stack:**
- **Framework:** React (or Vue.js) + TypeScript
- **State Management:** Zustand or Redux Toolkit
- **Styling:** Tailwind CSS
- **Hosting:** Vercel (serverless) or AWS Amplify

**Responsibilities:**
1. User authentication UI (signup, login, device registration)
2. Marketplace browsing (template catalog, search, filtering)
3. Payment flows (Stripe Checkout integration)
4. Entitlements dashboard (active subscriptions, purchase history)
5. Vault management UI (view stored fields, edit metadata, delete fields)
6. Recommendations display (based on backend analytics)

**Key Constraints:**
- **No plaintext data** – Web app never sees user's vault values; only metadata
- **Session management** – JWT tokens for API access; refresh tokens stored securely
- **CSP headers** – Strict Content Security Policy to prevent XSS

---

### 3.2. Browser Extension (Manifest V3)

**Tech Stack:**
- **Manifest Version:** V3 (Chrome, Edge, Brave compatible)
- **Language:** TypeScript
- **Crypto Library:** WebCrypto API (native browser)
- **DOCX Processing:** docxtemplater + PizZip (for ZIP manipulation) compiled to WebAssembly
- **Storage:** IndexedDB (encrypted)

**Responsibilities:**
1. **Vault management** – Encrypt/decrypt field values client-side
2. **Template merging** – Inject vault values into DOCX templates (client-side)
3. **Sync** – Upload encrypted vault blobs to S3 (user-initiated or periodic)
4. **Form autofill** – Inject vault data into external web forms
5. **Metadata reporting** – Report which FieldIDs are filled (not values) to backend for analytics

**Key Constraints:**
- **MV3 restrictions** – No remote code execution; all logic must be bundled
- **Memory limits** – WASM compilation for DOCX must fit in extension memory budget
- **Permissions** – Minimize requested permissions (no `<all_urls>`, only user-approved domains for autofill)

**Lifecycle:**
```
Install → Register Device → Download Vault Blob from S3 → Decrypt Locally
   ↓
User adds/edits field → Encrypt → Store in IndexedDB
   ↓
User triggers sync → Encrypt vault → Upload to S3
   ↓
User generates document → Fetch template from CDN → Merge with vault (client-side) → Download DOCX
```

---

### 3.3. Backend API

**Tech Stack:**
- **Framework:** FastAPI (Python) or Express.js (Node.js)
- **Database:** PostgreSQL (via SQLAlchemy ORM for Python, or Prisma for Node.js)
- **Authentication:** JWT + Device fingerprinting (no password storage; passphrase is key derivation only)
- **Payments:** Stripe Checkout + Webhooks
- **Hosting:** AWS Lambda + API Gateway (serverless) or Railway/Render (containerized)

**API Endpoints:**

#### Auth
- `POST /auth/signup` – Create user account; return device registration token
- `POST /auth/login` – Device login; return JWT access token
- `POST /auth/device/register` – Register new device with user account
- `POST /auth/device/revoke` – Revoke device access

#### Templates
- `GET /templates` – List all available templates (metadata: name, price, fields required)
- `GET /templates/:id` – Get template details + field schema
- `GET /templates/:id/download` – Download DOCX file (requires entitlement check)

#### Entitlements
- `GET /entitlements` – List user's active subscriptions + purchased templates
- `POST /entitlements/purchase` – Initiate Stripe Checkout session
- `POST /webhooks/stripe` – Handle Stripe events (payment success, subscription created/cancelled)

#### Vault (Metadata Only)
- `POST /vault/metadata/sync` – Update vault metadata (which FieldIDs are filled, not values)
- `GET /vault/recommendations` – Return recommended templates based on filled fields

#### Encrypted Blobs
- `PUT /vault/blob` – Upload encrypted vault blob to S3 (signed URL)
- `GET /vault/blob` – Download encrypted vault blob from S3 (signed URL)

**Key Constraints:**
- **Zero plaintext** – Backend never decrypts vault values; only stores encrypted blobs + metadata
- **Entitlement enforcement** – All template downloads require active entitlement (subscription or purchase)
- **Stripe webhook validation** – Verify webhook signatures to prevent fake payment events

---

### 3.4. Storage Layer

#### PostgreSQL Schema (High-Level)

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    metadata JSONB  -- timezone, locale, etc.
);

-- Devices table (multi-device support)
CREATE TABLE devices (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    device_fingerprint VARCHAR(512) NOT NULL,  -- hashed device ID
    registered_at TIMESTAMP DEFAULT NOW(),
    last_seen TIMESTAMP,
    revoked BOOLEAN DEFAULT FALSE
);

-- Templates table
CREATE TABLE templates (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price_cents INT NOT NULL,  -- price in cents (e.g., $9.99 = 999)
    version INT NOT NULL,
    field_schema JSONB NOT NULL,  -- list of required FieldIDs
    docx_url VARCHAR(512) NOT NULL,  -- CDN URL for DOCX file
    created_at TIMESTAMP DEFAULT NOW()
);

-- Entitlements table (subscriptions + one-time purchases)
CREATE TABLE entitlements (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    type VARCHAR(50) NOT NULL,  -- 'subscription', 'template_purchase'
    template_id UUID REFERENCES templates(id) NULL,  -- null for subscriptions
    stripe_subscription_id VARCHAR(255) NULL,  -- Stripe subscription ID
    status VARCHAR(50) NOT NULL,  -- 'active', 'pending', 'cancelled', 'expired'
    granted_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NULL,  -- null for one-time purchases
    metadata JSONB  -- Stripe metadata, payment details
);

-- Vault metadata (no plaintext values!)
CREATE TABLE vault_metadata (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    field_id VARCHAR(255) NOT NULL,  -- e.g., 'company_name', 'ein'
    filled BOOLEAN DEFAULT TRUE,  -- is this field populated?
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Analytics events (metadata only)
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    event_type VARCHAR(100) NOT NULL,  -- 'template_generated', 'field_added', 'vault_synced'
    metadata JSONB,  -- context (e.g., template_id, device_id)
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### S3 Bucket Structure

```
s3://elv-encrypted-vaults/
├── users/
│   └── {user_id}/
│       ├── vault.enc  -- encrypted vault blob (AES-256-GCM)
│       ├── vault.enc.sig  -- HMAC signature of vault blob
│       └── backups/
│           ├── vault-2025-01-01.enc
│           └── vault-2025-01-15.enc
└── audit-logs/
    └── {user_id}/
        └── {year}/{month}/{day}/
            └── {timestamp}.log.enc  -- encrypted audit logs
```

**S3 Lifecycle Policies:**
- Vault backups: retain for 90 days, then archive to Glacier
- Audit logs: retain for 1 year (compliance requirement)

---

## 4. Security Architecture

### 4.1. Encryption Flow

**User Passphrase → Master Key Derivation:**
```
User enters passphrase (e.g., "correct horse battery staple")
   ↓
PBKDF2-HMAC-SHA256 (100,000 iterations, salt = user_id)
   ↓
Master Key (256-bit AES key)
   ↓
Used to encrypt vault data (AES-256-GCM)
```

**Field Encryption:**
```
User enters field value: "Acme Corp LLC"
   ↓
Encrypt with Master Key (AES-256-GCM) + random IV
   ↓
Store in IndexedDB: {field_id: "company_name", encrypted_value: "...", iv: "..."}
```

**Vault Sync:**
```
Serialize all fields → Encrypt entire vault → Upload to S3
   ↓
Server receives encrypted blob; cannot decrypt
   ↓
User downloads blob → Decrypts with passphrase-derived Master Key
```

### 4.2. Threat Model

| Threat | Mitigation |
|--------|------------|
| **Phishing (user enters passphrase on fake site)** | CSP headers; educate users on URL verification; consider 2FA for high-value users |
| **Man-in-the-middle (HTTPS downgrade)** | HSTS headers; certificate pinning in extension |
| **Server breach (attacker gains DB access)** | Zero-knowledge: encrypted blobs are useless without user passphrase |
| **Extension compromise (malicious code injected)** | Chrome Web Store review process; CSP; subresource integrity |
| **User forgets passphrase** | No recovery without security questions (optional feature); clearly communicated at signup |
| **Brute force on weak passphrase** | Enforce minimum passphrase entropy (e.g., 4+ words, 20+ characters); rate-limit login attempts |

### 4.3. Access Control

**Device Registration:**
- User logs in from new device → backend issues device token
- Device token stored in extension's local storage
- All API requests include device token + JWT

**Entitlement Checks:**
- Every template download requires entitlement check
- Backend verifies: user has active subscription OR purchased specific template
- If expired/revoked, return 403 Forbidden

**Audit Logs:**
- All vault accesses logged (timestamp, device_id, action)
- Logs encrypted with user's Master Key
- Available for download in Premium Tier

---

## 5. Data Flow Diagrams

### 5.1. User Signup Flow

```
User (Web App) → Enter email + passphrase
   ↓
Frontend derives Master Key from passphrase (PBKDF2)
   ↓
POST /auth/signup {email, device_fingerprint}
   ↓
Backend creates user record (no passphrase stored)
   ↓
Backend returns device registration token + JWT
   ↓
Frontend stores device token in extension storage
   ↓
User is now logged in
```

### 5.2. Template Purchase Flow

```
User browses marketplace → Clicks "Buy" on template
   ↓
Web app calls POST /entitlements/purchase {template_id}
   ↓
Backend creates Stripe Checkout session
   ↓
User redirected to Stripe Checkout → Completes payment
   ↓
Stripe sends webhook to POST /webhooks/stripe
   ↓
Backend validates webhook signature
   ↓
Backend creates entitlement record (status='active')
   ↓
User returns to web app → Sees "Download" button
   ↓
User clicks "Download" → Extension fetches template from CDN
   ↓
Extension prompts user for required fields → Merges → Downloads DOCX
```

### 5.3. Document Generation Flow

```
User has active entitlement for template "Commercial Lease"
   ↓
Extension fetches template DOCX from CDN
   ↓
Extension loads vault from IndexedDB → Decrypts fields
   ↓
Extension opens interview UI: "Commercial Lease requires: landlord_name, tenant_name, monthly_rent"
   ↓
User fills in missing fields (if any)
   ↓
Extension encrypts new fields → Stores in IndexedDB
   ↓
Extension merges fields into DOCX (client-side, using docxtemplater WASM)
   ↓
Extension triggers browser download of merged DOCX
   ↓
Extension reports metadata to backend: POST /vault/metadata/sync {field_ids: ["landlord_name", "tenant_name"]}
   ↓
Backend updates vault_metadata table (no values, just FieldIDs)
```

### 5.4. Vault Sync Flow

```
User clicks "Sync Vault" in extension
   ↓
Extension serializes all fields → Encrypts vault blob
   ↓
Extension requests signed S3 upload URL: GET /vault/blob/upload-url
   ↓
Backend generates pre-signed S3 PUT URL (expires in 5 minutes)
   ↓
Extension uploads encrypted blob to S3 via pre-signed URL
   ↓
Extension notifies backend: POST /vault/metadata/sync {synced_at: timestamp}
   ↓
Backend logs sync event in analytics_events
```

---

## 6. Scalability & Performance

### 6.1. Expected Load (Year 1)

| Metric | Estimate |
|--------|----------|
| **Active Users** | 500 vault subscribers |
| **Daily API Requests** | ~5k (10 req/user/day: login, catalog, metadata sync) |
| **Template Downloads** | ~100/day (2 templates/user/month) |
| **S3 Storage** | ~50 MB/user = 25 GB total |
| **Database Size** | <1 GB (metadata only) |

**Bottlenecks:**
- Stripe webhook processing (must be fast to avoid timeouts)
- S3 pre-signed URL generation (< 100ms)
- DOCX merge in extension (WASM performance; target <5 sec for merge)

### 6.2. Scaling Strategy

**Vertical Scaling (Year 1):**
- Single backend instance (2 vCPU, 4 GB RAM) can handle 10k req/sec
- PostgreSQL on managed service (AWS RDS or Supabase)
- S3 scales automatically

**Horizontal Scaling (Year 2+):**
- Multiple backend instances behind load balancer
- Read replicas for PostgreSQL (analytics queries offloaded)
- CloudFront CDN for static assets + template files

---

## 7. Technology Selection Rationale

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Web Framework** | React + TypeScript | Industry standard; strong typing; large ecosystem |
| **Backend** | FastAPI (Python) | Async support; automatic OpenAPI docs; fast dev velocity |
| **Database** | PostgreSQL | JSONB support for flexible metadata; strong ACID guarantees |
| **Storage** | AWS S3 | Industry-standard object storage; 99.999999999% durability |
| **Payments** | Stripe | Best-in-class developer experience; SCA compliance built-in |
| **Encryption** | WebCrypto API | Native browser support; no external dependencies; audited by W3C |
| **DOCX Processing** | docxtemplater | Mature library; supports complex templates; WASM-compilable |
| **Extension** | Manifest V3 | Future-proof (MV2 deprecated); Chrome, Edge, Brave compatible |

---

## 8. DevOps & Deployment

### 8.1. CI/CD Pipeline

**Frontend (Web App):**
- GitHub Actions → Build → Test → Deploy to Vercel

**Backend:**
- GitHub Actions → Build Docker image → Push to AWS ECR → Deploy to Lambda or ECS

**Extension:**
- GitHub Actions → Build → Package ZIP → Upload to Chrome Web Store

### 8.2. Monitoring

**APM:**
- Sentry for error tracking
- Datadog or New Relic for performance monitoring

**Metrics:**
- Prometheus + Grafana for custom metrics (template downloads, vault syncs, entitlement checks)

**Logging:**
- CloudWatch Logs or Logtail for centralized logging
- Structured JSON logs for easy parsing

### 8.3. Backup & Disaster Recovery

**Database:**
- Daily automated backups (AWS RDS automated backups)
- Point-in-time recovery enabled

**S3:**
- Versioning enabled (retain previous vault versions)
- Cross-region replication for disaster recovery

**Extension:**
- Users encouraged to export vault backup (encrypted file) to local storage

---

## 9. Open Questions & Decisions

| Question | Options | Recommendation |
|----------|---------|----------------|
| **Mobile support?** | Native app, PWA, or mobile extension | Defer to Year 2; focus on desktop extension MVP |
| **Passphrase recovery?** | None (pure zero-knowledge) vs. Optional security questions | Optional security questions (clearly flag as less secure) |
| **WASM bundle size?** | docxtemplater + PizZip = ~500 KB | Acceptable; lazy-load WASM only when merging |
| **Multi-user vaults (family office)?** | Shared vault with role-based access | Year 2 feature; too complex for MVP |
| **AI-generated templates?** | User pastes AI output, vault injects variables | Year 2 feature; requires careful UPL framing |

---

## 10. Conclusion

This architecture balances **security** (zero-knowledge), **usability** (client-side merge is seamless), and **scalability** (serverless components, S3 storage).

The critical path for MVP:
1. Auth system (passphrase-based key derivation)
2. Template catalog + Stripe integration
3. Extension vault + DOCX merge
4. Encrypted blob sync to S3

All other features (recommendations, vertical bundles, external form injection) are additive and can be built incrementally.
```

---

## 05_DATA_MODEL_AND_METADATA_SCHEMA.md

```markdown
# Data Model and Metadata Schema

## 1. Overview

The ELV data model consists of three layers:

1. **User Data (Encrypted)** – Stored client-side in IndexedDB and synced to S3 as encrypted blobs; server never sees plaintext
2. **Metadata (Cleartext)** – Stored on server (PostgreSQL); describes vault structure but not content
3. **Template Schemas** – Define required fields for each legal document

This document specifies the schemas, relationships, and constraints.

---

## 2. User Data (Encrypted Layer)

### 2.1. Vault Schema (Client-Side IndexedDB)

**Structure:**
```typescript
interface VaultField {
  field_id: string;           // Unique identifier (e.g., "company_name", "ein")
  encrypted_value: string;    // Base64-encoded encrypted value (AES-256-GCM)
  iv: string;                 // Initialization vector for encryption
  field_type: FieldType;      // Type of field (text, date, address, etc.)
  tags: string[];             // User-defined tags for organization
  created_at: number;         // Unix timestamp
  updated_at: number;         // Unix timestamp
}

type FieldType =
  | "text"            // Free-form text (e.g., company name)
  | "email"           // Email address
  | "phone"           // Phone number
  | "date"            // Date (ISO 8601)
  | "address"         // Structured address
  | "currency"        // Currency amount
  | "percentage"      // Percentage value
  | "ssn"             // Social Security Number (masked in UI)
  | "ein"             // Employer Identification Number
  | "url"             // URL
  | "multi_line_text" // Long-form text (e.g., business description)
  | "selection"       // Single-select from options (e.g., state)
  | "boolean";        // Yes/No or checkbox

interface Vault {
  user_id: string;
  fields: VaultField[];
  version: number;             // Vault version (incremented on each sync)
  last_synced_at: number | null; // Unix timestamp of last sync to S3
}
```

**Storage:**
- Stored in browser's IndexedDB (extension local storage)
- Each field encrypted individually with user's Master Key
- Vault serialized and encrypted for S3 sync

**Constraints:**
- `field_id` must be unique within a vault
- `encrypted_value` must be non-empty (empty fields are deleted)
- `iv` must be 96 bits (12 bytes) for AES-GCM

---

### 2.2. Structured Field Types

Some fields have sub-structure (e.g., address). These are serialized as JSON before encryption.

**Address Field:**
```typescript
interface Address {
  street_line_1: string;
  street_line_2?: string;
  city: string;
  state: string;          // 2-letter state code (e.g., "CA")
  zip: string;            // ZIP or ZIP+4
  country: string;        // ISO 3166-1 alpha-2 (e.g., "US")
}
```

**Example:**
```typescript
{
  field_id: "company_address",
  encrypted_value: encrypt(JSON.stringify({
    street_line_1: "123 Main St",
    city: "San Francisco",
    state: "CA",
    zip: "94102",
    country: "US"
  })),
  iv: "...",
  field_type: "address",
  tags: ["business"],
  created_at: 1704067200000,
  updated_at: 1704067200000
}
```

---

## 3. Metadata (Server-Side PostgreSQL)

### 3.1. Users Table

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    timezone VARCHAR(50) DEFAULT 'UTC',
    locale VARCHAR(10) DEFAULT 'en-US',
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_users_email ON users(email);
```

**Notes:**
- No password field (passphrase never leaves client)
- `metadata` stores flexible user preferences (e.g., `{"theme": "dark"}`)

---

### 3.2. Devices Table

```sql
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_fingerprint VARCHAR(512) UNIQUE NOT NULL,
    device_name VARCHAR(255),  -- User-friendly name (e.g., "MacBook Pro")
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE,
    revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb  -- OS, browser version, etc.
);

CREATE INDEX idx_devices_user_id ON devices(user_id);
CREATE INDEX idx_devices_fingerprint ON devices(device_fingerprint);
```

**Device Fingerprint Generation (Client-Side):**
```typescript
// Combine browser + hardware identifiers
const fingerprint = await hashSHA256(
  navigator.userAgent +
  navigator.platform +
  screen.width + "x" + screen.height +
  navigator.hardwareConcurrency +
  await getCanvasFingerprint()  // Canvas rendering fingerprint
);
```

**Constraints:**
- User can have max 5 active (non-revoked) devices
- Device fingerprint must be unique across all users

---

### 3.3. Templates Table

```sql
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),  -- e.g., "Business Formation", "Contracts", "HR"
    price_cents INT NOT NULL CHECK (price_cents >= 0),
    version INT NOT NULL DEFAULT 1,
    field_schema JSONB NOT NULL,  -- List of required FieldIDs + types
    docx_url VARCHAR(512) NOT NULL,  -- CDN URL for DOCX file
    preview_url VARCHAR(512),  -- URL for PDF preview
    complexity VARCHAR(50) DEFAULT 'simple',  -- 'simple', 'moderate', 'complex'
    estimated_time_minutes INT,  -- Est. time to fill fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    published BOOLEAN DEFAULT FALSE,  -- Only published templates visible
    metadata JSONB DEFAULT '{}'::jsonb  -- Tags, use cases, etc.
);

CREATE INDEX idx_templates_category ON templates(category);
CREATE INDEX idx_templates_published ON templates(published);
```

**Field Schema Example:**
```json
{
  "required_fields": [
    {
      "field_id": "company_name",
      "field_type": "text",
      "label": "Company Legal Name",
      "placeholder": "Acme Corp LLC",
      "validation": {
        "max_length": 255,
        "required": true
      }
    },
    {
      "field_id": "ein",
      "field_type": "ein",
      "label": "Employer Identification Number",
      "placeholder": "XX-XXXXXXX",
      "validation": {
        "pattern": "^\\d{2}-\\d{7}$",
        "required": true
      }
    },
    {
      "field_id": "company_address",
      "field_type": "address",
      "label": "Principal Business Address",
      "validation": {
        "required": true
      }
    }
  ],
  "optional_fields": [
    {
      "field_id": "dba_name",
      "field_type": "text",
      "label": "Doing Business As (DBA)",
      "validation": {
        "required": false
      }
    }
  ],
  "conditional_logic": [
    {
      "if_field": "state",
      "equals": "CA",
      "then_require": ["ca_franchise_tax_id"]
    }
  ]
}
```

**Complexity Levels:**
- **Simple:** <10 fields, no conditional logic (e.g., NDA, Simple Lease)
- **Moderate:** 10-30 fields, some conditional logic (e.g., Operating Agreement)
- **Complex:** 30+ fields, extensive conditional logic (e.g., Shareholder Agreement)

---

### 3.4. Entitlements Table

```sql
CREATE TABLE entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('subscription', 'template_purchase', 'bundle_purchase')),
    template_id UUID REFERENCES templates(id) ON DELETE SET NULL,  -- NULL for subscriptions
    stripe_subscription_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'active', 'cancelled', 'expired', 'refunded')),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,  -- NULL for one-time purchases (never expire)
    cancelled_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb  -- Stripe metadata, refund details, etc.
);

CREATE INDEX idx_entitlements_user_id ON entitlements(user_id);
CREATE INDEX idx_entitlements_status ON entitlements(status);
CREATE INDEX idx_entitlements_stripe_sub ON entitlements(stripe_subscription_id);
```

**Business Rules:**
- **Subscription:** `type='subscription'`, `template_id=NULL`, `expires_at` set to subscription period end
- **Template Purchase:** `type='template_purchase'`, `template_id` set, `expires_at=NULL` (perpetual)
- **Bundle Purchase:** `type='bundle_purchase'`, multiple entitlement records created (one per template in bundle)

**State Machine:**
```
pending → (Stripe confirms payment) → active
active → (user cancels) → cancelled
active → (subscription expires) → expired
active → (refund issued) → refunded
```

---

### 3.5. Vault Metadata Table

```sql
CREATE TABLE vault_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    field_id VARCHAR(255) NOT NULL,  -- e.g., "company_name", "ein"
    field_type VARCHAR(50) NOT NULL,  -- Matches FieldType enum
    filled BOOLEAN DEFAULT TRUE,  -- Is this field populated?
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_vault_metadata_user_field ON vault_metadata(user_id, field_id);
CREATE INDEX idx_vault_metadata_field_type ON vault_metadata(field_type);
```

**Purpose:**
- Tracks **which** fields a user has filled (not **what** values)
- Enables privacy-preserving recommendations (e.g., "User has filled 'company_name' and 'ein', recommend 'Operating Agreement'")

**Sync Logic:**
```typescript
// Extension syncs metadata after vault changes
async function syncVaultMetadata(vault: Vault) {
  const metadata = vault.fields.map(field => ({
    field_id: field.field_id,
    field_type: field.field_type,
    filled: true,
    updated_at: field.updated_at
  }));
  
  await api.post('/vault/metadata/sync', { metadata });
}
```

---

### 3.6. Analytics Events Table

```sql
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,  -- Allow anonymous events
    event_type VARCHAR(100) NOT NULL,  -- e.g., 'template_generated', 'field_added', 'vault_synced'
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,  -- Context (template_id, field_id, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_analytics_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_created_at ON analytics_events(created_at);
```

**Common Event Types:**
```typescript
type EventType =
  | "user_signup"
  | "device_registered"
  | "template_purchased"
  | "template_downloaded"
  | "template_generated"  // Document merged and downloaded
  | "vault_synced"
  | "field_added"
  | "field_updated"
  | "field_deleted"
  | "subscription_created"
  | "subscription_cancelled"
  | "recommendation_clicked";
```

**Example Event:**
```json
{
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "event_type": "template_generated",
  "device_id": "987fcdeb-51a2-43f6-b789-123456789abc",
  "metadata": {
    "template_id": "abc123",
    "template_name": "Operating Agreement",
    "fields_filled": ["company_name", "ein", "member_names"],
    "generation_time_ms": 1234
  },
  "created_at": "2025-01-15T10:30:00Z"
}
```

---

## 4. Template Schemas

### 4.1. Common Field IDs (Standardized)

To enable data reuse across templates, we define **standard Field IDs**:

| Field ID | Type | Description |
|----------|------|-------------|
| `company_name` | text | Legal entity name |
| `dba_name` | text | Doing Business As (trade name) |
| `ein` | ein | Employer Identification Number |
| `ssn` | ssn | Social Security Number (for sole props) |
| `company_address` | address | Principal business address |
| `mailing_address` | address | Mailing address (if different) |
| `state_of_formation` | selection | State where entity is formed |
| `formation_date` | date | Date of entity formation |
| `fiscal_year_end` | date | Fiscal year end date |
| `registered_agent_name` | text | Registered agent name |
| `registered_agent_address` | address | Registered agent address |
| `manager_name` | text | LLC manager name |
| `member_names` | multi_line_text | List of LLC members |
| `officer_names` | multi_line_text | List of corporate officers |
| `authorized_shares` | text | Number of authorized shares (corp) |
| `par_value` | currency | Par value per share |
| `landlord_name` | text | Landlord name (leases) |
| `tenant_name` | text | Tenant name (leases) |
| `monthly_rent` | currency | Monthly rent amount |
| `security_deposit` | currency | Security deposit amount |
| `lease_start_date` | date | Lease start date |
| `lease_end_date` | date | Lease end date |
| `employee_name` | text | Employee name (HR docs) |
| `employee_ssn` | ssn | Employee SSN |
| `employee_address` | address | Employee address |
| `start_date` | date | Employment start date |
| `salary` | currency | Annual salary |
| `nda_effective_date` | date | NDA effective date |
| `nda_expiration_date` | date | NDA expiration date |

**Rationale:**
- Standardized field IDs enable cross-template reuse (e.g., `company_name` used in Operating Agreement, Commercial Lease, W-9)
- Reduces user data entry friction
- Enables intelligent recommendations ("You've filled fields for a Commercial Lease; you might need an Eviction Notice")

---

### 4.2. Template Field Mapping

**Example: Operating Agreement Template**

```json
{
  "template_id": "op-agreement-llc-v1",
  "name": "LLC Operating Agreement",
  "required_fields": [
    "company_name",
    "state_of_formation",
    "formation_date",
    "principal_office_address",
    "member_names",
    "member_ownership_percentages"
  ],
  "optional_fields": [
    "dba_name",
    "fiscal_year_end",
    "dissolution_provisions"
  ],
  "merge_instructions": {
    "{{COMPANY_NAME}}": "company_name",
    "{{STATE}}": "state_of_formation",
    "{{FORMATION_DATE}}": "formation_date",
    "{{PRINCIPAL_ADDRESS}}": "principal_office_address",
    "{{MEMBER_LIST}}": {
      "source": "member_names",
      "format": "numbered_list"  // Transform multi-line text into numbered list
    },
    "{{OWNERSHIP_TABLE}}": {
      "source": ["member_names", "member_ownership_percentages"],
      "format": "table"  // Generate table from two arrays
    }
  }
}
```

**DOCX Merge Tokens:**
- Use double-brace syntax: `{{TOKEN_NAME}}`
- Extension searches DOCX XML for tokens, replaces with vault values
- Conditional sections: `{{#if state === 'CA'}}California-specific clause{{/if}}`

---

## 5. Relationships & Constraints

### 5.1. Entity-Relationship Diagram

```
users (1) ────── (N) devices
  │
  │
  ├────── (N) entitlements ────── (1) templates
  │
  └────── (N) vault_metadata
  │
  └────── (N) analytics_events
```

### 5.2. Business Logic Constraints

**Entitlement Access:**
```sql
-- User can access template if:
-- 1. They have an active subscription, OR
-- 2. They purchased the specific template

SELECT templates.*
FROM templates
WHERE templates.published = TRUE
  AND (
    -- Active subscription
    EXISTS (
      SELECT 1 FROM entitlements
      WHERE entitlements.user_id = :user_id
        AND entitlements.type = 'subscription'
        AND entitlements.status = 'active'
        AND (entitlements.expires_at IS NULL OR entitlements.expires_at > NOW())
    )
    OR
    -- Specific template purchase
    EXISTS (
      SELECT 1 FROM entitlements
      WHERE entitlements.user_id = :user_id
        AND entitlements.template_id = templates.id
        AND entitlements.status = 'active'
    )
  );
```

**Device Limit:**
```sql
-- User cannot register more than 5 active devices
CREATE OR REPLACE FUNCTION check_device_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM devices WHERE user_id = NEW.user_id AND revoked = FALSE) >= 5 THEN
        RAISE EXCEPTION 'User has reached maximum device limit';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_device_limit
BEFORE INSERT ON devices
FOR EACH ROW
EXECUTE FUNCTION check_device_limit();
```

---

## 6. Data Migration & Versioning

### 6.1. Vault Versioning

**Problem:** User syncs vault from Device A, then syncs from Device B with stale data → conflict

**Solution:** Version-based conflict resolution

```typescript
interface Vault {
  version: number;  // Incremented on each sync
  last_synced_at: number;
}

async function syncVault(vault: Vault) {
  const remote = await fetchRemoteVault();
  
  if (remote.version > vault.version) {
    // Remote is newer; download and merge
    const merged = mergeVaults(vault, remote);
    return merged;
  } else {
    // Local is newer or equal; upload
    vault.version += 1;
    await uploadVault(vault);
  }
}

function mergeVaults(local: Vault, remote: Vault): Vault {
  // Last-write-wins per field
  const merged = { ...local };
  
  for (const remoteField of remote.fields) {
    const localField = local.fields.find(f => f.field_id === remoteField.field_id);
    
    if (!localField || remoteField.updated_at > localField.updated_at) {
      // Remote field is newer
      merged.fields = merged.fields.filter(f => f.field_id !== remoteField.field_id);
      merged.fields.push(remoteField);
    }
  }
  
  merged.version = Math.max(local.version, remote.version) + 1;
  return merged;
}
```

### 6.2. Schema Migrations

**Template Schema Evolution:**
- Version templates (e.g., "Operating Agreement v2" adds new fields)
- Old purchased templates remain valid (user has perpetual access to v1)
- New users get latest version

**Database Migrations:**
- Use Alembic (Python) or Prisma Migrate (Node.js)
- All migrations must be backward-compatible (add columns, never drop)

---

## 7. Privacy & Compliance

### 7.1. GDPR Compliance

**Right to Access:**
- User can export vault (encrypted blob) and metadata (JSON download)

**Right to Erasure:**
- Delete user record → CASCADE deletes devices, entitlements, vault_metadata, analytics_events
- S3 vault blobs deleted within 30 days (lifecycle policy)

**Data Minimization:**
- Server stores only metadata (FieldIDs, not values)
- Analytics events do not contain PII (user_id pseudonymized)

### 7.2. HIPAA Compliance (for therapists)

**Business Associate Agreement (BAA):**
- ELV is NOT a Business Associate (we don't see PHI)
- Client-side encryption ensures ELV never processes PHI
- Users must sign attestation: "I understand ELV does not see my data"

**Audit Logs:**
- Premium Tier includes encrypted audit logs (who accessed what, when)
- Logs signed with HMAC to prevent tampering

---

## 8. Conclusion

This data model supports:
1. **Zero-knowledge architecture** – Server stores metadata, not content
2. **Cross-template data reuse** – Standardized Field IDs
3. **Flexible entitlements** – Subscriptions, one-time purchases, bundles
4. **Privacy-preserving analytics** – Metadata-only events
5. **Multi-device sync** – Version-based conflict resolution

Next steps:
- Implement CRUD APIs for all tables
- Define template field schemas for initial 10 templates
- Build vault merge logic (last-write-wins per field)
```

---

## 06_CRYPTO_AND_ZERO_KNOWLEDGE_DESIGN.md

```markdown
# Cryptography and Zero-Knowledge Design

## 1. Overview

The ELV's core value proposition is **zero-knowledge encryption**: the server stores encrypted blobs and cannot decrypt them. This document specifies the cryptographic architecture, key derivation, encryption schemes, and threat models.

---

## 2. Goals & Non-Goals

### Goals
1. **Confidentiality** – Server cannot read user's vault data
2. **Integrity** – Tampering with encrypted vault is detectable
3. **Authenticity** – User can verify vault has not been modified by third party
4. **Multi-device support** – User can access vault from multiple devices with same passphrase
5. **Forward secrecy** – Compromising one device does not compromise vault backups

### Non-Goals
1. **Perfect forward secrecy per session** – We prioritize simplicity over ephemeral keys
2. **Post-quantum cryptography** – Current algorithms (AES-256, SHA-256) are sufficient for MVP
3. **Hardware security modules (HSM)** – Overkill for target audience; WebCrypto is sufficient

---

## 3. Key Derivation

### 3.1. Passphrase-Based Key Derivation

**User Input:** Passphrase (e.g., "correct horse battery staple")

**Algorithm:** PBKDF2-HMAC-SHA256

**Parameters:**
- **Iterations:** 100,000 (OWASP recommended minimum as of 2024)
- **Salt:** `user_id` (32-byte UUID); ensures different users with same passphrase get different keys
- **Output:** 256-bit Master Key

**Pseudocode:**
```python
import hashlib

def derive_master_key(passphrase: str, user_id: str) -> bytes:
    salt = user_id.encode('utf-8')  # Use user ID as salt
    master_key = hashlib.pbkdf2_hmac(
        'sha256',               # Hash function
        passphrase.encode('utf-8'),  # Passphrase
        salt,                   # Salt
        100000,                 # Iterations
        dklen=32                # 256-bit key
    )
    return master_key
```

**Rationale:**
- **PBKDF2** is widely supported (WebCrypto API, Python, Node.js)
- **100k iterations** provides reasonable defense against brute-force (takes ~100ms on modern CPU)
- **User ID as salt** prevents rainbow table attacks; if user ID leaks, attacker still needs passphrase

**Alternative Considered:**
- **Argon2id** (stronger, memory-hard) – Not natively supported in WebCrypto; would require WASM library (adds complexity)

### 3.2. Passphrase Requirements

**Minimum Entropy:**
- **Length:** 20+ characters OR 4+ random words (Diceware-style)
- **Strength Meter:** Zxcvbn library to estimate crack time

**Enforced at Signup:**
```typescript
import zxcvbn from 'zxcvbn';

function validatePassphrase(passphrase: string): { valid: boolean; message: string } {
  const result = zxcvbn(passphrase);
  
  if (result.score < 3) {
    return { valid: false, message: "Passphrase is too weak. Use 4+ random words or 20+ characters." };
  }
  
  return { valid: true, message: "" };
}
```

**User Education:**
- "Your passphrase is the ONLY way to access your vault. We cannot recover it."
- "Use a passphrase manager (e.g., 1Password) to store your ELV passphrase."

---

## 4. Encryption Schemes

### 4.1. Field-Level Encryption (AES-256-GCM)

**Algorithm:** AES-256-GCM (Galois/Counter Mode)

**Rationale:**
- **AES-256** is industry standard (NIST FIPS 197)
- **GCM mode** provides both confidentiality and authenticity (AEAD: Authenticated Encryption with Associated Data)
- **Supported natively** in WebCrypto API

**Encryption Process:**
```typescript
async function encryptField(plaintext: string, masterKey: CryptoKey): Promise<EncryptedField> {
  // Generate random 96-bit IV (initialization vector)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt plaintext
  const plaintextBytes = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
      tagLength: 128  // 128-bit authentication tag
    },
    masterKey,
    plaintextBytes
  );
  
  return {
    encrypted_value: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv)
  };
}
```

**Decryption Process:**
```typescript
async function decryptField(encryptedField: EncryptedField, masterKey: CryptoKey): Promise<string> {
  const iv = base64ToArrayBuffer(encryptedField.iv);
  const ciphertext = base64ToArrayBuffer(encryptedField.encrypted_value);
  
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
        tagLength: 128
      },
      masterKey,
      ciphertext
    );
    
    return new TextDecoder().decode(plaintext);
  } catch (error) {
    throw new Error("Decryption failed: invalid key or tampered data");
  }
}
```

**Security Properties:**
- **IV uniqueness** – Random IV per field ensures no IV reuse (critical for GCM security)
- **Authentication** – GCM's authentication tag prevents tampering; modified ciphertext fails decryption
- **Performance** – GCM is fast (hardware-accelerated on modern CPUs)

---

### 4.2. Vault-Level Encryption (for S3 Sync)

**Problem:** Syncing vault to S3 requires serializing entire vault → single encrypted blob

**Approach:** Serialize vault as JSON, encrypt with AES-256-GCM, upload to S3

**Encryption Process:**
```typescript
async function encryptVault(vault: Vault, masterKey: CryptoKey): Promise<Uint8Array> {
  // Serialize vault to JSON
  const vaultJSON = JSON.stringify(vault);
  
  // Encrypt JSON
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintextBytes = new TextEncoder().encode(vaultJSON);
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv, tagLength: 128 },
    masterKey,
    plaintextBytes
  );
  
  // Prepend IV to ciphertext (first 12 bytes = IV, rest = ciphertext)
  const encryptedBlob = new Uint8Array(12 + ciphertext.byteLength);
  encryptedBlob.set(iv, 0);
  encryptedBlob.set(new Uint8Array(ciphertext), 12);
  
  return encryptedBlob;
}
```

**Decryption Process:**
```typescript
async function decryptVault(encryptedBlob: Uint8Array, masterKey: CryptoKey): Promise<Vault> {
  // Extract IV (first 12 bytes)
  const iv = encryptedBlob.slice(0, 12);
  const ciphertext = encryptedBlob.slice(12);
  
  // Decrypt
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv, tagLength: 128 },
    masterKey,
    ciphertext
  );
  
  // Deserialize JSON
  const vaultJSON = new TextDecoder().decode(plaintext);
  return JSON.parse(vaultJSON);
}
```

**S3 Upload:**
```typescript
async function syncVaultToS3(vault: Vault, masterKey: CryptoKey, userId: string) {
  // Encrypt vault
  const encryptedBlob = await encryptVault(vault, masterKey);
  
  // Request pre-signed S3 URL from backend
  const { uploadUrl } = await api.get(`/vault/blob/upload-url?user_id=${userId}`);
  
  // Upload to S3 via pre-signed URL
  await fetch(uploadUrl, {
    method: 'PUT',
    body: encryptedBlob,
    headers: {
      'Content-Type': 'application/octet-stream'
    }
  });
  
  // Notify backend of successful sync
  await api.post('/vault/metadata/sync', {
    synced_at: Date.now(),
    version: vault.version
  });
}
```

---

## 5. Key Management

### 5.1. Master Key Storage (Client-Side)

**Problem:** Deriving Master Key from passphrase on every operation is slow (100k iterations = ~100ms)

**Solution:** Cache derived Master Key in memory (extension background service worker)

**Implementation:**
```typescript
class KeyManager {
  private masterKey: CryptoKey | null = null;
  private keyExpiryTimeout: number | null = null;
  
  async deriveMasterKey(passphrase: string, userId: string): Promise<CryptoKey> {
    const salt = new TextEncoder().encode(userId);
    const passphraseBytes = new TextEncoder().encode(passphrase);
    
    // Derive key using PBKDF2
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      passphraseBytes,
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    
    this.masterKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256"
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,  // Not extractable (cannot export key)
      ["encrypt", "decrypt"]
    );
    
    // Auto-clear key after 30 minutes of inactivity
    this.resetKeyExpiry();
    
    return this.masterKey;
  }
  
  getMasterKey(): CryptoKey | null {
    return this.masterKey;
  }
  
  clearMasterKey() {
    this.masterKey = null;
    if (this.keyExpiryTimeout) {
      clearTimeout(this.keyExpiryTimeout);
    }
  }
  
  resetKeyExpiry() {
    if (this.keyExpiryTimeout) {
      clearTimeout(this.keyExpiryTimeout);
    }
    
    // Clear key after 30 minutes of inactivity
    this.keyExpiryTimeout = setTimeout(() => {
      this.clearMasterKey();
    }, 30 * 60 * 1000);
  }
}
```

**Security Considerations:**
- **In-memory only** – Master Key never written to disk
- **Auto-expiry** – Key cleared after 30 minutes of inactivity (requires re-entering passphrase)
- **Not extractable** – CryptoKey marked as non-extractable; cannot be exfiltrated via JavaScript

---

### 5.2. Passphrase Recovery (Optional Feature)

**Trade-off:** Pure zero-knowledge means no recovery; optional recovery sacrifices some privacy

**Approach:** Security Questions + Email Recovery Code

**Flow:**
1. **At Signup:** User opts into recovery; sets 3 security questions
2. **Backend stores:** `bcrypt(answer_1)`, `bcrypt(answer_2)`, `bcrypt(answer_3)`
3. **User forgets passphrase:** Answers security questions
4. **Backend verifies:** Compares hashed answers
5. **If match:** Backend sends recovery code to email
6. **User enters recovery code:** Gains access; MUST set new passphrase

**Implementation:**
```typescript
// At signup (optional)
async function setupRecovery(userId: string, answers: string[]) {
  const hashedAnswers = await Promise.all(
    answers.map(answer => bcrypt.hash(answer.toLowerCase(), 10))
  );
  
  await db.insert('recovery_settings', {
    user_id: userId,
    hashed_answer_1: hashedAnswers[0],
    hashed_answer_2: hashedAnswers[1],
    hashed_answer_3: hashedAnswers[2]
  });
}

// Recovery flow
async function initiateRecovery(userId: string, answers: string[]): Promise<boolean> {
  const settings = await db.query('recovery_settings', { user_id: userId });
  
  // Verify all answers
  const match1 = await bcrypt.compare(answers[0].toLowerCase(), settings.hashed_answer_1);
  const match2 = await bcrypt.compare(answers[1].toLowerCase(), settings.hashed_answer_2);
  const match3 = await bcrypt.compare(answers[2].toLowerCase(), settings.hashed_answer_3);
  
  if (match1 && match2 && match3) {
    // Generate recovery code
    const code = crypto.randomBytes(16).toString('hex');
    
    // Email code to user
    await sendEmail(user.email, `Recovery code: ${code}`);
    
    // Store code (expires in 1 hour)
    await db.insert('recovery_codes', {
      user_id: userId,
      code: await bcrypt.hash(code, 10),
      expires_at: Date.now() + 3600000
    });
    
    return true;
  }
  
  return false;
}
```

**Security Properties:**
- **Bcrypt hashing** – Slow hash prevents brute-force on answers
- **Email delivery** – Recovery code sent out-of-band (not in browser)
- **Time-limited** – Code expires in 1 hour
- **Clearly flagged** – UI warns: "Recovery reduces zero-knowledge guarantee"

---

## 6. Threat Model

### 6.1. Threat Actors

| Actor | Capability | Motivation |
|-------|-----------|------------|
| **Curious Admin** | Database read access | Snooping on user data |
| **Attacker (remote)** | SQL injection, XSS, CSRF | Steal user data, inject malicious code |
| **Attacker (physical)** | Stolen device with unlocked extension | Access vault |
| **Malicious Extension** | Inject code into extension | Exfiltrate Master Key |
| **Nation-State** | Man-in-the-middle, traffic analysis | Decrypt vault backups |

---

### 6.2. Threat Analysis

#### Threat 1: Curious Admin Reads Database

**Scenario:** Backend admin queries database, sees encrypted vault blobs

**Mitigation:**
- **Zero-knowledge guarantee** – Admin sees encrypted blobs only; cannot decrypt without user's passphrase
- **Audit logs** – All database queries logged; unusual access patterns flagged

**Residual Risk:**
- Admin could steal encrypted blobs and attempt offline brute-force
- **Defense:** Require strong passphrases (4+ words, 20+ chars); PBKDF2 100k iterations slows brute-force

---

#### Threat 2: SQL Injection Attack

**Scenario:** Attacker injects SQL to extract user data

**Mitigation:**
- **Parameterized queries** – All SQL uses prepared statements (SQLAlchemy, Prisma)
- **Least privilege** – Database user has read/write access only to required tables
- **Web Application Firewall (WAF)** – CloudFlare or AWS WAF blocks common SQL injection patterns

**Residual Risk:**
- Even if attacker extracts encrypted blobs, cannot decrypt without passphrase

---

#### Threat 3: XSS Attack (Inject Malicious Script)

**Scenario:** Attacker injects JavaScript to steal Master Key from extension

**Mitigation:**
- **Content Security Policy (CSP)** – Strict CSP headers prevent inline scripts
- **Input sanitization** – All user inputs sanitized (e.g., template names, field labels)
- **Extension isolation** – Extension runs in separate context from web pages

**Example CSP Header:**
```
Content-Security-Policy: 
  default-src 'self'; 
  script-src 'self' 'unsafe-inline'; 
  object-src 'none'; 
  base-uri 'self'; 
  form-action 'self';
```

---

#### Threat 4: Stolen Device

**Scenario:** Attacker steals laptop with unlocked extension

**Mitigation:**
- **Key expiry** – Master Key auto-clears after 30 minutes of inactivity
- **Device revocation** – User can revoke stolen device from another device (requires re-authentication)

**Residual Risk:**
- If device is stolen within 30-minute window, attacker has access
- **User responsibility:** Enable OS-level full-disk encryption (FileVault, BitLocker)

---

#### Threat 5: Man-in-the-Middle (MITM)

**Scenario:** Attacker intercepts HTTPS traffic, downgrades to HTTP

**Mitigation:**
- **HSTS (HTTP Strict Transport Security)** – Forces HTTPS; prevents downgrade attacks
- **Certificate pinning** – Extension validates server certificate matches expected public key

**Example HSTS Header:**
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

---

#### Threat 6: Compromised Extension (Malicious Update)

**Scenario:** Attacker compromises Chrome Web Store account, pushes malicious extension update

**Mitigation:**
- **Chrome Web Store review** – Manual review of extension updates
- **Subresource Integrity (SRI)** – All external scripts loaded with SRI hashes
- **Minimal permissions** – Extension requests only necessary permissions

**Residual Risk:**
- If attacker gains access to developer account, could push malicious update
- **Defense:** Two-factor authentication (2FA) on developer account; code signing

---

## 7. Auditing & Compliance

### 7.1. Security Audit (Recommended)

**Scope:**
- Cryptographic implementation (key derivation, encryption, decryption)
- Threat model validation
- Extension permissions review

**Auditors:**
- NCC Group, Trail of Bits, or Cure53 (reputable security firms)

**Cost:** $15k–$50k for initial audit

---

### 7.2. Transparency Report

**Publish annually:**
- Number of users
- Number of vault blobs stored (without user identities)
- Number of law enforcement requests received (should be zero; we cannot decrypt)
- Security incidents (if any)

**Example:**
```
## 2025 Transparency Report

- **Total Users:** 1,250
- **Encrypted Vaults Stored:** 1,250
- **Law Enforcement Requests:** 0 (we cannot decrypt user data)
- **Security Incidents:** 0
- **Third-Party Security Audits:** 1 (NCC Group, February 2025)
```

---

## 8. Performance Considerations

### 8.1. PBKDF2 Iteration Count

**Trade-off:** Higher iterations = slower key derivation = better security

**Benchmark:**
- **100k iterations:** ~100ms on modern CPU (M1 MacBook Pro)
- **1M iterations:** ~1s (too slow for user experience)

**Recommendation:** 100k for MVP; increase to 200k in Year 2

---

### 8.2. Vault Sync Latency

**Scenario:** User syncs 500-field vault (each field ~50 bytes encrypted) = ~25 KB encrypted blob

**Upload Time:**
- **Network:** 25 KB over broadband (~1 Mbps upload) = ~200ms
- **Encryption:** AES-GCM on 25 KB = <10ms
- **Total:** ~300ms (acceptable)

**Optimization:**
- Compress vault JSON before encryption (gzip): ~25 KB → ~10 KB (saves 60% bandwidth)

---

## 9. Open Questions

| Question | Options | Recommendation |
|----------|---------|----------------|
| **Use Argon2id instead of PBKDF2?** | Yes (stronger, memory-hard) | No (requires WASM, adds complexity; revisit in Year 2) |
| **Support hardware keys (YubiKey)?** | Yes (WebAuthn) | Year 2 feature; too complex for MVP |
| **End-to-end encryption for vault sharing?** | Yes (Diffie-Hellman for shared key) | Year 2 feature; multi-user vaults out of scope for MVP |
| **Client-side backups (local file)?** | Yes (encrypted export) | Yes; implement as "Export Vault" feature |

---

## 10. Conclusion

This cryptographic design achieves zero-knowledge guarantees while maintaining usability:
- **Strong encryption** – AES-256-GCM with random IVs
- **Key derivation** – PBKDF2-HMAC-SHA256 (100k iterations)
- **Multi-device support** – Passphrase-based key derivation ensures same key across devices
- **Threat mitigation** – CSP, HSTS, key expiry, device revocation

**Critical Path for MVP:**
1. Implement PBKDF2 key derivation in extension
2. Encrypt/decrypt fields using WebCrypto API
3. Vault-level encryption for S3 sync
4. CSP headers + HSTS on web app

**Future Enhancements (Year 2):**
- Argon2id key derivation (stronger)
- Hardware key support (WebAuthn)
- Vault sharing (multi-user encryption)
```

---

*Continuing with documents 07-14 in next response due to length...*