# ENCRYPTED LEGAL VAULT (ELV) - PLANNING DOCUMENTATION (PART 2)

## Continuation from Part 1

This document continues the comprehensive planning suite for the Encrypted Legal Vault platform, picking up with documents 04 through 14.

---

## 04_SYSTEM_ARCHITECTURE.md (CONTINUED)

### 3. Component Specifications

#### 3.1. Web Application

**Technology Stack:**
- **Frontend:** Vue.js 3 or React 18 (TypeScript)
- **State Management:** Pinia (Vue) or Zustand (React)
- **Routing:** Vue Router or React Router
- **UI Framework:** Tailwind CSS + Headless UI
- **Build:** Vite
- **Hosting:** Vercel or Cloudflare Pages (static + edge functions)

**Key Features:**
1. User registration (email + passphrase-based authentication)
2. Template marketplace (browse, search, purchase)
3. Entitlements dashboard (active subscriptions, purchase history)
4. Account settings (passphrase change, export encrypted vault)
5. Analytics dashboard (metadata-only: completion %, document usage)

**Security Requirements:**
- HTTPS only (TLS 1.3+)
- Content Security Policy headers
- CSRF tokens on all state-changing operations
- Rate limiting on auth endpoints (10 attempts/hour)

#### 3.2. Browser Extension (Manifest V3)

**Technology Stack:**
- **Platform:** Chrome Extensions Manifest V3 (compatible with Edge, Brave)
- **Language:** TypeScript
- **Crypto:** WebCrypto API (native browser encryption)
- **DOCX Processing:** docxtemplater.js + PizZip
- **Storage:** IndexedDB (via Dexie.js)
- **Build:** Webpack or Rollup

**Extension Components:**

**Background Service Worker:**
- Manages vault sync with S3
- Handles encrypted blob uploads/downloads
- Coordinates between popup UI and content scripts
- Implements periodic sync (configurable: hourly, daily, manual)

**Popup UI:**
- Quick vault access (search fields, view recent documents)
- Trigger manual sync
- Open full web app dashboard

**Content Scripts (Injected into web pages):**
- Detect form fields on external sites
- Offer auto-fill from vault (user-initiated)
- Map vault fields to detected form fields

**Permissions Required:**
- `storage` (local IndexedDB)
- `tabs` (detect active tab for form injection)
- `identity` (optional: Chrome Identity API for OAuth)
- `downloads` (save merged DOCX files)
- NO `<all_urls>` or blanket access (minimize attack surface)

#### 3.3. Backend Services

**Technology Stack:**
- **Language:** Python 3.11+
- **Framework:** FastAPI
- **Database:** PostgreSQL 15+ (via SQLAlchemy ORM)
- **Caching:** Redis (session state, rate limiting)
- **Task Queue:** Celery + Redis (async job processing)
- **Hosting:** AWS ECS Fargate or Fly.io
- **CDN:** Cloudflare (template delivery)

**Services Architecture:**

```
┌─────────────────────┐
│   API Gateway       │
│  (FastAPI + Auth)   │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │           │
┌────▼────┐ ┌───▼────┐
│  Auth   │ │Catalog │
│ Service │ │Service │
└─────────┘ └────────┘
     │           │
┌────▼────┐ ┌───▼─────┐
│Payment  │ │Analytics│
│ Service │ │ Service │
└─────────┘ └─────────┘
```

**Auth Service:**
- User registration with passphrase-based key derivation (PBKDF2)
- Device key generation (for multi-device sync)
- Session management (JWT tokens, 7-day expiry)
- Passphrase verification (no plaintext passphrase storage)

**Catalog Service:**
- Template CRUD (upload new templates, version management)
- Field schema management (defines which fields each template requires)
- Recommendation engine (metadata-only analysis)

**Payment Service:**
- Stripe Checkout integration
- Webhook handling (payment success, subscription events)
- Entitlement state machine (pending → active → expired → revoked)

**Analytics Service:**
- Metadata-only aggregation (no content logging)
- Track: template popularity, field completion rates, user retention
- Export for business intelligence

#### 3.4. Storage Layer

**Database Schema (PostgreSQL):**

```sql
-- Users (no passphrase stored; only derived key salt)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    salt BYTEA NOT NULL, -- for PBKDF2
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Devices (for multi-device sync)
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_fingerprint VARCHAR(255) NOT NULL,
    encrypted_device_key BYTEA NOT NULL, -- encrypted with user's master key
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Templates (versioned)
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version INT DEFAULT 1,
    price_cents INT, -- NULL = free; otherwise one-time price
    category VARCHAR(100), -- e.g., "NDA", "Lease", "Corporate"
    docx_url TEXT NOT NULL, -- S3 URL to DOCX template
    field_schema JSONB NOT NULL, -- defines required fields
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Entitlements (purchases + subscriptions)
CREATE TABLE entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
    entitlement_type VARCHAR(50), -- 'one_time', 'subscription', 'bundle'
    status VARCHAR(50), -- 'pending', 'active', 'expired', 'revoked'
    stripe_payment_intent_id VARCHAR(255),
    purchased_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ, -- NULL for one-time; set for subscriptions
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Encrypted Vault Backups (blobs)
CREATE TABLE vault_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    s3_key TEXT NOT NULL, -- S3 object key
    encrypted_size_bytes BIGINT,
    backup_version INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Metadata Events (for recommendations + analytics)
CREATE TABLE metadata_events (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(100), -- 'field_filled', 'template_generated', 'template_viewed'
    field_id VARCHAR(255), -- e.g., "field_402_commercial_address"
    template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

**Encrypted Blob Storage (S3):**
- Bucket: `elv-vault-backups` (private, versioned, lifecycle policy: 90 days retention)
- Object naming: `{user_id}/{backup_version}.blob`
- Encryption: Client-side only (S3 stores ciphertext; ELV backend cannot decrypt)
- Access: Backend generates pre-signed URLs (5-minute expiry) for extension to upload/download

**Template Distribution (CDN):**
- Bucket: `elv-templates` (public-read)
- CloudFlare CDN for low-latency global distribution
- Immutable template URLs (versioned: `templates/v2/{template_id}.docx`)

### 4. Data Flow: End-to-End Document Generation

**Step 1: User Purchases Template**
1. User browses marketplace on Web App
2. Clicks "Buy Template" → redirected to Stripe Checkout
3. Stripe processes payment → webhook to Backend
4. Backend creates entitlement record (status: 'active')
5. User redirected back to Web App with success message

**Step 2: Extension Downloads Template**
1. Extension checks entitlements via Backend API
2. Backend returns list of unlocked template URLs
3. Extension downloads DOCX from CDN (cached locally in IndexedDB)

**Step 3: Interview + Vault Population**
1. User clicks "Generate Document" in extension
2. Extension parses template field schema (e.g., requires: "Entity Name", "Address", "EIN")
3. Extension displays interview UI: "What is your Entity Name?"
4. User enters values; extension encrypts each field using user's master key (derived from passphrase)
5. Encrypted field stored in IndexedDB

**Step 4: Document Merge (Client-Side)**
1. Extension loads DOCX template from IndexedDB
2. Extension decrypts vault fields
3. Extension uses docxtemplater.js to replace `{{Entity_Name}}` placeholders with decrypted values
4. Extension generates final DOCX (no plaintext leaves device)
5. User downloads completed DOCX

**Step 5: Vault Sync (Optional)**
1. User clicks "Sync Vault" or automatic sync triggered
2. Extension encrypts entire vault (all fields) with user's master key
3. Extension requests pre-signed S3 URL from Backend
4. Extension uploads encrypted blob to S3
5. Backend records backup metadata (size, timestamp) in database

**Step 6: Metadata Reporting (Privacy-Preserving)**
1. Extension reports to Backend: "User filled field_id: 402" (no content)
2. Backend stores metadata event
3. Recommendation engine uses metadata to suggest: "Users who filled field 402 often use Template X"

### 5. Security Architecture

**Threat Model Summary (Full details in Document 11):**

| Threat | Mitigation |
|--------|------------|
| Attacker compromises Backend servers | Cannot decrypt vault; only ciphertext stored |
| Attacker steals user's device | Vault encrypted at rest; requires passphrase to unlock |
| Phishing attack (user enters passphrase on fake site) | Extension validates domain; educate users on official domain |
| Extension malware (compromised extension update) | Code signing + Chrome Web Store review; open-source for audit |
| Network MITM attack | All communication over TLS 1.3; certificate pinning |

**Key Management:**
1. **User Master Key:** Derived from passphrase via PBKDF2 (600,000 iterations, random salt)
2. **Device Key:** Generated per device; encrypted with user's master key; stored on Backend
3. **Field-Level Encryption:** Each field value encrypted with AES-256-GCM (authenticated encryption)
4. **Backup Encryption:** Entire vault encrypted as single blob before S3 upload

---

## 05_DATA_MODEL_AND_METADATA_SCHEMA.md

### 1. Overview

The ELV uses a dual-layer data model:
1. **Plaintext Metadata** (stored on server) – Field IDs, relationships, completion status
2. **Encrypted Content** (client-only) – Actual field values (e.g., "Acme Corp", "123-45-6789")

This separation enables privacy-preserving recommendations without exposing sensitive content.

### 2. Field Schema Definition

**Field Structure:**

```json
{
  "field_id": "field_402_commercial_address",
  "field_name": "Commercial Address",
  "field_type": "text",
  "required": true,
  "data_category": "entity_info",
  "related_fields": ["field_401_entity_name", "field_403_city"],
  "validation": {
    "min_length": 5,
    "max_length": 200,
    "pattern": "^[A-Za-z0-9\\s,.-]+$"
  }
}
```

**Field Types:**
- `text`: Free-form text (e.g., entity name, address)
- `ssn`: Social Security Number (validated format: XXX-XX-XXXX)
- `ein`: Employer Identification Number (XX-XXXXXXX)
- `date`: ISO 8601 date (YYYY-MM-DD)
- `email`: RFC 5322 email address
- `phone`: E.164 phone number (+1XXXXXXXXXX)
- `select`: Dropdown (predefined options, e.g., state names)
- `multiselect`: Multiple selections (e.g., "Board Members")
- `currency`: Monetary amount (stored as cents, integer)
- `percentage`: Decimal percentage (0.00 to 100.00)

**Data Categories (for recommendations):**
- `entity_info`: Business entity data (name, EIN, address)
- `owner_info`: Owner/founder personal data
- `property_info`: Real estate data
- `financial_info`: Bank accounts, revenue, valuation
- `legal_info`: Attorneys, filings, jurisdiction
- `client_info`: Customer/client data (HIPAA-sensitive)

### 3. Template Field Schema

Each DOCX template includes a companion JSON schema defining required fields:

**Example: NDA Template Schema**

```json
{
  "template_id": "tpl_nda_001",
  "template_name": "Mutual Non-Disclosure Agreement",
  "version": 2,
  "required_fields": [
    {
      "field_id": "field_101_party_a_name",
      "field_name": "Party A (Disclosing Party) Name",
      "field_type": "text",
      "data_category": "entity_info"
    },
    {
      "field_id": "field_102_party_a_address",
      "field_name": "Party A Address",
      "field_type": "text",
      "data_category": "entity_info"
    },
    {
      "field_id": "field_201_party_b_name",
      "field_name": "Party B (Receiving Party) Name",
      "field_type": "text",
      "data_category": "entity_info"
    },
    {
      "field_id": "field_301_effective_date",
      "field_name": "Effective Date",
      "field_type": "date",
      "data_category": "legal_info"
    },
    {
      "field_id": "field_302_term_months",
      "field_name": "Term (Months)",
      "field_type": "text",
      "data_category": "legal_info",
      "validation": {"pattern": "^[0-9]+$"}
    }
  ],
  "optional_fields": [
    {
      "field_id": "field_401_governing_law_state",
      "field_name": "Governing Law (State)",
      "field_type": "select",
      "options": ["California", "Delaware", "New York", "Texas"]
    }
  ]
}
```

**DOCX Placeholder Convention:**
- Use `{{field_id}}` syntax (e.g., `{{field_101_party_a_name}}`)
- Conditional blocks: `{%if field_401_governing_law_state == "California"%} ... {%endif%}`

### 4. Vault Data Model (Client-Side)

**Encrypted Vault Structure (IndexedDB):**

```typescript
interface VaultField {
  field_id: string;           // e.g., "field_402_commercial_address"
  encrypted_value: string;    // Base64-encoded ciphertext
  field_type: string;         // e.g., "text", "ssn"
  data_category: string;      // e.g., "entity_info"
  last_updated: Date;
  version: number;            // for conflict resolution
}

interface VaultMetadata {
  vault_id: string;           // UUID
  user_id: string;
  created_at: Date;
  last_synced_at: Date | null;
  total_fields: number;       // count of stored fields
  completion_percentage: number; // estimated based on common template needs
}
```

**IndexedDB Schema (Dexie.js):**

```typescript
const db = new Dexie("ELV_Vault");
db.version(1).stores({
  fields: 'field_id, data_category, last_updated',
  templates: 'template_id, cached_at',
  metadata: 'vault_id'
});
```

### 5. Metadata Events (Server-Side Analytics)

**Event Types:**

| Event Type | Description | Metadata Captured |
|------------|-------------|-------------------|
| `field_filled` | User fills a vault field | `field_id`, `data_category`, `timestamp` |
| `template_viewed` | User opens template in marketplace | `template_id`, `timestamp` |
| `template_generated` | User generates document | `template_id`, `field_ids_used`, `timestamp` |
| `vault_synced` | User syncs vault to cloud | `backup_version`, `num_fields`, `timestamp` |
| `recommendation_shown` | Recommendation displayed | `template_id`, `confidence_score`, `timestamp` |
| `recommendation_clicked` | User clicks recommendation | `template_id`, `timestamp` |

**Privacy Guarantee:** No field *values* are logged; only field *IDs* (e.g., "User filled field_402" but not "User filled 'Acme Corp'").

### 6. Recommendation Metadata Graph

**Graph Structure:**

```
User
├── Filled Fields: [field_402, field_403, field_404]
├── Generated Templates: [tpl_nda_001, tpl_lease_002]
└── Potential Matches:
    ├── tpl_corp_bylaws_003 (confidence: 0.85, reason: "Users with field_402 often use this")
    └── tpl_operating_agreement_005 (confidence: 0.72, reason: "Commonly paired with tpl_nda_001")
```

**Recommendation Algorithm (Pseudocode):**

```python
def recommend_templates(user_vault_fields: List[str], user_history: List[str]) -> List[Tuple[str, float]]:
    """
    Recommend templates based on metadata only.
    
    Args:
        user_vault_fields: List of field IDs user has filled
        user_history: List of template IDs user has already generated
    
    Returns:
        List of (template_id, confidence_score) tuples
    """
    recommendations = []
    
    # Query: Find templates that use many of the user's filled fields
    for template in all_templates:
        required_fields = template.required_fields
        filled_count = len(set(user_vault_fields) & set(required_fields))
        total_required = len(required_fields)
        
        if filled_count / total_required > 0.6:  # 60%+ fields filled
            confidence = filled_count / total_required
            
            # Boost if commonly co-purchased with user's history
            if template.id in get_co_purchased_templates(user_history):
                confidence *= 1.2
            
            recommendations.append((template.id, confidence))
    
    # Sort by confidence, exclude already-generated templates
    recommendations = [(t, c) for t, c in recommendations if t not in user_history]
    recommendations.sort(key=lambda x: x[1], reverse=True)
    
    return recommendations[:5]  # Top 5
```

---

## 06_CRYPTO_AND_ZERO_KNOWLEDGE_DESIGN.md

### 1. Cryptographic Requirements

**Goals:**
1. **Zero-Knowledge:** Server cannot decrypt user vault (no master key stored on server)
2. **Authentication:** Prove user identity without storing passphrase
3. **Multi-Device Sync:** Allow vault access from multiple devices
4. **Recovery:** Optional passphrase recovery mechanism (with security tradeoff)

### 2. Key Derivation (Passphrase → Master Key)

**Algorithm:** PBKDF2 (Password-Based Key Derivation Function 2)

**Parameters:**
- **Hash Function:** SHA-256
- **Iterations:** 600,000 (OWASP recommendation as of 2024)
- **Salt:** 32-byte random salt (generated at registration, stored in database)
- **Output:** 256-bit master key

**Derivation Flow:**

```typescript
async function deriveMasterKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  
  const masterKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 600000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true, // extractable (for device key encryption)
    ["encrypt", "decrypt"]
  );
  
  return masterKey;
}
```

**Security Rationale:**
- 600K iterations makes brute-force attacks expensive (≈0.5 seconds on modern CPU)
- Salt prevents rainbow table attacks
- WebCrypto API ensures browser-native, hardware-accelerated crypto

### 3. Field-Level Encryption

**Algorithm:** AES-256-GCM (Galois/Counter Mode)

**Why GCM?**
- Authenticated encryption (prevents tampering)
- NIST-approved
- Hardware-accelerated on modern CPUs

**Encryption Flow:**

```typescript
async function encryptField(plaintext: string, masterKey: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // Generate random IV (96 bits for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    masterKey,
    data
  );
  
  // Prepend IV to ciphertext (needed for decryption)
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  
  // Return Base64-encoded
  return btoa(String.fromCharCode(...combined));
}
```

**Decryption Flow:**

```typescript
async function decryptField(ciphertext: string, masterKey: CryptoKey): Promise<string> {
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  
  // Extract IV and ciphertext
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    masterKey,
    data
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(plaintext);
}
```

**Key Points:**
- Each field encrypted independently (field compromise doesn't expose others)
- IV (nonce) generated randomly per encryption (prevents replay attacks)
- GCM authentication tag (last 16 bytes) validates integrity

### 4. Multi-Device Sync: Device Keys

**Challenge:** User has multiple devices (laptop, phone); vault must sync without exposing master key to server.

**Solution:** Device-specific keys

**Flow:**

**Device Registration:**
1. User logs in on new device with passphrase
2. Extension derives master key from passphrase (client-side)
3. Extension generates random device key (256-bit AES key)
4. Extension encrypts device key with master key
5. Extension uploads encrypted device key to server (associated with device fingerprint)

**Vault Sync from Device A to Device B:**
1. Device A encrypts vault blob with master key
2. Device A uploads encrypted blob to S3
3. Device B downloads encrypted blob
4. Device B decrypts blob using its master key (derived from passphrase)

**Code:**

```typescript
async function registerDevice(masterKey: CryptoKey, deviceFingerprint: string): Promise<void> {
  // Generate random device key
  const deviceKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true, // extractable
    ["encrypt", "decrypt"]
  );
  
  // Encrypt device key with master key
  const exportedDeviceKey = await crypto.subtle.exportKey("raw", deviceKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedDeviceKey = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    masterKey,
    exportedDeviceKey
  );
  
  // Send to backend
  await fetch("/api/devices/register", {
    method: "POST",
    body: JSON.stringify({
      device_fingerprint: deviceFingerprint,
      encrypted_device_key: btoa(String.fromCharCode(...new Uint8Array(encryptedDeviceKey))),
      iv: btoa(String.fromCharCode(...iv))
    })
  });
}
```

### 5. Authentication Without Storing Passphrase

**Challenge:** Backend needs to verify user identity without storing passphrase.

**Solution:** Store salt + verify derived key hash

**Registration:**
1. User creates account with email + passphrase
2. Backend generates random salt
3. Client derives master key (PBKDF2)
4. Client hashes master key (SHA-256) and sends hash to backend
5. Backend stores: email, salt, key_hash

**Login:**
1. User enters passphrase
2. Client fetches salt from backend
3. Client derives master key (PBKDF2)
4. Client hashes master key
5. Client sends hash to backend
6. Backend compares hash; if match, issue JWT token

**Code:**

```typescript
async function login(email: string, passphrase: string): Promise<string> {
  // Fetch salt
  const { salt } = await fetch(`/api/auth/salt?email=${email}`).then(r => r.json());
  
  // Derive master key
  const saltBytes = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
  const masterKey = await deriveMasterKey(passphrase, saltBytes);
  
  // Hash master key for authentication
  const keyBuffer = await crypto.subtle.exportKey("raw", masterKey);
  const keyHash = await crypto.subtle.digest("SHA-256", keyBuffer);
  const keyHashBase64 = btoa(String.fromCharCode(...new Uint8Array(keyHash)));
  
  // Send to backend
  const { jwt } = await fetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, key_hash: keyHashBase64 })
  }).then(r => r.json());
  
  return jwt;
}
```

**Security Properties:**
- Backend never sees passphrase
- Backend stores only hash of derived key (one-way function)
- Even if database compromised, attacker must brute-force PBKDF2 (expensive)

### 6. Optional Passphrase Recovery

**Tradeoff:** Zero-knowledge means no account recovery. For UX, offer opt-in recovery.

**Mechanism:** Security questions + email verification

**Flow:**
1. User opts in to recovery during registration
2. User answers 3 security questions (e.g., "Mother's maiden name?")
3. Client encrypts master key with hash(security_answers)
4. Client uploads encrypted recovery key to backend
5. If user forgets passphrase:
   - User answers security questions
   - Client derives recovery key from answers
   - Client decrypts master key from backend
   - Client re-derives master key and logs in

**Code:**

```typescript
async function setupRecovery(masterKey: CryptoKey, answers: string[]): Promise<void> {
  // Hash answers to create recovery key
  const combinedAnswers = answers.join("|").toLowerCase();
  const encoder = new TextEncoder();
  const recoveryKeyBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(combinedAnswers));
  
  const recoveryKey = await crypto.subtle.importKey(
    "raw",
    recoveryKeyBuffer,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  
  // Encrypt master key with recovery key
  const exportedMasterKey = await crypto.subtle.exportKey("raw", masterKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedMasterKey = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    recoveryKey,
    exportedMasterKey
  );
  
  // Upload to backend
  await fetch("/api/auth/recovery", {
    method: "POST",
    body: JSON.stringify({
      encrypted_master_key: btoa(String.fromCharCode(...new Uint8Array(encryptedMasterKey))),
      iv: btoa(String.fromCharCode(...iv))
    })
  });
}
```

**Security Note:** This weakens zero-knowledge (backend can brute-force answers). Clearly disclose this tradeoff in UI.

### 7. Threat Model & Mitigations

| Threat | Impact | Mitigation |
|--------|--------|------------|
| **Backend compromise** | Attacker gets encrypted blobs + metadata | Cannot decrypt (no master key); only metadata leaked |
| **Device theft** | Attacker gets device with vault | Vault encrypted at rest; requires passphrase |
| **Phishing (fake login page)** | User enters passphrase on attacker site | Extension validates domain; educate users |
| **Extension malware** | Compromised extension update | Code signing; open-source for audit; Chrome Web Store review |
| **MITM attack** | Attacker intercepts network traffic | TLS 1.3; certificate pinning (optional) |
| **Weak passphrase** | Brute-force attack | Enforce passphrase strength (min 12 chars, zxcvbn score >3) |
| **Side-channel (timing attack)** | Attacker infers passphrase from timing | Constant-time comparison (WebCrypto handles this) |

---

## 07_EXTENSION_DESIGN_MV3.md

### 1. Manifest V3 Overview

Chrome Extensions Manifest V3 is the current standard (MV2 deprecated Jan 2024). Key changes:
- Background pages → Service workers (ephemeral, event-driven)
- `executeScript` → scripting API
- Host permissions more granular
- Promises-based APIs (async/await)

### 2. Extension File Structure

```
/extension
├── manifest.json
├── background.js          (Service worker)
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── content/
│   ├── content.js         (Injected into web pages)
│   └── content.css
├── lib/
│   ├── crypto.js          (WebCrypto wrappers)
│   ├── docx-merge.js      (docxtemplater integration)
│   └── vault.js           (IndexedDB CRUD)
└── assets/
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

### 3. manifest.json

```json
{
  "manifest_version": 3,
  "name": "Encrypted Legal Vault",
  "version": "1.0.0",
  "description": "Zero-knowledge document auto-fill from encrypted vault",
  "permissions": [
    "storage",
    "tabs",
    "downloads",
    "identity"
  ],
  "host_permissions": [
    "https://app.elv.example.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "assets/icon-16.png",
      "48": "assets/icon-48.png",
      "128": "assets/icon-128.png"
    }
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/content.js"],
      "css": ["content/content.css"],
      "run_at": "document_idle"
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["assets/*"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

### 4. Background Service Worker (background.js)

**Responsibilities:**
- Handle vault sync (periodic or user-triggered)
- Coordinate between popup, content scripts, and backend API
- Manage authentication state (JWT token storage)

**Code:**

```javascript
// Listen for extension install/update
chrome.runtime.onInstalled.addListener(async () => {
  console.log("ELV Extension installed");
  
  // Initialize vault if not exists
  const { vault_initialized } = await chrome.storage.local.get("vault_initialized");
  if (!vault_initialized) {
    await chrome.storage.local.set({ vault_initialized: true, last_sync: null });
  }
});

// Listen for messages from popup/content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "sync_vault") {
    syncVault().then(sendResponse);
    return true; // Async response
  }
  
  if (request.action === "get_vault_field") {
    getVaultField(request.field_id).then(sendResponse);
    return true;
  }
});

// Vault sync function
async function syncVault() {
  try {
    // Get JWT token
    const { jwt } = await chrome.storage.local.get("jwt");
    if (!jwt) throw new Error("Not authenticated");
    
    // Export encrypted vault from IndexedDB
    const vault = await exportVault();
    
    // Request pre-signed S3 URL from backend
    const response = await fetch("https://api.elv.example.com/vault/upload-url", {
      headers: { Authorization: `Bearer ${jwt}` }
    });
    const { upload_url } = await response.json();
    
    // Upload encrypted vault to S3
    await fetch(upload_url, {
      method: "PUT",
      body: vault,
      headers: { "Content-Type": "application/octet-stream" }
    });
    
    // Update last sync timestamp
    await chrome.storage.local.set({ last_sync: new Date().toISOString() });
    
    return { success: true };
  } catch (error) {
    console.error("Vault sync failed:", error);
    return { success: false, error: error.message };
  }
}

// Export vault as encrypted blob
async function exportVault() {
  // Open IndexedDB
  const db = await openVaultDB();
  const fields = await db.getAll("fields");
  
  // Serialize + encrypt
  const masterKey = await getMasterKey();
  const plaintext = JSON.stringify(fields);
  const encrypted = await encryptField(plaintext, masterKey);
  
  return new Blob([encrypted], { type: "application/octet-stream" });
}
```

### 5. Popup UI (popup.html + popup.js)

**Purpose:** Quick vault access, manual sync, navigate to full web app

**popup.html:**

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="container">
    <h2>Encrypted Legal Vault</h2>
    
    <div class="stats">
      <p><strong>Fields Stored:</strong> <span id="field-count">0</span></p>
      <p><strong>Last Sync:</strong> <span id="last-sync">Never</span></p>
    </div>
    
    <button id="sync-btn">Sync Now</button>
    <button id="open-app">Open Vault Dashboard</button>
  </div>
  
  <script src="popup.js"></script>
</body>
</html>
```

**popup.js:**

```javascript
document.addEventListener("DOMContentLoaded", async () => {
  // Load stats
  const { field_count, last_sync } = await chrome.storage.local.get(["field_count", "last_sync"]);
  document.getElementById("field-count").textContent = field_count || 0;
  document.getElementById("last-sync").textContent = last_sync || "Never";
  
  // Sync button
  document.getElementById("sync-btn").addEventListener("click", async () => {
    const btn = document.getElementById("sync-btn");
    btn.disabled = true;
    btn.textContent = "Syncing...";
    
    const result = await chrome.runtime.sendMessage({ action: "sync_vault" });
    
    if (result.success) {
      alert("Vault synced successfully!");
      location.reload();
    } else {
      alert(`Sync failed: ${result.error}`);
    }
    
    btn.disabled = false;
    btn.textContent = "Sync Now";
  });
  
  // Open app button
  document.getElementById("open-app").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://app.elv.example.com" });
  });
});
```

### 6. Content Script (content.js)

**Purpose:** Detect form fields on external websites; offer auto-fill from vault

**content.js:**

```javascript
// Detect input fields on page
function detectFormFields() {
  const inputs = document.querySelectorAll('input[type="text"], input[type="email"], textarea');
  const fields = [];
  
  inputs.forEach(input => {
    const label = getFieldLabel(input);
    fields.push({
      element: input,
      label: label,
      name: input.name || input.id
    });
  });
  
  return fields;
}

// Get label for input field
function getFieldLabel(input) {
  // Try associated <label>
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) return label.textContent.trim();
  }
  
  // Try placeholder
  if (input.placeholder) return input.placeholder;
  
  // Fallback to name/id
  return input.name || input.id || "Unknown";
}

// Show auto-fill button next to detected fields
function showAutoFillUI(fields) {
  fields.forEach(field => {
    const btn = document.createElement("button");
    btn.textContent = "🔒 Fill from Vault";
    btn.className = "elv-autofill-btn";
    btn.onclick = () => autoFillField(field);
    
    field.element.parentNode.insertBefore(btn, field.element.nextSibling);
  });
}

// Auto-fill field from vault
async function autoFillField(field) {
  // Ask user to map field to vault field
  const vaultFieldId = await promptUserForMapping(field.label);
  
  if (!vaultFieldId) return;
  
  // Fetch value from vault (via background script)
  const result = await chrome.runtime.sendMessage({
    action: "get_vault_field",
    field_id: vaultFieldId
  });
  
  if (result.value) {
    field.element.value = result.value;
    field.element.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

// Prompt user to map field
async function promptUserForMapping(fieldLabel) {
  // Show modal with vault field options
  // (Implementation: overlay UI with field list from IndexedDB)
  return "field_402_commercial_address"; // Placeholder
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  const fields = detectFormFields();
  if (fields.length > 0) {
    showAutoFillUI(fields);
  }
});
```

### 7. DOCX Template Merge (docx-merge.js)

**Purpose:** Client-side DOCX generation using docxtemplater

**Installation:**
```bash
npm install docxtemplater pizzip
```

**Code:**

```javascript
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

async function mergeTemplate(templateBlob, vaultData) {
  // Load DOCX as zip
  const arrayBuffer = await templateBlob.arrayBuffer();
  const zip = new PizZip(arrayBuffer);
  
  // Initialize docxtemplater
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true
  });
  
  // Set data (decrypt vault fields first)
  const decryptedData = {};
  for (const [key, encryptedValue] of Object.entries(vaultData)) {
    decryptedData[key] = await decryptField(encryptedValue, await getMasterKey());
  }
  
  doc.setData(decryptedData);
  
  // Render
  try {
    doc.render();
  } catch (error) {
    console.error("Template render error:", error);
    throw error;
  }
  
  // Generate output
  const output = doc.getZip().generate({ type: "blob" });
  return output;
}

// Usage
async function generateDocument(templateId) {
  // Fetch template from cache
  const template = await getTemplateFromCache(templateId);
  
  // Get vault data
  const vault = await getAllVaultFields();
  
  // Merge
  const docxBlob = await mergeTemplate(template, vault);
  
  // Download
  const url = URL.createObjectURL(docxBlob);
  chrome.downloads.download({
    url: url,
    filename: `document-${Date.now()}.docx`,
    saveAs: true
  });
}
```

---

## 08_DOCX_TEMPLATE_SPEC_AND_RENDERING.md

### 1. Template Structure

**Standard DOCX Template:**
- Created in Microsoft Word or LibreOffice
- Uses `{{field_id}}` placeholders for variable substitution
- Supports conditional blocks, loops, and formatting

**Example: NDA Template**

```
MUTUAL NON-DISCLOSURE AGREEMENT

This Agreement is entered into as of {{field_301_effective_date}} (the "Effective Date") 
by and between:

Party A (Disclosing Party):
{{field_101_party_a_name}}
{{field_102_party_a_address}}

Party B (Receiving Party):
{{field_201_party_b_name}}
{{field_202_party_b_address}}

WHEREAS, the parties wish to explore a business opportunity...

{%if field_401_governing_law_state %}
Governing Law: This Agreement shall be governed by the laws of {{field_401_governing_law_state}}.
{%endif%}
```

### 2. Field Naming Convention

**Format:** `field_{category_number}_{descriptive_name}`

**Categories:**
- `1xx`: Party A / Primary Entity
- `2xx`: Party B / Secondary Entity
- `3xx`: Legal Terms (dates, durations)
- `4xx`: Administrative (addresses, contacts)
- `5xx`: Financial (amounts, percentages)

**Example Field IDs:**
- `field_101_party_a_name`
- `field_102_party_a_address`
- `field_301_effective_date`
- `field_302_term_months`
- `field_401_governing_law_state`

### 3. Conditional Logic

**Syntax (Jinja2-style):**
```
{%if condition %}
  Text to include if true
{%else%}
  Alternative text
{%endif%}
```

**Example:**
```
{%if field_501_purchase_price > 100000 %}
This transaction requires Board approval.
{%else%}
This transaction may be approved by an authorized officer.
{%endif%}
```

### 4. Loops (for lists)

**Syntax:**
```
{%for item in list_field %}
  {{item.name}}: {{item.value}}
{%endfor%}
```

**Example: Board Members List**
```
Board of Directors:
{%for member in field_601_board_members %}
  - {{member.name}}, {{member.title}}
{%endfor%}
```

**Vault Data Format (JSON):**
```json
{
  "field_601_board_members": [
    {"name": "John Smith", "title": "Chairman"},
    {"name": "Jane Doe", "title": "Director"}
  ]
}
```

### 5. Template Validation

**Pre-Upload Checks:**
1. All `{{field_id}}` placeholders must match schema
2. No undefined variables
3. Conditional syntax is valid
4. DOCX file is well-formed (no corruption)

**Validation Script (Python):**

```python
import zipfile
import re
from docxtemplater import Docxtemplater

def validate_template(docx_path, field_schema):
    # Extract document.xml from DOCX
    with zipfile.ZipFile(docx_path) as zf:
        doc_xml = zf.read("word/document.xml").decode("utf-8")
    
    # Find all {{field_id}} placeholders
    placeholders = re.findall(r'\{\{([a-z0-9_]+)\}\}', doc_xml)
    
    # Check against schema
    schema_field_ids = {f["field_id"] for f in field_schema}
    undefined_fields = set(placeholders) - schema_field_ids
    
    if undefined_fields:
        raise ValueError(f"Undefined fields in template: {undefined_fields}")
    
    # Validate conditionals (basic check)
    conditionals = re.findall(r'\{%if (.+?) %\}', doc_xml)
    for cond in conditionals:
        # Ensure condition references known fields
        field_refs = re.findall(r'field_[0-9]+_[a-z_]+', cond)
        for field_ref in field_refs:
            if field_ref not in schema_field_ids:
                raise ValueError(f"Conditional references undefined field: {field_ref}")
    
    return True
```

### 6. Template Versioning

**Version Management:**
- Each template update creates new version (v1, v2, v3...)
- Old versions remain available (backward compatibility)
- Users who purchased v1 can upgrade to v2 (free or discounted)

**Database Schema:**
```sql
CREATE TABLE templates (
    id UUID PRIMARY KEY,
    name VARCHAR(255),
    version INT DEFAULT 1,
    parent_template_id UUID REFERENCES templates(id), -- NULL for v1
    docx_url TEXT,
    field_schema JSONB,
    changelog TEXT,
    created_at TIMESTAMPTZ
);
```

### 7. Error Handling

**Common Errors:**

| Error | Cause | Mitigation |
|-------|-------|------------|
| Missing field | User's vault doesn't have required field | Prompt user to fill field before merge |
| Type mismatch | Field expects date, user provides text | Validate field type in UI before merge |
| Conditional error | Invalid comparison (e.g., `string > number`) | Pre-validate conditionals in template |
| DOCX corruption | Template file is malformed | Validate DOCX structure on upload |

**User-Facing Error Messages:**
- ❌ "Missing required field: Entity Name. Please add this to your vault before generating."
- ❌ "Template error: Invalid date format for Effective Date. Expected YYYY-MM-DD."
- ✅ "Document generated successfully! Click to download."

---

## 09_PAYMENTS_ENTITLEMENTS_AND_LICENSING.md

### 1. Stripe Integration

**Payment Flows:**
1. **One-Time Template Purchase:** Stripe Checkout → webhook → create entitlement
2. **Vault Subscription:** Stripe Billing → recurring charge → renew entitlement monthly
3. **Bundle Purchase:** Stripe Checkout (multiple line items) → create entitlements for all templates in bundle

### 2. Stripe Checkout (One-Time Purchase)

**Backend Endpoint:**

```python
from fastapi import APIRouter, Depends
from stripe import checkout

router = APIRouter()

@router.post("/create-checkout-session")
async def create_checkout_session(template_id: str, user_id: str = Depends(get_current_user)):
    # Fetch template details
    template = await get_template(template_id)
    
    # Create Stripe Checkout session
    session = checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": "usd",
                "product_data": {
                    "name": template.name,
                    "description": template.description,
                },
                "unit_amount": template.price_cents,
            },
            "quantity": 1,
        }],
        mode="payment",
        success_url="https://app.elv.example.com/success?session_id={CHECKOUT_SESSION_ID}",
        cancel_url="https://app.elv.example.com/marketplace",
        metadata={
            "user_id": user_id,
            "template_id": template_id,
            "entitlement_type": "one_time"
        }
    )
    
    return {"checkout_url": session.url}
```

**Webhook Handler:**

```python
@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        await fulfill_order(session)
    
    return {"status": "success"}

async def fulfill_order(session):
    user_id = session["metadata"]["user_id"]
    template_id = session["metadata"]["template_id"]
    
    # Create entitlement
    await create_entitlement(
        user_id=user_id,
        template_id=template_id,
        entitlement_type="one_time",
        status="active",
        stripe_payment_intent_id=session["payment_intent"]
    )
```

### 3. Subscription Management (Vault Access)

**Stripe Billing Setup:**

```python
@router.post("/subscribe")
async def create_subscription(user_id: str = Depends(get_current_user)):
    # Create or retrieve Stripe customer
    customer = await get_or_create_stripe_customer(user_id)
    
    # Create subscription
    subscription = stripe.Subscription.create(
        customer=customer.id,
        items=[{"price": VAULT_SUBSCRIPTION_PRICE_ID}],  # $8/mo
        metadata={"user_id": user_id}
    )
    
    # Create entitlement
    await create_entitlement(
        user_id=user_id,
        template_id=None,  # Subscription, not template-specific
        entitlement_type="subscription",
        status="active",
        stripe_subscription_id=subscription.id
    )
    
    return {"subscription_id": subscription.id}
```

**Webhook for Subscription Events:**

```python
@router.post("/webhook")
async def stripe_webhook(request: Request):
    # ... (same signature verification as above)
    
    if event["type"] == "invoice.payment_succeeded":
        # Renew subscription
        subscription_id = event["data"]["object"]["subscription"]
        await renew_subscription(subscription_id)
    
    if event["type"] == "invoice.payment_failed":
        # Mark subscription as expired
        subscription_id = event["data"]["object"]["subscription"]
        await expire_subscription(subscription_id)
    
    if event["type"] == "customer.subscription.deleted":
        # User canceled; revoke access
        subscription_id = event["data"]["object"]["id"]
        await revoke_subscription(subscription_id)
    
    return {"status": "success"}
```

### 4. Entitlement State Machine

**States:**
- `pending`: Payment initiated, not yet confirmed
- `active`: User has access
- `expired`: Subscription lapsed (payment failed)
- `revoked`: User canceled or violated terms

**Transitions:**

```
pending → active (webhook: payment_succeeded)
active → expired (webhook: payment_failed)
active → revoked (user cancels OR admin action)
expired → active (user updates payment method)
```

**Database:**

```sql
CREATE TABLE entitlements (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    template_id UUID REFERENCES templates(id),
    entitlement_type VARCHAR(50), -- 'one_time', 'subscription', 'bundle'
    status VARCHAR(50), -- 'pending', 'active', 'expired', 'revoked'
    stripe_payment_intent_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    purchased_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ, -- NULL for one_time; set for subscription
    created_at TIMESTAMPTZ
);
```

### 5. Bundle Pricing

**Bundle Definition:**

```json
{
  "bundle_id": "bundle_therapist_001",
  "bundle_name": "Therapist Private Practice Kit",
  "price_cents": 14900,
  "templates": [
    "tpl_intake_form_001",
    "tpl_consent_001",
    "tpl_fee_agreement_001",
    "tpl_emergency_contact_001",
    "tpl_hipaa_notice_001"
  ],
  "discount_percent": 25 // vs. buying individually
}
```

**Purchase Flow:**
1. User clicks "Buy Bundle"
2. Backend creates Stripe Checkout with bundle as single line item
3. Webhook creates entitlements for all templates in bundle (atomically)

### 6. License Enforcement

**Client-Side Check (Extension):**

```javascript
async function canAccessTemplate(templateId) {
  const { jwt } = await chrome.storage.local.get("jwt");
  
  const response = await fetch(`https://api.elv.example.com/entitlements/check`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${jwt}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ template_id: templateId })
  });
  
  const { entitled } = await response.json();
  return entitled;
}
```

**Backend Enforcement:**

```python
@router.get("/templates/{template_id}/download")
async def download_template(template_id: str, user_id: str = Depends(get_current_user)):
    # Check entitlement
    entitled = await check_entitlement(user_id, template_id)
    if not entitled:
        raise HTTPException(status_code=403, detail="Not entitled to this template")
    
    # Generate pre-signed CDN URL
    template = await get_template(template_id)
    return {"download_url": template.docx_url}
```

---

## 10_RECOMMENDATIONS_ENGINE_PRIVACY_PRESERVING.md

### 1. Design Goals

1. **Recommend relevant templates** based on user's vault metadata
2. **Preserve privacy:** Never analyze field *values*, only field *IDs*
3. **Avoid UPL risk:** Frame recommendations as "commonly used with" (informational), not "you need" (advisory)

### 2. Recommendation Algorithm

**Inputs:**
- `user_vault_fields`: List of field IDs user has filled (e.g., `["field_402", "field_403"]`)
- `user_history`: List of template IDs user has already generated
- `all_templates`: Catalog of templates with field schemas

**Output:**
- List of (template_id, confidence_score, reason) tuples

**Algorithm (Pseudocode):**

```python
def recommend_templates(user_vault_fields, user_history, all_templates):
    recommendations = []
    
    for template in all_templates:
        # Skip if user already generated this template
        if template.id in user_history:
            continue
        
        # Calculate field overlap
        required_fields = set(template.required_fields)
        user_fields = set(user_vault_fields)
        
        filled_count = len(required_fields & user_fields)
        total_required = len(required_fields)
        
        if filled_count / total_required < 0.6:  # <60% fields filled
            continue
        
        # Base confidence: % of required fields filled
        confidence = filled_count / total_required
        
        # Boost 1: Co-purchase frequency
        # (Users who generated user's templates often also generated this template)
        co_purchase_score = calculate_co_purchase_affinity(user_history, template.id)
        confidence *= (1 + co_purchase_score * 0.3)
        
        # Boost 2: Data category match
        # (User has many fields in same category as template)
        category_match_score = calculate_category_affinity(user_vault_fields, template)
        confidence *= (1 + category_match_score * 0.2)
        
        # Generate reason
        reason = generate_reason(filled_count, total_required, co_purchase_score)
        
        recommendations.append((template.id, confidence, reason))
    
    # Sort by confidence
    recommendations.sort(key=lambda x: x[1], reverse=True)
    
    return recommendations[:5]  # Top 5

def calculate_co_purchase_affinity(user_history, candidate_template_id):
    # Query: How often do users who generated templates in user_history also generate candidate?
    # This requires aggregated analytics (pre-computed)
    
    # Pseudocode:
    # co_purchase_count = count of users who generated both user_history templates AND candidate
    # total_users = count of users who generated user_history templates
    # return co_purchase_count / total_users
    
    return 0.5  # Placeholder

def calculate_category_affinity(user_vault_fields, template):
    # Count how many user fields are in same data_category as template fields
    user_categories = [get_field_category(f) for f in user_vault_fields]
    template_categories = [f.data_category for f in template.required_fields]
    
    category_overlap = len(set(user_categories) & set(template_categories))
    return category_overlap / len(set(template_categories))

def generate_reason(filled_count, total_required, co_purchase_score):
    if filled_count == total_required:
        return "All required fields filled"
    elif co_purchase_score > 0.7:
        return "Commonly used with your documents"
    else:
        return f"{filled_count}/{total_required} fields ready"
```

### 3. Pre-Computed Analytics

**Co-Purchase Matrix:**
- Store aggregated data: "Users who generated Template A often generated Template B"
- Computed weekly via batch job

**Table:**

```sql
CREATE TABLE template_affinity (
    template_a_id UUID REFERENCES templates(id),
    template_b_id UUID REFERENCES templates(id),
    affinity_score FLOAT, -- 0.0 to 1.0
    computed_at TIMESTAMPTZ,
    PRIMARY KEY (template_a_id, template_b_id)
);
```

**Batch Job (Celery Task):**

```python
@celery.task
def compute_template_affinity():
    # Query: For each pair of templates, calculate co-purchase rate
    query = """
        SELECT 
            e1.template_id AS template_a,
            e2.template_id AS template_b,
            COUNT(DISTINCT e1.user_id) AS co_purchase_count,
            (SELECT COUNT(DISTINCT user_id) FROM entitlements WHERE template_id = e1.template_id) AS total_a_users
        FROM entitlements e1
        JOIN entitlements e2 ON e1.user_id = e2.user_id AND e1.template_id < e2.template_id
        GROUP BY e1.template_id, e2.template_id
    """
    
    results = db.execute(query)
    
    for row in results:
        affinity_score = row.co_purchase_count / row.total_a_users
        db.upsert(
            "template_affinity",
            {
                "template_a_id": row.template_a,
                "template_b_id": row.template_b,
                "affinity_score": affinity_score,
                "computed_at": datetime.now()
            }
        )
```

### 4. UX: Displaying Recommendations

**Phrasing (Avoid UPL):**
- ✅ "Commonly used with your documents"
- ✅ "Users with similar vaults often use this"
- ✅ "You've filled 80% of required fields for this template"
- ❌ "You need this document" (implies legal advice)
- ❌ "This is required for compliance" (advisory)

**UI Mockup:**

```
┌─────────────────────────────────────────┐
│  Recommended for You                    │
├─────────────────────────────────────────┤
│  📄 Commercial Lease Agreement          │
│     You've filled 8/10 required fields  │
│     [View Template] [Buy: $29]          │
├─────────────────────────────────────────┤
│  📄 Operating Agreement                 │
│     Commonly used with your NDA         │
│     [View Template] [Buy: $39]          │
└─────────────────────────────────────────┘
```

---

## 11_SECURITY_THREAT_MODEL.md

### 1. Threat Actors

| Actor | Motivation | Capability |
|-------|------------|------------|
| **Script Kiddie** | Fame, mischief | Low (automated tools, no custom exploits) |
| **Cybercriminal** | Financial gain (steal data, ransom) | Medium (phishing, malware, exploits) |
| **Nation-State** | Espionage, surveillance | High (zero-days, infrastructure compromise) |
| **Insider** | Revenge, profit | High (legitimate access to backend) |
| **Competitor** | Business intelligence | Medium (scraping, reverse engineering) |

### 2. Assets & Threat Matrix

| Asset | Confidentiality | Integrity | Availability |
|-------|-----------------|-----------|--------------|
| **User Vault (encrypted)** | Critical | High | Medium |
| **Master Key** | Critical | Critical | N/A |
| **Metadata** | Low | Medium | Medium |
| **Template Catalog** | Low | High | Medium |
| **Payment Data** | Critical (delegated to Stripe) | Critical | Medium |

### 3. Threat Scenarios

#### Scenario 1: Backend Server Compromise

**Attack:** Attacker gains root access to backend servers (via RCE, SSH compromise, etc.)

**Impact:**
- Access to database (user emails, salts, key hashes, metadata)
- Access to S3 credentials (encrypted vault blobs)
- Cannot decrypt vaults (no master keys on server)

**Mitigations:**
- Zero-knowledge architecture limits blast radius
- Vault blobs are encrypted client-side; server stores ciphertext only
- Key hashes are one-way (PBKDF2); cannot reverse to passphrase
- Implement server hardening: disable SSH password auth, fail2ban, firewall rules
- Monitor for anomalous access (SIEM, CloudWatch)

**Residual Risk:** Metadata leakage (field IDs, template usage); cannot prevent this in zero-knowledge model

#### Scenario 2: Device Theft or Loss

**Attack:** User's laptop stolen; attacker has physical access to device

**Impact:**
- Vault stored in browser IndexedDB (encrypted at rest)
- Requires passphrase to decrypt
- If device unlocked and browser open, attacker may access plaintext vault

**Mitigations:**
- Encourage strong device-level encryption (BitLocker, FileVault)
- Auto-lock browser extension after inactivity (e.g., 5 minutes)
- Require passphrase re-entry for sensitive operations (vault export, sync)

**Residual Risk:** If device unlocked when stolen, attacker has brief window of access

#### Scenario 3: Phishing Attack

**Attack:** User receives fake email: "Your vault access expires; click here to renew"

**Impact:**
- User enters passphrase on attacker-controlled site
- Attacker captures passphrase
- Attacker logs in as user, accesses vault

**Mitigations:**
- Extension validates domain (only allows passphrase entry on `app.elv.example.com`)
- User education: "We will never ask for your passphrase via email"
- Implement 2FA (optional; trade off convenience vs. security)

**Residual Risk:** Sophisticated phishing (spoofed domain, homograph attack) may still succeed

#### Scenario 4: Malicious Extension Update

**Attack:** Attacker compromises developer account; pushes malicious extension update

**Impact:**
- Updated extension exfiltrates plaintext vault to attacker server
- Affects all users who auto-update

**Mitigations:**
- Code signing: All releases signed with developer key
- Open-source extension: Community can audit code before updates
- Chrome Web Store review process (limited; not foolproof)
- Subresource Integrity (SRI) for external scripts

**Residual Risk:** Chrome Web Store review is not comprehensive; malicious code may slip through

#### Scenario 5: MITM Attack (Network Eavesdropping)

**Attack:** Attacker on public Wi-Fi intercepts traffic between extension and backend

**Impact:**
- Encrypted vault blobs intercepted (but attacker cannot decrypt)
- JWT tokens intercepted (attacker can impersonate user temporarily)

**Mitigations:**
- TLS 1.3 for all API communication
- Certificate pinning (optional; reduces MITM risk)
- Short-lived JWT tokens (7-day expiry)
- Encrypt vault blobs client-side (attacker sees only ciphertext)

**Residual Risk:** JWT token theft allows temporary impersonation

### 4. Mitigations Summary

| Threat | Mitigation | Priority |
|--------|------------|----------|
| Backend compromise | Zero-knowledge architecture | Critical |
| Device theft | Auto-lock, device encryption | High |
| Phishing | Domain validation, 2FA | High |
| Malicious extension | Code signing, open-source | High |
| MITM attack | TLS 1.3, short-lived tokens | Medium |
| Weak passphrase | Passphrase strength meter (zxcvbn) | High |
| SQL injection | Parameterized queries (SQLAlchemy ORM) | Critical |
| XSS | Content Security Policy headers | High |

---

## 12_ROADMAP_MVP_TO_V1.md

### Phase 1: MVP (Months 1-3)

**Goal:** Prove core value proposition (encrypted vault + document generation)

**Features:**
1. User registration (email + passphrase)
2. Vault dashboard (add/edit/delete fields)
3. Template marketplace (browse, buy one template)
4. Extension: Interview UI → encrypt fields → merge DOCX → download
5. Stripe integration (one-time purchases only)
6. Basic entitlement check (can user access template?)

**Out of Scope:**
- Recommendations engine
- Subscription billing
- External form injection
- Multi-device sync (manual export/import only)

**Success Metrics:**
- 50 beta users
- 100 documents generated
- <5 min time to first document
- Zero UPL complaints

**Team:**
- 1 fullstack engineer (backend + web app)
- 1 frontend engineer (extension + UI)
- 0.5 designer (mockups + branding)

**Timeline:**
- Week 1-2: Auth + database setup
- Week 3-4: Vault UI + IndexedDB
- Week 5-6: Extension (interview + merge)
- Week 7-8: Marketplace + Stripe
- Week 9-10: End-to-end testing
- Week 11-12: Beta launch + iteration

### Phase 2: Recommendations + Subscriptions (Months 4-5)

**Goal:** Improve retention via data gravity and recurring revenue

**Features:**
1. Recommendations engine (metadata-only)
2. Vault subscription ($8/mo)
3. Stripe Billing integration
4. Analytics dashboard (user: field completion %)
5. Multi-device sync (encrypted S3 backups)

**Success Metrics:**
- 200 active users
- 50 vault subscriptions
- <5% monthly churn
- 3+ recommendations clicked per user

**Team:**
- Same as Phase 1
- +1 backend engineer (analytics, recommendations)

**Timeline:**
- Week 13-14: Recommendations algorithm
- Week 15-16: Subscription billing
- Week 17-18: Multi-device sync
- Week 19-20: Testing + launch

### Phase 3: "Trojan Horse" Extension + Vertical Bundles (Months 6-8)

**Goal:** Expand use cases beyond templates; target specific professions

**Features:**
1. External form injection (auto-fill IRS, bank forms)
2. Field mapping UI (user maps vault fields to external form fields)
3. Vertical bundles (Therapist Kit, Founder Kit, etc.)
4. Wizard (one-time interview populates vault + generates 5 docs)
5. White-label partnerships (co-branded vaults for associations)

**Success Metrics:**
- 500 active users
- $50k bundle revenue
- 3+ external form fills per user
- 1-2 vertical partnerships signed

**Team:**
- Same as Phase 2
- +0.5 business development (partnerships)

**Timeline:**
- Week 21-24: External form injection
- Week 25-26: Vertical bundle creation
- Week 27-28: Wizard UI
- Week 29-30: White-label customization
- Week 31-32: Partnership outreach

### Phase 4: V1.0 Launch + Scale (Months 9-12)

**Goal:** Achieve product-market fit; scale to 1,000+ users

**Features:**
1. Mobile-responsive web app
2. Premium tier (B2B: audit logs, SSO, HIPAA)
3. Template marketplace curation (20+ templates)
4. Community features (user reviews, template ratings)
5. API access (for enterprise integrations)

**Success Metrics:**
- 1,000 active users
- $100k ARR
- <5% churn
- 5+ premium tier customers

**Team:**
- Same as Phase 3
- +1 customer success (support, onboarding)
- +1 security audit (third-party)

**Timeline:**
- Month 9: Premium tier + API
- Month 10: Template expansion + curation
- Month 11: Security audit + penetration testing
- Month 12: V1.0 launch + marketing push

---

## 13_BACKLOG_EPICS_USER_STORIES.md

### Epic 1: User Authentication & Vault Setup

**User Stories:**

1. **As a new user, I want to create an account with email + passphrase, so that I can securely store my legal data.**
   - Acceptance: Registration form; passphrase strength meter (zxcvbn); PBKDF2 key derivation; salt stored in DB
   - Estimate: 3 days

2. **As a returning user, I want to log in with my passphrase, so that I can access my vault.**
   - Acceptance: Login form; fetch salt; derive key; verify hash; issue JWT token
   - Estimate: 2 days

3. **As a user, I want to see a dashboard showing my vault fields, so that I can manage my data.**
   - Acceptance: Table view of fields (field_id, field_name, last_updated); add/edit/delete buttons
   - Estimate: 3 days

### Epic 2: Template Marketplace

**User Stories:**

1. **As a user, I want to browse available templates, so that I can find documents I need.**
   - Acceptance: Grid/list view; filter by category; search by name
   - Estimate: 3 days

2. **As a user, I want to see template details (price, required fields), so that I can decide if I want to buy.**
   - Acceptance: Modal or detail page; show field schema; "Buy Now" button
   - Estimate: 2 days

3. **As a user, I want to purchase a template via Stripe, so that I can unlock it for use.**
   - Acceptance: Redirect to Stripe Checkout; webhook creates entitlement; redirect back with success message
   - Estimate: 5 days

### Epic 3: Browser Extension (Document Generation)

**User Stories:**

1. **As a user, I want to install the extension, so that I can generate documents.**
   - Acceptance: Chrome Web Store listing; install button; extension icon appears in toolbar
   - Estimate: 1 day

2. **As a user, I want the extension to interview me for missing fields, so that I can fill my vault.**
   - Acceptance: Modal/side panel UI; form fields for each required field; save to IndexedDB
   - Estimate: 5 days

3. **As a user, I want to merge my vault data into a template, so that I can download a completed document.**
   - Acceptance: Click "Generate"; extension decrypts vault; merges with DOCX; downloads file
   - Estimate: 7 days (includes docxtemplater integration)

4. **As a user, I want the extension to cache templates locally, so that I can generate documents offline.**
   - Acceptance: Templates stored in IndexedDB; extension checks cache before downloading
   - Estimate: 2 days

### Epic 4: Recommendations Engine

**User Stories:**

1. **As a user, I want to see recommended templates based on my vault, so that I can discover relevant documents.**
   - Acceptance: "Recommended for You" section on dashboard; 3-5 recommendations; click to view template
   - Estimate: 5 days

2. **As a user, I want to understand why a template is recommended, so that I can trust the suggestion.**
   - Acceptance: Reason displayed (e.g., "8/10 fields filled" or "Commonly used with your NDA")
   - Estimate: 2 days

### Epic 5: Multi-Device Sync

**User Stories:**

1. **As a user, I want to sync my vault to the cloud, so that I can access it from multiple devices.**
   - Acceptance: "Sync Now" button; upload encrypted blob to S3; last sync timestamp displayed
   - Estimate: 4 days

2. **As a user, I want to download my vault on a new device, so that I can continue working.**
   - Acceptance: "Download Vault" button; fetch encrypted blob from S3; decrypt and load into IndexedDB
   - Estimate: 3 days

### Epic 6: Subscriptions & Billing

**User Stories:**

1. **As a user, I want to subscribe to vault access, so that I can store unlimited fields.**
   - Acceptance: "Subscribe" button; redirect to Stripe Billing; webhook creates subscription entitlement
   - Estimate: 5 days

2. **As a user, I want to cancel my subscription easily, so that I'm not trapped in a dark pattern.**
   - Acceptance: "Cancel Subscription" button; one-click cancellation; confirmation modal
   - Estimate: 2 days

3. **As a user, I want to see my billing history, so that I can track my spending.**
   - Acceptance: Table view of invoices; download receipt button
   - Estimate: 2 days

### Epic 7: External Form Injection

**User Stories:**

1. **As a user, I want to auto-fill external forms with my vault data, so that I don't have to copy-paste.**
   - Acceptance: Content script detects form fields; "Fill from Vault" button appears; user maps fields; extension fills values
   - Estimate: 7 days

2. **As a user, I want to save my field mappings, so that I don't have to re-map each time.**
   - Acceptance: Mappings stored in IndexedDB; extension auto-suggests previous mappings
   - Estimate: 3 days

### Epic 8: Vertical Bundles

**User Stories:**

1. **As a therapist, I want to purchase a "Therapist Private Practice Kit", so that I can get all relevant templates at once.**
   - Acceptance: Bundle listing; discounted price vs. individual; checkout creates entitlements for all templates
   - Estimate: 3 days

2. **As a user, I want a wizard to guide me through populating my vault, so that I can generate documents quickly.**
   - Acceptance: Step-by-step form; auto-populates vault; generates 5 documents at end
   - Estimate: 5 days

### Epic 9: Premium Tier (B2B)

**User Stories:**

1. **As a law firm admin, I want to create team accounts, so that my associates can share a vault.**
   - Acceptance: Admin dashboard; add/remove team members; assign roles (admin, member)
   - Estimate: 7 days

2. **As a law firm admin, I want audit logs, so that I can track who accessed what.**
   - Acceptance: Log table; timestamp, user, action (viewed, edited, downloaded)
   - Estimate: 4 days

3. **As a law firm admin, I want SSO integration, so that my team can log in with company credentials.**
   - Acceptance: SAML or OAuth integration; admin configures IdP
   - Estimate: 10 days (complex; consider outsourcing)

---

## 14_OPEN_QUESTIONS_AND_DECISIONS.md

### 1. Legal & Compliance

**Q1: Do we need a lawyer to review all templates before publishing?**
- **Context:** Incumbent platforms (LegalZoom, Rocket Lawyer) have attorney review; we position as software, not legal service
- **Options:**
  1. Yes, hire attorney to review all templates (expensive; ~$500-$1k per template)
  2. No, user assumes responsibility (disclaimer: "Not legal advice; consult attorney")
  3. Hybrid: Review high-risk templates only (corporate, estate planning); allow unreviewed for low-risk (NDAs, leases)
- **Recommendation:** Option 3; review high-risk; clearly disclaim unreviewed
- **Decision Needed By:** Before MVP launch

**Q2: Is our recommendation phrasing sufficient to avoid UPL?**
- **Context:** Recommendations must be informational, not advisory
- **Current Phrasing:** "Commonly used with your documents" vs. "You need this document"
- **Action:** Legal review of all UX copy; test with state bar associations
- **Decision Needed By:** Before recommendations engine launch (Phase 2)

**Q3: Do we need SOC 2 certification for enterprise customers?**
- **Context:** Law firms / family offices may require SOC 2 Type II
- **Cost:** $20k-$50k for initial audit + $10k/year for renewal
- **Recommendation:** Defer until 5+ enterprise customers request; offer alternatives (security audit report, penetration test)
- **Decision Needed By:** Before premium tier launch (Phase 4)

### 2. Product & UX

**Q4: Should we support passphrase recovery via security questions?**
- **Tradeoff:** Convenience vs. zero-knowledge purity
- **User Impact:** Non-technical users may forget passphrase; no recovery = lost vault
- **Recommendation:** Offer opt-in recovery with clear disclosure ("This weakens zero-knowledge; use at your own risk")
- **Decision Needed By:** Before MVP launch

**Q5: Should we allow users to export plaintext vault?**
- **Tradeoff:** User control vs. security risk (plaintext export could be stolen)
- **Options:**
  1. Yes, allow export (user assumes risk)
  2. No, only encrypted export (consistent with zero-knowledge)
  3. Hybrid: Export with watermarking / expiration
- **Recommendation:** Option 2; only encrypted export; users can decrypt locally if needed
- **Decision Needed By:** Before MVP launch

**Q6: Do we build mobile apps (iOS, Android) or rely on mobile web + extension?**
- **Context:** Extension works on mobile Chrome/Edge; native apps offer better UX
- **Cost:** $50k-$100k per platform (iOS + Android)
- **Recommendation:** Defer native apps until 1,000+ users request; focus on mobile-responsive web app
- **Decision Needed By:** Post-V1.0 (Month 12+)

### 3. Technical

**Q7: Should we use WebAssembly (WASM) for client-side DOCX processing?**
- **Context:** docxtemplater is JavaScript; WASM could improve performance
- **Tradeoff:** Performance vs. complexity (WASM adds build complexity)
- **Recommendation:** Start with JavaScript; migrate to WASM if performance issues arise
- **Decision Needed By:** Before MVP launch (test with typical templates)

**Q8: How do we handle version conflicts in multi-device sync?**
- **Context:** User edits vault on Device A; syncs; then edits on Device B (outdated)
- **Options:**
  1. Last-write-wins (simple; may lose data)
  2. Operational Transformation (complex; industry standard for collaborative editing)
  3. Conflict detection + user resolution (middle ground)
- **Recommendation:** Option 3 for MVP; upgrade to Option 2 if demand warrants
- **Decision Needed By:** Before multi-device sync launch (Phase 2)

**Q9: Should we implement rate limiting on API endpoints?**
- **Context:** Prevent abuse (automated scraping, DDoS)
- **Recommendation:** Yes; implement Redis-backed rate limiting (10 requests/sec per user)
- **Decision Needed By:** Before MVP launch

### 4. Business & GTM

**Q10: What is our target CAC for each acquisition channel?**
- **Benchmarks:**
  - Vertical partnerships: <$5 (association endorsement)
  - Community: <$30 (organic growth)
  - Paid search: <$50 (competitive keywords)
- **Action:** Measure CAC weekly by channel; pause channels >$50 CAC
- **Decision Needed By:** Month 1 (before any paid acquisition)

**Q11: Should we offer a free trial (7 days) or freemium plan?**
- **Free Trial:** Reduces entry friction; risk of tire-kickers
- **Freemium:** Attracts mass market; risk of low-engagement users
- **Recommendation:** Free trial (7 days, credit card required); no freemium
- **Decision Needed By:** Before MVP launch

**Q12: What is our vertical partnership revenue share model?**
- **Context:** Associations want revenue share for endorsing ELV
- **Options:**
  1. Flat fee (e.g., $5k/year for endorsement)
  2. Revenue share (e.g., 20% of subscription revenue from association members)
  3. Hybrid (flat fee + revenue share)
- **Recommendation:** Option 2 (revenue share); aligns incentives
- **Decision Needed By:** Before first partnership negotiation (Month 3)

### 5. Security

**Q13: Should we implement 2FA for all users or make it optional?**
- **Tradeoff:** Security vs. UX friction
- **Recommendation:** Optional for MVP; mandatory for premium tier
- **Decision Needed By:** Before MVP launch

**Q14: Should we open-source the extension for community audit?**
- **Tradeoff:** Transparency (trust) vs. competitive advantage (proprietary code)
- **Recommendation:** Yes; open-source extension (not backend); increases trust
- **Decision Needed By:** Before public launch (Month 3)

**Q15: How often should we rotate JWT tokens?**
- **Context:** Longer expiry = better UX; shorter expiry = better security
- **Recommendation:** 7-day expiry; refresh token mechanism (30-day expiry)
- **Decision Needed By:** Before MVP launch

---

## CONCLUSION

This planning documentation suite provides a comprehensive, production-ready roadmap for building the Encrypted Legal Vault (ELV) platform. The plan is grounded in strategic insights from your feasibility analysis and designed for execution by a small engineering team over 12 months.

### Key Success Factors

1. **Disciplined Scope:** Focus on core zero-knowledge value proposition; resist feature bloat
2. **Vertical Focus:** Target high-trust professionals; avoid mass-market DIY segment
3. **Privacy-First Marketing:** Leverage technical guarantees (not promises) as primary differentiator
4. **Low-CAC Distribution:** Prioritize partnerships and community over paid search
5. **Data Gravity Retention:** Design for utility-based retention, not fear-based or negative-option

### Next Steps

1. **Legal Review:** Engage attorney for UPL risk assessment, template disclaimers, subscription compliance
2. **Security Audit:** Third-party cryptographic review of zero-knowledge architecture
3. **Partnership Outreach:** Identify 3-5 vertical associations for pilot programs
4. **MVP Development:** Execute Phase 1 roadmap (Months 1-3)
5. **Iterative Testing:** Beta launch with 50 users; measure time-to-first-document, data gravity, retention

---

**END OF PLANNING DOCUMENTATION SUITE**