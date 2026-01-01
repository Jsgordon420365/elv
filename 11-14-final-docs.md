# ENCRYPTED LEGAL VAULT (ELV) - REMAINING PLANNING DOCUMENTATION (PART 5 - FINAL)

## 11_SECURITY_ARCHITECTURE.md

```markdown
# Security Architecture

## 1. Threat Model

### 1.1. Adversary Capabilities

| Adversary | Capabilities | Mitigations |
|-----------|-------------|-------------|
| **Malicious User** | Attempts to access other users' vaults | Client-side encryption; user-specific key derivation |
| **Compromised Server** | Reads database; steals encrypted blobs | Zero-knowledge architecture; server never sees plaintext |
| **Network Eavesdropper** | Intercepts vault sync traffic | TLS 1.3; encrypted vault blobs |
| **Malicious Extension** | Attempts to read vault from memory | Master Key expires after 30 min; no persistent storage |
| **Phishing Attack** | Tricks user into revealing passphrase | No password reset; user education on phishing |

---

## 2. Cryptographic Design

### 2.1. Key Hierarchy

```
User Passphrase (secret, never stored)
   ↓ PBKDF2-SHA256 (600,000 iterations + user_id salt)
Master Key (32 bytes, in-memory only)
   ↓ AES-GCM encryption
Vault Field (encrypted, stored in IndexedDB + S3)
```

**Critical Properties:**
- **Master Key never leaves device** (except encrypted vault blobs)
- **Server never sees passphrase or Master Key**
- **Each field encrypted independently** (no all-or-nothing decryption)

### 2.2. PBKDF2 Parameters

```typescript
const PBKDF2_ITERATIONS = 600_000;  // OWASP 2023 recommendation
const KEY_LENGTH = 32;  // 256-bit key
const HASH_FUNCTION = 'SHA-256';

async function deriveMasterKey(passphrase: string, userId: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  
  // Salt = user_id (unique per user, non-secret)
  const salt = encoder.encode(userId);
  
  // Import passphrase as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  // Derive Master Key
  const masterKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: HASH_FUNCTION
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,  // Not extractable
    ['encrypt', 'decrypt']
  );
  
  return masterKey;
}
```

**Why user_id as salt:**
- Guarantees different Master Keys for same passphrase across users
- No need to store salt separately (user_id already known)
- **Trade-off:** Cannot change user_id without re-encrypting vault

### 2.3. AES-GCM Encryption

```typescript
async function encryptField(plaintext: string, masterKey: CryptoKey): Promise<EncryptedField> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // Generate random IV (96-bit = 12 bytes)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      tagLength: 128  // 128-bit authentication tag
    },
    masterKey,
    data
  );
  
  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv)
  };
}

async function decryptField(encrypted: EncryptedField, masterKey: CryptoKey): Promise<string> {
  const ciphertext = base64ToArrayBuffer(encrypted.ciphertext);
  const iv = base64ToArrayBuffer(encrypted.iv);
  
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      tagLength: 128
    },
    masterKey,
    ciphertext
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(plaintext);
}
```

**Why AES-GCM:**
- Authenticated encryption (prevents tampering)
- Fast (hardware acceleration on most devices)
- Secure with random IV (never reuse IV with same key)

---

## 3. Key Management

### 3.1. Master Key Lifecycle

```
User enters passphrase → Derive Master Key → Store in memory (service worker)
   ↓
Vault unlocked (fields decrypted)
   ↓
30 minutes of inactivity → Service worker terminates → Master Key cleared
   ↓
User action (merge DOCX) → Prompt for passphrase → Re-derive Master Key
```

**Security Properties:**
- Master Key never written to disk
- Master Key expires automatically (no user action required)
- Re-entry of passphrase required after expiry

### 3.2. Passphrase Requirements

**Entropy Target:** 100 bits (comparable to 20-character random alphanumeric)

**Strategies:**
1. **Long passphrase:** 6+ words (Diceware: 77 bits with 6 words)
2. **Complex password:** 14+ characters with mixed case, digits, symbols

**Enforcement:**
```typescript
function validatePassphrase(passphrase: string): { valid: boolean; error?: string } {
  // Minimum length
  if (passphrase.length < 14) {
    return { valid: false, error: 'Passphrase must be at least 14 characters' };
  }
  
  // Entropy check (approximate)
  const entropy = estimateEntropy(passphrase);
  if (entropy < 80) {
    return { valid: false, error: 'Passphrase is too weak. Use longer phrases or more variety.' };
  }
  
  return { valid: true };
}

function estimateEntropy(passphrase: string): number {
  const hasLower = /[a-z]/.test(passphrase);
  const hasUpper = /[A-Z]/.test(passphrase);
  const hasDigit = /[0-9]/.test(passphrase);
  const hasSymbol = /[^a-zA-Z0-9]/.test(passphrase);
  
  let charsetSize = 0;
  if (hasLower) charsetSize += 26;
  if (hasUpper) charsetSize += 26;
  if (hasDigit) charsetSize += 10;
  if (hasSymbol) charsetSize += 32;
  
  return passphrase.length * Math.log2(charsetSize);
}
```

---

## 4. Secure Storage

### 4.1. IndexedDB (Client-Side)

**Stored Data:**
- Encrypted vault blob (Base64-encoded JSON)
- Device token (JWT)
- Settings (theme, auto-sync preference)

**Security Properties:**
- **Same-origin policy** – Only extension can access IndexedDB
- **No plaintext fields** – All sensitive data encrypted
- **Cleared on uninstall** – No data leakage

**Schema:**
```typescript
{
  vault: {
    user_id: string,
    fields: [
      {
        field_id: string,
        ciphertext: string,  // Base64
        iv: string,          // Base64
        field_type: string
      }
    ],
    version: number,
    last_synced_at: number
  }
}
```

### 4.2. AWS S3 (Server-Side)

**Stored Data:**
- Encrypted vault backups (per-device)
- Template DOCX files (unencrypted; templates are not user-specific)

**Encryption:**
- **At rest:** AES-256 (S3 default encryption)
- **In transit:** TLS 1.3

**Access Control:**
- **Vault blobs:** Pre-signed URLs (valid for 5 minutes)
- **Templates:** Public read (CDN cached)

**File Structure:**
```
s3://elv-vaults/
├── vaults/
│   └── {user_id}/
│       └── {device_id}.json  # Encrypted vault blob
└── templates/
    └── {template_id}-v{version}.docx
```

---

## 5. Authentication

### 5.1. Device Registration

**Flow:**
```
User installs extension → Generate device keypair (RSA-2048)
   ↓
Send public key to server → Server issues device token (JWT)
   ↓
Store device token in IndexedDB
```

**Device Token (JWT):**
```json
{
  "user_id": "user_2a1b3c4d5e6f",
  "device_id": "device_7g8h9i0j",
  "public_key": "MIIBIjANBgkqhki...",
  "issued_at": 1704067200,
  "expires_at": 1735689600  // 1 year
}
```

**Purpose:**
- Identify device (not user); allows multi-device sync
- No password stored (device token is bearer token)

### 5.2. API Authentication

**Extension → Server:**
```http
GET /api/purchases/verify
Authorization: Bearer {device_token}
```

**Admin → Server:**
```http
POST /api/admin/templates
Authorization: Bearer {clerk_session_token}
```

---

## 6. Secure Sync Protocol

### 6.1. Vault Sync Flow

```
User clicks "Sync" in extension
   ↓
Extension serializes vault (encrypted fields)
   ↓
Extension requests pre-signed S3 URL (PUT)
   ↓
Server validates device token → Generates pre-signed URL (expires in 5 min)
   ↓
Extension uploads encrypted vault blob to S3
   ↓
Server records sync timestamp in database
```

**Pre-Signed URL Example:**
```
PUT https://elv-vaults.s3.amazonaws.com/vaults/user_abc123/device_xyz789.json
?X-Amz-Algorithm=AWS4-HMAC-SHA256
&X-Amz-Credential=...
&X-Amz-Date=20250115T103000Z
&X-Amz-Expires=300
&X-Amz-Signature=...
```

**Security Properties:**
- Server never sees vault contents (client encrypts before upload)
- Pre-signed URL valid for 5 minutes only (limits replay attacks)
- S3 bucket is not publicly readable

### 6.2. Conflict Resolution

**Scenario:** User edits vault on Device A; then edits on Device B (offline); syncs both

**Strategy:** Last-write-wins (LWW)

**Implementation:**
```typescript
type VaultVersion = {
  version: number;  // Incremented on each local edit
  last_synced_at: number;  // Unix timestamp
};

async function syncVault(localVault: Vault) {
  // Fetch remote vault
  const remoteVault = await fetchRemoteVault();
  
  if (remoteVault.version > localVault.version) {
    // Remote is newer; download and merge
    const mergedVault = mergeVaults(localVault, remoteVault);
    await saveVault(mergedVault);
  } else {
    // Local is newer; upload
    localVault.version += 1;
    localVault.last_synced_at = Date.now();
    await uploadVault(localVault);
  }
}

function mergeVaults(local: Vault, remote: Vault): Vault {
  // For each field, take the version with latest timestamp
  const merged = { ...local };
  
  for (const remoteField of remote.fields) {
    const localField = local.fields.find(f => f.field_id === remoteField.field_id);
    
    if (!localField || remoteField.updated_at > localField.updated_at) {
      // Remote field is newer; use it
      merged.fields = merged.fields.filter(f => f.field_id !== remoteField.field_id);
      merged.fields.push(remoteField);
    }
  }
  
  return merged;
}
```

---

## 7. Vulnerability Mitigations

### 7.1. Cross-Site Scripting (XSS)

**Risk:** Malicious template injects script into extension UI

**Mitigation:**
- Sanitize all user inputs (field labels, descriptions)
- Use React's JSX (auto-escapes HTML)
- Content Security Policy (CSP) in manifest

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  }
}
```

### 7.2. SQL Injection

**Risk:** Attacker injects SQL via API parameters

**Mitigation:**
- Use Supabase ORM (parameterized queries)
- Validate all inputs server-side

```typescript
// ❌ Vulnerable
const { data } = await supabase.rpc('get_template', { id: req.params.id });

// ✅ Safe
const { data } = await supabase
  .from('templates')
  .select('*')
  .eq('id', req.params.id)
  .single();
```

### 7.3. Timing Attacks

**Risk:** Attacker infers passphrase by measuring encryption time

**Mitigation:**
- Use constant-time comparison for authentication tags (AES-GCM handles this)
- Rate-limit authentication attempts (60/hour per device)

### 7.4. Replay Attacks

**Risk:** Attacker captures sync request; replays to overwrite vault

**Mitigation:**
- Pre-signed URLs expire after 5 minutes
- Include timestamp in vault blob; reject old vaults

---

## 8. Compliance

### 8.1. GDPR

**Requirements:**
- Right to access (user can export vault)
- Right to deletion (user can delete account)
- Data portability (export as JSON)

**Implementation:**
```typescript
// Export vault (plaintext)
async function exportVault(): Promise<string> {
  const vault = await loadVault();
  const masterKey = getMasterKey();
  
  const decryptedVault = {
    user_id: vault.user_id,
    fields: []
  };
  
  for (const field of vault.fields) {
    decryptedVault.fields.push({
      field_id: field.field_id,
      value: await decryptField(field, masterKey),
      field_type: field.field_type
    });
  }
  
  return JSON.stringify(decryptedVault, null, 2);
}

// Delete account
async function deleteAccount(userId: string) {
  // Delete vault from S3
  await s3.deleteObject({
    Bucket: 'elv-vaults',
    Key: `vaults/${userId}/`
  });
  
  // Delete user data from database
  await supabase.from('purchases').delete().eq('user_id', userId);
  await supabase.from('users').delete().eq('id', userId);
}
```

### 8.2. CCPA

**Requirements:**
- Disclose data collection practices
- Allow opt-out of data sale (we don't sell data)

**Implementation:**
- Privacy policy (https://app.elv.com/privacy)
- "Do Not Sell" link in footer

---

## 9. Incident Response

### 9.1. Data Breach Scenarios

| Scenario | Impact | Response |
|----------|--------|----------|
| **S3 bucket exposed** | Encrypted vaults leaked | Low risk (server never has keys); notify users; rotate device tokens |
| **Database compromised** | User emails, purchase history leaked | Notify users within 72 hours (GDPR); offer credit monitoring |
| **Extension compromised** | Master Key leaked (if extension is running) | Revoke extension from Chrome Web Store; notify users to change passphrase |

### 9.2. Disclosure Policy

**Timeline:**
1. **T+0:** Detect breach
2. **T+4 hours:** Contain breach (revoke tokens, rotate secrets)
3. **T+24 hours:** Assess impact (how many users affected?)
4. **T+72 hours:** Notify users (email + in-app banner)
5. **T+7 days:** Public disclosure (blog post)

---

## 10. Open Questions

| Question | Options | Recommendation |
|----------|---------|----------------|
| **Support hardware keys (YubiKey)?** | Yes (WebAuthn) | Year 2; complex integration |
| **Implement 2FA?** | Yes (TOTP) | Year 2; passphrase is already strong |
| **Add recovery key?** | Yes (24-word seed phrase) | Yes; critical for MVP |

---

## 11. Conclusion

This security architecture achieves zero-knowledge encryption:
- Server never sees plaintext fields
- Master Key derived client-side only
- Vault synced as encrypted blob

**Critical Security Decisions:**
1. PBKDF2 with 600k iterations (balances security and UX)
2. AES-GCM for authenticated encryption
3. Device tokens (not user passwords) for API auth
4. Pre-signed S3 URLs (time-limited vault access)
```

---

## 12_GTM_PLAN.md

```markdown
# Go-To-Market Plan

## 1. Target Market

### 1.1. Primary Personas

#### Persona 1: Solo Therapist
- **Demographics:** 35-55 years old, private practice, $80-150k income
- **Pain Points:**
  - HIPAA compliance is confusing
  - Intake forms are repetitive (typing same info for each client)
  - Worried about data breaches (heard horror stories)
- **Buying Behavior:** Price-sensitive; prefers one-time purchases over subscriptions
- **Channels:** Psychology Today, therapist Facebook groups, CAMFT conferences

#### Persona 2: Small Business Owner (LLC)
- **Demographics:** 30-45 years old, 1-5 employees, $100-500k revenue
- **Pain Points:**
  - Paid $1,500 for operating agreement (overkill for simple LLC)
  - Needs to update registered agent info every year (costs $200 each time)
  - Worried about mixing personal and business finances
- **Buying Behavior:** DIY mindset; willing to pay for templates to avoid lawyers
- **Channels:** r/Entrepreneur, Indie Hackers, Small Business Subreddit

#### Persona 3: Independent Contractor (1099)
- **Demographics:** 25-40 years old, freelance developer/designer, $60-120k income
- **Pain Points:**
  - Clients don't want to sign NDAs ("too formal")
  - Needs simple contract templates for $5k-$20k projects
  - Worried about scope creep (needs clear SOW language)
- **Buying Behavior:** Buys templates as needed; prefers à la carte over bundles
- **Channels:** Twitter (indie dev community), Hacker News, ProductHunt

---

## 2. Value Proposition

### 2.1. Core Message

**"Legal documents that never leave your device. Generate contracts in seconds, not hours—without trusting a third party with your data."**

### 2.2. Differentiation

| Competitor | ELV Advantage |
|------------|---------------|
| **LegalZoom** | $299/document + subscription; ELV is $9-$29 one-time |
| **Rocket Lawyer** | $40/month subscription; ELV has no recurring fees |
| **Google Docs templates** | No encryption; ELV is zero-knowledge |
| **Clio (practice management)** | $39-$129/month; ELV is document-only (no bloat) |

---

## 3. Pricing Strategy

### 3.1. Individual Templates

| Template | Price | Rationale |
|----------|-------|-----------|
| Simple NDA | $9 | Entry-level; impulse buy |
| Mutual NDA | $12 | Slightly more complex |
| Independent Contractor Agreement | $19 | Mid-tier |
| Operating Agreement (LLC) | $29 | High value (replaces $500+ lawyer fee) |
| Bylaws (Corp) | $29 | High value |
| Commercial Lease | $24 | Mid-tier |
| Residential Lease | $14 | Entry-level |
| Employment Agreement | $24 | Mid-tier |
| Offer Letter | $9 | Entry-level |
| Therapist Intake Form | $12 | Entry-level |

### 3.2. Bundles

| Bundle | Templates | Price | Savings |
|--------|-----------|-------|---------|
| **Therapist Kit** | 5 templates | $149 | $20 off |
| **Startup Kit** | 5 templates | $249 | $30 off |
| **Landlord Kit** | 3 templates | $99 | $15 off |

### 3.3. Pro Tier (Year 2)

**Price:** $19/month or $199/year

**Features:**
- Unlimited document generations
- Early access to new templates
- Priority support
- AI clause generation (experimental)

---

## 4. Launch Strategy

### 4.1. Pre-Launch (Weeks -8 to -1)

**Goals:**
- Build email waitlist (target: 500 signups)
- Generate buzz on social media
- Get beta testers (50 users)

**Tactics:**
1. **Landing page** – Simple one-pager explaining ELV
2. **ProductHunt teaser** – "We're launching in 8 weeks. Join waitlist."
3. **Twitter thread** – Founder story ("I paid $2k for legal docs; built ELV to fix this")
4. **Reddit AMAs** – r/Entrepreneur, r/LegalAdvice (careful with UPL disclaimers)
5. **Beta program** – Invite 50 users; offer free templates for feedback

**Budget:** $500 (landing page ads on Facebook)

### 4.2. Launch (Week 0)

**Goals:**
- 100 paying customers in first week
- $2,000 MRR (Monthly Recurring Revenue)
- ProductHunt #1 Product of the Day

**Tactics:**
1. **ProductHunt launch** – Post at 12:01 AM PT (max visibility)
2. **Press release** – Submit to TechCrunch, VentureBeat (likely ignored; worth a shot)
3. **Social media blitz** – Twitter, LinkedIn, Reddit (coordinated posts)
4. **Email waitlist** – "ELV is live! 20% off for first 100 customers"
5. **Influencer outreach** – DM 10 micro-influencers in legal/entrepreneur space

**Budget:** $1,000 (ProductHunt "Ship" subscription for email capture)

### 4.3. Post-Launch (Weeks 1-12)

**Goals:**
- Grow to 500 customers by Week 12
- Achieve $10,000 MRR
- Refine product based on feedback

**Tactics:**
1. **Content marketing** – Publish 2 blog posts/week (SEO-optimized)
   - "How to Form an LLC in California (Step-by-Step)"
   - "NDA vs. Non-Compete: What's the Difference?"
2. **SEO** – Target long-tail keywords ("free operating agreement template")
3. **Paid ads** – Google Ads ($500/month budget)
   - Keywords: "LLC operating agreement", "NDA template", "therapist intake form"
4. **Partnerships** – Partner with therapist directories (Psychology Today, GoodTherapy)
5. **Referral program** – "Refer a friend, get $10 credit"

**Budget:** $2,000/month (ads + tools)

---

## 5. Marketing Channels

### 5.1. Organic (No Spend)

#### SEO (Search Engine Optimization)

**Target Keywords:**
- "LLC operating agreement template" (5,400 searches/month)
- "simple NDA template" (2,900 searches/month)
- "therapist intake form" (1,600 searches/month)

**Content Strategy:**
- Publish 50 blog posts (one per keyword)
- Link to relevant templates in each post
- Optimize for featured snippets (answer boxes)

#### Social Media

**Platforms:**
- **Twitter:** Daily tips on legal documents, entrepreneurship
- **LinkedIn:** Weekly long-form posts (founder story, legal tips)
- **Reddit:** Weekly participation in r/Entrepreneur, r/legaladvice

**Content Themes:**
- "Common mistakes in NDAs"
- "How I built ELV in 6 months"
- "Why zero-knowledge encryption matters"

#### Community Building

**Tactics:**
- Create Slack/Discord community for users
- Host monthly "Office Hours" (Q&A on legal docs)
- Feature user success stories ("How ELV saved me $2k")

### 5.2. Paid (Spend Required)

#### Google Ads

**Budget:** $500/month

**Campaign Structure:**
- Campaign 1: High-intent keywords ("buy NDA template")
- Campaign 2: Informational keywords ("what is an operating agreement")
- Campaign 3: Competitor keywords ("LegalZoom alternative")

**Expected Metrics:**
- CTR: 5%
- CPC: $1.50
- Conversion rate: 10%
- Cost per acquisition (CPA): $15

#### Facebook/Instagram Ads

**Budget:** $300/month

**Targeting:**
- Therapists (interests: HIPAA, private practice)
- Small business owners (interests: entrepreneurship, LLC formation)
- Freelancers (interests: freelancing, contracts)

**Ad Creative:**
- Video testimonial ("ELV saved me $1,500")
- Carousel ad (showcase 5 templates)
- Static image (before/after: "Old way: $500 lawyer. New way: $29 ELV")

#### Influencer Partnerships

**Budget:** $200/post (micro-influencers with 10k-50k followers)

**Target Influencers:**
- Therapist coaches (Instagram)
- Entrepreneur YouTubers (e.g., Ali Abdaal, Pat Flynn)
- Legal YouTubers (e.g., LegalEagle)

---

## 6. Sales Funnel

### 6.1. Awareness → Interest

**Touchpoints:**
- SEO blog post → Template detail page
- Twitter post → Landing page
- Reddit comment → "Free sample template" lead magnet

**Goal:** Capture email (10% conversion rate)

### 6.2. Interest → Consideration

**Touchpoints:**
- Email drip campaign (5 emails over 2 weeks)
  - Email 1: "Welcome to ELV. Here's how it works."
  - Email 2: "Case study: How Jane saved $1,500 with ELV."
  - Email 3: "Free sample: Download our Simple NDA."
  - Email 4: "Limited offer: 20% off your first template."
  - Email 5: "Last chance: Offer expires tonight!"

**Goal:** Drive to template purchase (5% conversion rate)

### 6.3. Consideration → Purchase

**Touchpoints:**
- Template detail page (clear CTA: "Buy Now")
- Trust signals (testimonials, security badges)
- Pricing transparency (no hidden fees)

**Goal:** Complete Stripe checkout (80% conversion rate from cart to purchase)

### 6.4. Purchase → Retention

**Touchpoints:**
- Post-purchase email ("How to use your template")
- Extension onboarding (in-app tutorial)
- Upsell email (2 weeks later: "You bought Simple NDA. Consider Mutual NDA.")

**Goal:** Repeat purchase within 90 days (20% repeat rate)

---

## 7. Metrics & KPIs

### 7.1. North Star Metric

**Revenue** (MRR for subscriptions; Total Revenue for one-time sales)

### 7.2. Key Metrics

| Metric | Target (Month 1) | Target (Month 12) |
|--------|------------------|-------------------|
| **Website Visitors** | 5,000 | 50,000 |
| **Email Signups** | 500 | 10,000 |
| **Paying Customers** | 100 | 2,000 |
| **Total Revenue** | $2,000 | $50,000 |
| **Avg Revenue Per Customer** | $20 | $25 |
| **Customer Acquisition Cost (CAC)** | $20 | $15 |
| **Lifetime Value (LTV)** | $40 | $75 |
| **LTV:CAC Ratio** | 2:1 | 5:1 |

### 7.3. Dashboard

**Tools:**
- **Analytics:** Google Analytics 4, Plausible
- **A/B Testing:** Optimizely, VWO
- **Heatmaps:** Hotjar

**Weekly Review:**
- Traffic sources (which channels are converting?)
- Conversion rates (where are users dropping off?)
- Customer feedback (what features do users want?)

---

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **UPL lawsuit** | Low | High | Disclaimer on every page; "not legal advice" |
| **Low adoption** | Medium | High | Pivot to different verticals (therapists → landlords) |
| **Competitor launches similar product** | Medium | Medium | Focus on zero-knowledge encryption as moat |
| **Chrome rejects extension** | Low | High | Follow Manifest V3 guidelines; submit early for review |

---

## 9. Open Questions

| Question | Options | Recommendation |
|----------|---------|----------------|
| **Offer free tier?** | Yes (1 free template) vs. No | Yes; drive signups |
| **Launch on ProductHunt before ready?** | Yes (early traction) vs. No (polish first) | No; one shot at PH |
| **Focus on one vertical?** | Therapists only vs. Broad appeal | Therapists; easier to target |

---

## 10. Conclusion

This GTM plan prioritizes:
1. **Therapist vertical** – Easiest to reach; strong pain point (HIPAA)
2. **SEO + content** – Long-term growth engine
3. **ProductHunt launch** – Spike in early customers

**Critical Path:**
1. Build email waitlist (500 signups before launch)
2. Launch on ProductHunt (target #1 Product of the Day)
3. Publish 50 SEO blog posts (within 6 months)
4. Achieve $10k MRR by Month 12
```

---

## 13_FINANCIAL_PROJECTIONS.md

```markdown
# Financial Projections (3-Year Model)

## 1. Revenue Model

### 1.1. Revenue Streams

| Stream | Pricing | Year 1 Target | Year 2 Target | Year 3 Target |
|--------|---------|---------------|---------------|---------------|
| **Individual Templates** | $9-$29 | $40,000 | $150,000 | $300,000 |
| **Bundles** | $99-$249 | $10,000 | $50,000 | $100,000 |
| **Pro Subscription** | $19/month | $0 | $30,000 | $120,000 |
| **Enterprise (Therapist Groups)** | $500/year | $0 | $10,000 | $50,000 |
| **Total Revenue** | | **$50,000** | **$240,000** | **$570,000** |

---

## 2. Unit Economics

### 2.1. Customer Acquisition Cost (CAC)

**Formula:** Total marketing spend / New customers

**Year 1:**
- Marketing spend: $15,000
- New customers: 1,000
- **CAC: $15**

**Year 2:**
- Marketing spend: $50,000
- New customers: 3,000
- **CAC: $17**

### 2.2. Lifetime Value (LTV)

**Formula:** Avg revenue per customer × Repeat rate × Customer lifespan

**Year 1:**
- Avg revenue per customer: $25
- Repeat rate: 20% (1 additional purchase in first year)
- **LTV: $30**

**Year 2:**
- Avg revenue per customer: $40
- Repeat rate: 30% (1.5 additional purchases)
- **LTV: $52**

### 2.3. LTV:CAC Ratio

**Year 1:** $30 / $15 = **2:1** (breakeven is good; prefer 3:1)
**Year 2:** $52 / $17 = **3:1** (healthy)

---

## 3. Cost Structure

### 3.1. Fixed Costs (Monthly)

| Category | Month 1 | Month 12 | Month 24 |
|----------|---------|----------|----------|
| **Hosting (Vercel, Supabase, S3)** | $50 | $200 | $500 |
| **Tools (Clerk, Stripe, etc.)** | $100 | $150 | $300 |
| **Legal/Compliance** | $200 | $300 | $500 |
| **Founder Salary** | $0 | $3,000 | $8,000 |
| **Total Fixed Costs** | **$350** | **$3,650** | **$9,300** |

### 3.2. Variable Costs

| Category | Per Unit | Year 1 | Year 2 |
|----------|----------|--------|--------|
| **Stripe Fees (2.9% + $0.30)** | ~$1 per $25 sale | $1,000 | $6,000 |
| **Payment Processing** | 3% of revenue | $1,500 | $7,200 |
| **Total Variable Costs** | | **$2,500** | **$13,200** |

### 3.3. Total Costs

**Year 1:** $350/mo × 12 + $2,500 = **$6,700**
**Year 2:** $3,650/mo × 12 + $13,200 = **$57,000**

---

## 4. Profit & Loss

### 4.1. Year 1

| Category | Amount |
|----------|--------|
| **Revenue** | $50,000 |
| **Cost of Goods Sold (COGS)** | $2,500 |
| **Gross Profit** | $47,500 |
| **Operating Expenses** | $4,200 |
| **Net Profit** | **$43,300** |

### 4.2. Year 2

| Category | Amount |
|----------|--------|
| **Revenue** | $240,000 |
| **COGS** | $13,200 |
| **Gross Profit** | $226,800 |
| **Operating Expenses** | $43,800 |
| **Net Profit** | **$183,000** |

### 4.3. Year 3

| Category | Amount |
|----------|--------|
| **Revenue** | $570,000 |
| **COGS** | $30,000 |
| **Gross Profit** | $540,000 |
| **Operating Expenses** | $120,000 |
| **Net Profit** | **$420,000** |

---

## 5. Cash Flow

### 5.1. Runway

**Initial Investment:** $10,000 (from founder)

**Burn Rate (Year 1, Months 1-6):** ~$500/month (fixed costs only; pre-revenue)

**Runway:** $10,000 / $500 = **20 months**

**Breakeven Month:** Month 4 (assuming launch in Month 3; first revenue in Month 4)

---

## 6. Sensitivity Analysis

### 6.1. Best Case (Optimistic)

**Assumptions:**
- 2x customers (viral growth from ProductHunt)
- 1.5x avg revenue per customer (more bundle sales)

**Year 1 Revenue:** $50k × 2 × 1.5 = **$150,000**

### 6.2. Worst Case (Pessimistic)

**Assumptions:**
- 0.5x customers (poor launch; low adoption)
- 0.8x avg revenue per customer (only cheap templates sell)

**Year 1 Revenue:** $50k × 0.5 × 0.8 = **$20,000**

---

## 7. Conclusion

**Key Takeaway:** ELV is cash-flow positive from Month 4; no need for outside funding if launch goes well.

**Break-Even Analysis:**
- **Fixed Costs (Year 1):** $4,200
- **Revenue Needed:** $4,200 / (1 - 0.05 COGS) ≈ **$4,400**
- **Customers Needed:** $4,400 / $25 avg = **175 customers**

**Critical Milestones:**
- Month 3: Launch (ProductHunt)
- Month 4: 100 customers (break-even)
- Month 12: 1,000 customers ($50k revenue)
```

---

## 14_ROADMAP.md

```markdown
# Product Roadmap (3-Year Plan)

## Year 1: MVP & Launch

### Q1: Build MVP

**Goal:** Ship functional extension + web app

**Deliverables:**
1. Browser extension (Manifest V3)
   - Vault unlock/lock
   - Field encryption/decryption
   - DOCX merge (docxtemplater)
2. Web app (Next.js)
   - Marketplace (browse/search templates)
   - Template detail pages
   - Stripe checkout
3. Initial 10 templates
4. Infrastructure (Supabase, S3, Vercel)

**Team:** Solo founder (full-stack dev)

**Budget:** $3,000 (tools, hosting, legal consultation)

### Q2: Beta Testing & Launch

**Goal:** 100 paying customers

**Tasks:**
1. Recruit 50 beta testers
2. Launch on ProductHunt
3. Publish 20 SEO blog posts
4. Set up Google Ads ($500/month)
5. Implement analytics (Plausible)

**Metrics:**
- 100 customers
- $2,000 revenue
- 10,000 website visits

### Q3: Growth & Iteration

**Goal:** 500 customers

**Tasks:**
1. Add 10 more templates (20 total)
2. Launch bundles (Therapist Kit, Startup Kit)
3. Implement referral program
4. Partner with 3 therapist directories
5. Publish 30 more SEO blog posts

**Metrics:**
- 500 customers
- $10,000 revenue
- 50,000 website visits

### Q4: Feature Expansion

**Goal:** 1,000 customers

**Tasks:**
1. Add form autofill ("Trojan Horse")
2. Implement vault export (GDPR compliance)
3. Add recovery key feature
4. Launch email drip campaign
5. Hire part-time content writer

**Metrics:**
- 1,000 customers
- $25,000 revenue
- 100,000 website visits

---

## Year 2: Scale & Profitability

### Q1: Pro Tier Launch

**Goal:** 100 Pro subscribers

**Tasks:**
1. Build Pro features (unlimited generations, AI clauses)
2. Launch Pro tier ($19/month)
3. Migrate 50 high-usage customers to Pro
4. Add 20 more templates (40 total)
5. Hire full-time engineer

**Metrics:**
- 2,000 total customers
- 100 Pro subscribers
- $40,000 revenue (Q1)

### Q2: Enterprise Tier

**Goal:** 10 enterprise customers (therapist groups)

**Tasks:**
1. Build enterprise features (SSO, team management)
2. Outreach to 100 therapist groups
3. Close 10 enterprise deals ($500/year each)
4. Add 10 healthcare-specific templates
5. Hire part-time sales rep

**Metrics:**
- 3,000 total customers
- 200 Pro subscribers
- $70,000 revenue (Q2)

### Q3: Mobile App (iOS)

**Goal:** 500 mobile users

**Tasks:**
1. Build iOS app (React Native)
2. Port vault encryption to mobile
3. Launch on App Store
4. Add mobile-specific features (Face ID unlock)
5. Hire UI/UX designer

**Metrics:**
- 4,000 total customers
- 300 Pro subscribers
- $100,000 revenue (Q3)

### Q4: Partnerships

**Goal:** 20 partnerships

**Tasks:**
1. Partner with 10 more therapist directories
2. Partner with 5 business formation services
3. Integrate with Zapier (automate workflows)
4. Add 10 more templates (50 total)
5. Hire content strategist

**Metrics:**
- 5,000 total customers
- 400 Pro subscribers
- $130,000 revenue (Q4)

---

## Year 3: Market Leadership

### Q1: AI Integration

**Goal:** 1,000 AI clause generations

**Tasks:**
1. Integrate GPT-4 for clause generation
2. Train custom model on legal templates
3. Launch AI feature for Pro users
4. Add UPL safeguards (human review required)
5. Hire AI/ML engineer

**Metrics:**
- 7,000 total customers
- 600 Pro subscribers
- $180,000 revenue (Q1)

### Q2: International Expansion

**Goal:** 500 international customers

**Tasks:**
1. Add UK templates (10 templates)
2. Add Canadian templates (10 templates)
3. Translate web app to Spanish, French
4. Partner with international directories
5. Hire customer success manager

**Metrics:**
- 10,000 total customers
- 800 Pro subscribers
- $230,000 revenue (Q2)

### Q3: Template Marketplace (UGC)

**Goal:** 50 user-created templates

**Tasks:**
1. Build template editor (admin + users)
2. Implement revenue share (70/30 split)
3. Launch template marketplace
4. Recruit 100 template creators
5. Hire community manager

**Metrics:**
- 15,000 total customers
- 1,000 Pro subscribers
- $300,000 revenue (Q3)

### Q4: Exit Strategy

**Goal:** Prepare for acquisition or Series A

**Tasks:**
1. Compile investor deck
2. Reach out to strategic acquirers (LegalZoom, Clio)
3. Hire CFO (fractional)
4. Audit financials
5. Decide: Bootstrap to $10M ARR or raise Series A?

**Metrics:**
- 20,000 total customers
- 1,200 Pro subscribers
- $400,000 revenue (Q4)

---

## Conclusion

This roadmap prioritizes:
1. **Year 1:** MVP + Launch (solo founder, <$10k spend)
2. **Year 2:** Scale + Profitability (hire 3-5 people, $200k revenue)
3. **Year 3:** Market Leadership (hire 10+ people, $1M+ revenue)

**Key Decision Points:**
- **End of Year 1:** Pivot if <500 customers (change vertical or business model)
- **End of Year 2:** Raise funding if growth accelerates (Series A at $5M valuation)
- **End of Year 3:** Exit or bootstrap to $10M ARR
```

---

## SUMMARY OF ALL 14 DOCUMENTS

✅ **Complete ELV Planning Documentation:**

1. Executive Summary
2. Problem Statement
3. Solution Overview
4. Crypto Architecture
5. Data Model
6. User Flows
7. Extension Design (MV3)
8. DOCX Template Spec
9. Web App Architecture
10. API Specification
11. Security Architecture
12. GTM Plan
13. Financial Projections
14. Roadmap

**Total Pages:** ~80 pages of comprehensive planning documentation covering technical architecture, business strategy, go-to-market, and 3-year roadmap.

---

*All planning documents complete!*