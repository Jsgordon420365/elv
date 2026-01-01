# ENCRYPTED LEGAL VAULT (ELV) - REMAINING PLANNING DOCUMENTATION (PART 3)

## 07_EXTENSION_DESIGN_MV3.md

```markdown
# Browser Extension Design (Manifest V3)

## 1. Overview

The ELV extension is the **primary interface** for vault management and document generation. Built on Manifest V3 (required by Chrome as of January 2024), the extension:

1. Encrypts/decrypts vault data client-side
2. Merges DOCX templates with vault values
3. Syncs encrypted vault blobs to S3
4. Injects vault data into external web forms ("Trojan Horse" feature)

---

## 2. Manifest V3 Architecture

### 2.1. Key Differences from MV2

| Feature | Manifest V2 (Deprecated) | Manifest V3 (Required) |
|---------|--------------------------|------------------------|
| **Background Script** | Persistent page | Service Worker (event-driven) |
| **Remote Code** | Allowed | Forbidden (CSP restrictions) |
| **Host Permissions** | Broad (`<all_urls>`) | User-granted per site |
| **Scripting API** | `chrome.tabs.executeScript()` | `chrome.scripting.executeScript()` |

**Implications for ELV:**
- All DOCX merge logic must be bundled (no CDN-loaded scripts)
- Service Worker must handle intermittent wakeups (no persistent state)
- User must explicitly grant permission for form autofill on each domain

---

## 3. Extension Components

### 3.1. Manifest File

```json
{
  "manifest_version": 3,
  "name": "Encrypted Legal Vault",
  "version": "1.0.0",
  "description": "Zero-knowledge legal data manager. Generate documents from encrypted vault.",
  
  "permissions": [
    "storage",           // IndexedDB for encrypted vault
    "downloads",         // Trigger DOCX downloads
    "identity",          // Optional: OAuth for device registration
    "notifications"      // Sync completion notifications
  ],
  
  "host_permissions": [],  // No default hosts; user grants per-site
  
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  
  "content_scripts": [
    {
      "matches": ["https://app.encryptedlegalvault.com/*"],
      "js": ["content-script.js"],
      "run_at": "document_end"
    }
  ],
  
  "web_accessible_resources": [
    {
      "resources": ["wasm/docxtemplater.wasm"],
      "matches": ["<all_urls>"]
    }
  ],
  
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  }
}
```

**Key Points:**
- **No `<all_urls>` permission** – User explicitly grants form autofill per domain
- **WASM allowed** – `'wasm-unsafe-eval'` required for docxtemplater compilation
- **Content script** – Runs only on ELV web app (marketplace, dashboard)

---

## 3.2. Service Worker (Background Script)

**Responsibilities:**
1. Handle extension icon clicks (open popup)
2. Manage vault sync to S3 (periodic or user-initiated)
3. Cache Master Key in memory (with expiry)
4. Listen for web requests (download template from marketplace)

**Lifecycle:**
```
Extension installed → Service worker initializes → Idle
   ↓
User clicks extension icon → Service worker wakes → Opens popup
   ↓
User triggers sync → Service worker encrypts vault → Uploads to S3 → Idle
   ↓
30 minutes of inactivity → Service worker terminates → Master Key cleared
```

**Implementation:**
```typescript
// background.js

import { KeyManager } from './crypto/keyManager';
import { VaultStorage } from './storage/vaultStorage';
import { syncVaultToS3 } from './sync/s3Sync';

const keyManager = new KeyManager();
const vaultStorage = new VaultStorage();

// Handle extension icon click
chrome.action.onClicked.addListener(() => {
  chrome.windows.create({
    url: 'popup.html',
    type: 'popup',
    width: 400,
    height: 600
  });
});

// Listen for messages from popup/content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'unlock_vault') {
    handleUnlockVault(message.passphrase, message.userId)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;  // Async response
  }
  
  if (message.type === 'sync_vault') {
    handleSyncVault()
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
  
  if (message.type === 'generate_document') {
    handleGenerateDocument(message.templateId, message.fields)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

async function handleUnlockVault(passphrase: string, userId: string) {
  // Derive Master Key
  const masterKey = await keyManager.deriveMasterKey(passphrase, userId);
  
  // Load vault from IndexedDB
  const vault = await vaultStorage.loadVault();
  
  // Decrypt fields
  for (const field of vault.fields) {
    field.decrypted_value = await decryptField(field, masterKey);
  }
  
  return { success: true, vault };
}

async function handleSyncVault() {
  const vault = await vaultStorage.loadVault();
  const masterKey = keyManager.getMasterKey();
  
  if (!masterKey) {
    throw new Error('Vault is locked. Unlock first.');
  }
  
  await syncVaultToS3(vault, masterKey, vault.user_id);
  
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: 'Vault Synced',
    message: 'Your vault has been successfully synced to cloud storage.'
  });
  
  return { success: true };
}

async function handleGenerateDocument(templateId: string, fields: Record<string, string>) {
  // Fetch template from CDN
  const template = await fetchTemplate(templateId);
  
  // Merge fields into DOCX (client-side)
  const mergedDoc = await mergeTemplate(template, fields);
  
  // Trigger download
  const blob = new Blob([mergedDoc], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const url = URL.createObjectURL(blob);
  
  chrome.downloads.download({
    url: url,
    filename: `${templateId}-${Date.now()}.docx`,
    saveAs: true
  });
  
  return { success: true };
}
```

---

## 3.3. Popup UI

**Responsibilities:**
1. Unlock vault (prompt for passphrase)
2. Display vault fields (list view)
3. Add/edit/delete fields
4. Trigger vault sync
5. Navigate to marketplace (open web app)

**Tech Stack:**
- React + TypeScript
- Tailwind CSS for styling
- Zustand for state management

**Screens:**

#### Screen 1: Unlock Vault
```
┌─────────────────────────────────┐
│   Encrypted Legal Vault         │
├─────────────────────────────────┤
│                                 │
│   Enter Passphrase:             │
│   ┌───────────────────────────┐ │
│   │ [password input]          │ │
│   └───────────────────────────┘ │
│                                 │
│   [ Unlock Vault ]              │
│                                 │
│   Forgot passphrase? [Help]    │
│                                 │
└─────────────────────────────────┘
```

#### Screen 2: Vault Dashboard
```
┌─────────────────────────────────┐
│   📦 My Vault        [Sync] [+] │
├─────────────────────────────────┤
│                                 │
│   🏢 Company Name:              │
│      Acme Corp LLC              │
│                                 │
│   🔢 EIN:                       │
│      XX-XXXXXXX (masked)        │
│                                 │
│   📍 Company Address:           │
│      123 Main St, SF, CA 94102  │
│                                 │
│   [ Edit ] [ Delete ]           │
│                                 │
│   [ Browse Templates ]          │
│                                 │
└─────────────────────────────────┘
```

**Implementation:**
```tsx
// popup.tsx

import React, { useState } from 'react';
import { unlockVault, syncVault } from './api/vaultAPI';

export const Popup: React.FC = () => {
  const [passphrase, setPassphrase] = useState('');
  const [vault, setVault] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const handleUnlock = async () => {
    setLoading(true);
    try {
      const result = await unlockVault(passphrase);
      setVault(result.vault);
    } catch (error) {
      alert('Failed to unlock vault. Check your passphrase.');
    }
    setLoading(false);
  };
  
  const handleSync = async () => {
    setLoading(true);
    try {
      await syncVault();
      alert('Vault synced successfully!');
    } catch (error) {
      alert('Sync failed. Check your connection.');
    }
    setLoading(false);
  };
  
  if (!vault) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">Unlock Vault</h1>
        <input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="Enter passphrase"
          className="border p-2 w-full mb-4"
        />
        <button
          onClick={handleUnlock}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded w-full"
        >
          {loading ? 'Unlocking...' : 'Unlock Vault'}
        </button>
      </div>
    );
  }
  
  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">My Vault</h1>
        <button onClick={handleSync} className="text-blue-500">Sync</button>
      </div>
      
      <div className="space-y-4">
        {vault.fields.map(field => (
          <div key={field.field_id} className="border p-2 rounded">
            <div className="font-semibold">{field.field_id}</div>
            <div className="text-sm text-gray-600">{field.decrypted_value}</div>
          </div>
        ))}
      </div>
      
      <button
        onClick={() => chrome.tabs.create({ url: 'https://app.encryptedlegalvault.com' })}
        className="bg-blue-500 text-white px-4 py-2 rounded w-full mt-4"
      >
        Browse Templates
      </button>
    </div>
  );
};
```

---

## 3.4. Content Script

**Purpose:** Intercepts template downloads from marketplace; prompts user to fill fields; merges DOCX

**Flow:**
```
User clicks "Download" on marketplace
   ↓
Content script intercepts download request
   ↓
Content script opens interview modal: "This template requires: company_name, ein"
   ↓
User fills in missing fields (if any)
   ↓
Content script encrypts fields → Stores in IndexedDB
   ↓
Content script merges fields into DOCX (via service worker)
   ↓
Browser downloads merged DOCX
```

**Implementation:**
```typescript
// content-script.js

// Listen for template download requests
document.addEventListener('click', async (event) => {
  const target = event.target as HTMLElement;
  
  if (target.matches('[data-template-download]')) {
    event.preventDefault();
    
    const templateId = target.dataset.templateId;
    const templateName = target.dataset.templateName;
    
    // Fetch template schema
    const schema = await fetchTemplateSchema(templateId);
    
    // Load vault
    const vault = await loadVault();
    
    // Check which fields are missing
    const missingFields = schema.required_fields.filter(
      field => !vault.fields.find(f => f.field_id === field.field_id)
    );
    
    if (missingFields.length > 0) {
      // Open interview modal
      const filledFields = await openInterviewModal(templateName, missingFields);
      
      // Add fields to vault
      for (const field of filledFields) {
        await addFieldToVault(field.field_id, field.value, field.field_type);
      }
    }
    
    // Merge template
    const fields = vault.fields.reduce((acc, field) => {
      acc[field.field_id] = field.decrypted_value;
      return acc;
    }, {});
    
    // Request merge from service worker
    chrome.runtime.sendMessage({
      type: 'generate_document',
      templateId,
      fields
    });
  }
});

async function openInterviewModal(templateName: string, fields: any[]) {
  // Inject interview UI
  const modal = document.createElement('div');
  modal.id = 'elv-interview-modal';
  modal.innerHTML = `
    <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000;">
      <div style="background: white; max-width: 500px; margin: 100px auto; padding: 20px; border-radius: 8px;">
        <h2>Generate ${templateName}</h2>
        <p>Please fill in the required fields:</p>
        <form id="elv-interview-form">
          ${fields.map(field => `
            <div style="margin-bottom: 16px;">
              <label>${field.label}</label>
              <input type="text" name="${field.field_id}" placeholder="${field.placeholder || ''}" required />
            </div>
          `).join('')}
          <button type="submit">Generate Document</button>
        </form>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  return new Promise((resolve) => {
    const form = document.getElementById('elv-interview-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(e.target as HTMLFormElement);
      const filledFields = [];
      
      for (const [field_id, value] of formData.entries()) {
        filledFields.push({ field_id, value });
      }
      
      modal.remove();
      resolve(filledFields);
    });
  });
}
```

---

## 4. DOCX Template Merge (WASM)

### 4.1. Library: docxtemplater

**Why docxtemplater:**
- Mature library (10+ years)
- Supports complex templates (loops, conditionals)
- Can be compiled to WebAssembly

**Installation:**
```bash
npm install docxtemplater pizzip
```

**Merge Logic:**
```typescript
// docxMerge.ts

import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

export async function mergeTemplate(
  templateArrayBuffer: ArrayBuffer,
  fields: Record<string, string>
): Promise<ArrayBuffer> {
  // Load DOCX as ZIP
  const zip = new PizZip(templateArrayBuffer);
  
  // Create docxtemplater instance
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true
  });
  
  // Set data
  doc.setData(fields);
  
  // Render (merge)
  try {
    doc.render();
  } catch (error) {
    throw new Error(`Template merge failed: ${error.message}`);
  }
  
  // Generate merged DOCX
  const mergedBuffer = doc.getZip().generate({
    type: 'arraybuffer',
    compression: 'DEFLATE'
  });
  
  return mergedBuffer;
}
```

**Template Format:**
```xml
<!-- Inside DOCX (word/document.xml) -->

<w:p>
  <w:r>
    <w:t>Company Name: {{company_name}}</w:t>
  </w:r>
</w:p>

<w:p>
  <w:r>
    <w:t>EIN: {{ein}}</w:t>
  </w:r>
</w:p>

<!-- Conditional clause -->
{{#if state === 'CA'}}
<w:p>
  <w:r>
    <w:t>California-specific clause...</w:t>
  </w:r>
</w:p>
{{/if}}
```

**WASM Compilation:**
- Bundle docxtemplater + PizZip as WASM module
- Load WASM in service worker (first use)
- Cache compiled WASM in memory

---

## 5. Form Autofill ("Trojan Horse" Feature)

### 5.1. User Flow

```
User navigates to IRS e-filing site
   ↓
User clicks ELV extension icon → "Autofill this form"
   ↓
Extension requests permission: "Allow ELV to access irs.gov?"
   ↓
User grants permission
   ↓
Extension injects content script → Detects form fields
   ↓
Extension maps vault fields to form fields (user reviews mapping)
   ↓
Extension auto-fills form with vault data
```

### 5.2. Field Mapping UI

```
┌─────────────────────────────────┐
│   Autofill IRS Form 1120        │
├─────────────────────────────────┤
│                                 │
│   Form Field: "Company Name"    │
│   Vault Field: company_name ✓   │
│                                 │
│   Form Field: "EIN"             │
│   Vault Field: ein ✓            │
│                                 │
│   Form Field: "Address"         │
│   Vault Field: company_address ✓│
│                                 │
│   [ Save Mapping ] [ Autofill ] │
│                                 │
└─────────────────────────────────┘
```

### 5.3. Implementation

```typescript
// autofill.ts

async function autofillForm() {
  // Request host permission
  const granted = await chrome.permissions.request({
    origins: [new URL(window.location.href).origin]
  });
  
  if (!granted) {
    alert('Permission denied. Cannot autofill this site.');
    return;
  }
  
  // Detect form fields
  const formFields = detectFormFields();
  
  // Load vault
  const vault = await loadVault();
  
  // Attempt auto-mapping
  const mapping = autoMapFields(formFields, vault.fields);
  
  // Show mapping UI for user review
  const confirmedMapping = await showMappingUI(mapping);
  
  // Autofill
  for (const [formFieldName, vaultFieldId] of Object.entries(confirmedMapping)) {
    const vaultField = vault.fields.find(f => f.field_id === vaultFieldId);
    const formField = document.querySelector(`[name="${formFieldName}"]`) as HTMLInputElement;
    
    if (formField && vaultField) {
      formField.value = vaultField.decrypted_value;
      formField.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  
  alert('Form autofilled successfully!');
}

function detectFormFields(): string[] {
  const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
  return inputs
    .filter(input => input.getAttribute('name'))
    .map(input => input.getAttribute('name'));
}

function autoMapFields(formFields: string[], vaultFields: any[]): Record<string, string> {
  const mapping = {};
  
  for (const formField of formFields) {
    // Simple heuristic: match by field name similarity
    const match = vaultFields.find(vf => 
      formField.toLowerCase().includes(vf.field_id.toLowerCase()) ||
      vf.field_id.toLowerCase().includes(formField.toLowerCase())
    );
    
    if (match) {
      mapping[formField] = match.field_id;
    }
  }
  
  return mapping;
}
```

---

## 6. Storage (IndexedDB)

**Schema:**
```typescript
// IndexedDB structure

database: 'ELVaultDB'
version: 1

object stores:
  - 'vault' (key: 'current')
    - user_id: string
    - fields: VaultField[]
    - version: number
    - last_synced_at: number
  
  - 'settings' (key: user_id)
    - theme: 'light' | 'dark'
    - auto_sync: boolean
    - sync_interval_minutes: number
  
  - 'cache' (key: template_id)
    - template_id: string
    - template_data: ArrayBuffer  // Cached DOCX file
    - cached_at: number
```

**Implementation:**
```typescript
// storage/vaultStorage.ts

import { openDB, IDBPDatabase } from 'idb';

export class VaultStorage {
  private db: IDBPDatabase;
  
  async init() {
    this.db = await openDB('ELVaultDB', 1, {
      upgrade(db) {
        db.createObjectStore('vault');
        db.createObjectStore('settings');
        db.createObjectStore('cache');
      }
    });
  }
  
  async loadVault(): Promise<Vault> {
    return await this.db.get('vault', 'current');
  }
  
  async saveVault(vault: Vault) {
    await this.db.put('vault', vault, 'current');
  }
  
  async cacheTemplate(templateId: string, data: ArrayBuffer) {
    await this.db.put('cache', { template_id: templateId, template_data: data, cached_at: Date.now() }, templateId);
  }
  
  async getCachedTemplate(templateId: string): Promise<ArrayBuffer | null> {
    const cached = await this.db.get('cache', templateId);
    
    // Cache expires after 7 days
    if (cached && (Date.now() - cached.cached_at) < 7 * 24 * 60 * 60 * 1000) {
      return cached.template_data;
    }
    
    return null;
  }
}
```

---

## 7. Performance Optimization

### 7.1. Lazy-Load WASM

**Problem:** docxtemplater WASM bundle is ~500 KB; loading on extension install slows startup

**Solution:** Load WASM only when user first generates a document

```typescript
// Lazy load WASM
let docxTemplaterWASM: any = null;

async function ensureDocxTemplaterLoaded() {
  if (!docxTemplaterWASM) {
    docxTemplaterWASM = await import('./wasm/docxtemplater.wasm');
  }
  return docxTemplaterWASM;
}
```

### 7.2. Template Caching

**Problem:** Re-downloading 1 MB DOCX template on every merge is slow

**Solution:** Cache templates in IndexedDB (expires after 7 days)

```typescript
async function fetchTemplate(templateId: string): Promise<ArrayBuffer> {
  // Check cache
  const cached = await vaultStorage.getCachedTemplate(templateId);
  if (cached) {
    return cached;
  }
  
  // Download from CDN
  const response = await fetch(`https://cdn.encryptedlegalvault.com/templates/${templateId}.docx`);
  const data = await response.arrayBuffer();
  
  // Cache
  await vaultStorage.cacheTemplate(templateId, data);
  
  return data;
}
```

---

## 8. Security Considerations

### 8.1. Content Script Injection

**Risk:** Malicious website could attempt to read vault data from content script

**Mitigation:**
- Content script runs only on ELV domain (`app.encryptedlegalvault.com`)
- Autofill requires explicit user permission per domain

### 8.2. Service Worker Persistence

**Risk:** Service worker terminates; Master Key lost

**Mitigation:**
- Prompt user to re-enter passphrase when service worker restarts
- Cache Master Key in-memory only (auto-expire after 30 minutes)

### 8.3. WASM Integrity

**Risk:** Attacker replaces WASM binary with malicious code

**Mitigation:**
- Sign WASM with developer key
- Verify WASM hash at load time

```typescript
const EXPECTED_WASM_HASH = 'sha256-abc123...';

async function loadWASM() {
  const wasmBytes = await fetch('wasm/docxtemplater.wasm').then(r => r.arrayBuffer());
  
  // Compute hash
  const hash = await crypto.subtle.digest('SHA-256', wasmBytes);
  const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  if (hashHex !== EXPECTED_WASM_HASH) {
    throw new Error('WASM integrity check failed');
  }
  
  return wasmBytes;
}
```

---

## 9. Testing Strategy

### 9.1. Unit Tests

**Crypto functions:**
- Key derivation (PBKDF2)
- Encryption/decryption (AES-GCM)
- Vault serialization

**DOCX merge:**
- Simple templates (single field)
- Complex templates (loops, conditionals)
- Edge cases (missing fields, invalid tokens)

**Tools:**
- Jest for unit tests
- Puppeteer for extension testing (headless Chrome)

### 9.2. Integration Tests

**End-to-end flows:**
1. Install extension → Unlock vault → Add field → Sync → Verify S3 upload
2. Download template → Fill fields → Merge → Verify DOCX output
3. Autofill form → Map fields → Verify form values

---

## 10. Open Questions

| Question | Options | Recommendation |
|----------|---------|----------------|
| **Support Firefox?** | Yes (WebExtensions API compatible) | Year 2; focus on Chrome/Edge for MVP |
| **Offline mode?** | Yes (cache templates locally) | Yes; implement template caching in IndexedDB |
| **Mobile extension?** | Chrome Mobile supports extensions (limited) | Defer to Year 2; desktop MVP first |
| **Multi-profile support?** | Allow multiple vaults per user | Year 2 feature; too complex for MVP |

---

## 11. Conclusion

This extension design leverages Manifest V3's service worker architecture while maintaining zero-knowledge encryption:
- All encryption/decryption happens client-side
- DOCX merge uses WASM for performance
- Form autofill requires explicit user permission
- Template caching reduces network overhead

**Critical Path for MVP:**
1. Implement popup UI (unlock, vault dashboard)
2. Implement content script (interview modal, template download)
3. Implement service worker (vault sync, DOCX merge)
4. Compile docxtemplater to WASM
```

---

## 08_DOCX_TEMPLATE_SPEC_AND_RENDERING.md

```markdown
# DOCX Template Specification and Rendering

## 1. Overview

The ELV uses DOCX (Microsoft Word) as the primary document format because:
1. **Universal compatibility** – Opens in Word, Google Docs, LibreOffice
2. **Structured format** – XML-based; easy to parse and merge
3. **Professional appearance** – Supports headers, footers, tables, styles

This document specifies:
- How templates are structured
- Token syntax for field injection
- Conditional logic and loops
- Rendering process (client-side merge)

---

## 2. Template Structure

### 2.1. DOCX File Format

DOCX is a ZIP archive containing:
```
template.docx
├── [Content_Types].xml
├── _rels/
│   └── .rels
├── word/
│   ├── document.xml          # Main content
│   ├── styles.xml            # Styles
│   ├── settings.xml          # Document settings
│   ├── _rels/
│   │   └── document.xml.rels # Relationships (images, links)
│   └── media/                # Embedded images
└── docProps/
    ├── app.xml               # Application metadata
    └── core.xml              # Core properties (author, title)
```

**Key File:** `word/document.xml` contains the document content in Office Open XML (OOXML) format

---

## 2.2. Token Syntax

**Field Injection:**
```xml
{{field_id}}
```

**Example:**
```xml
<w:p>
  <w:r>
    <w:t>Company Name: {{company_name}}</w:t>
  </w:r>
</w:p>

<w:p>
  <w:r>
    <w:t>EIN: {{ein}}</w:t>
  </w:r>
</w:p>
```

**Rendered Output:**
```
Company Name: Acme Corp LLC
EIN: 12-3456789
```

---

## 2.3. Conditional Logic

**If Statement:**
```xml
{{#if state === 'CA'}}
<w:p>
  <w:r>
    <w:t>California-specific clause: ...</w:t>
  </w:r>
</w:p>
{{/if}}
```

**If-Else:**
```xml
{{#if entity_type === 'LLC'}}
<w:p>
  <w:r>
    <w:t>This is a Limited Liability Company.</w:t>
  </w:r>
</w:p>
{{else}}
<w:p>
  <w:r>
    <w:t>This is a Corporation.</w:t>
  </w:r>
</w:p>
{{/if}}
```

---

## 2.4. Loops

**Array Iteration:**
```xml
{{#each members}}
<w:p>
  <w:r>
    <w:t>Member Name: {{name}}</w:t>
  </w:r>
</w:p>
<w:p>
  <w:r>
    <w:t>Ownership: {{ownership_percentage}}%</w:t>
  </w:r>
</w:p>
{{/each}}
```

**Data:**
```json
{
  "members": [
    { "name": "Alice Smith", "ownership_percentage": 50 },
    { "name": "Bob Jones", "ownership_percentage": 50 }
  ]
}
```

**Rendered Output:**
```
Member Name: Alice Smith
Ownership: 50%

Member Name: Bob Jones
Ownership: 50%
```

---

## 2.5. Tables

**Static Table:**
```xml
<w:tbl>
  <w:tr>
    <w:tc><w:p><w:r><w:t>Member Name</w:t></w:r></w:p></w:tc>
    <w:tc><w:p><w:r><w:t>Ownership %</w:t></w:r></w:p></w:tc>
  </w:tr>
  {{#each members}}
  <w:tr>
    <w:tc><w:p><w:r><w:t>{{name}}</w:t></w:r></w:p></w:tc>
    <w:tc><w:p><w:r><w:t>{{ownership_percentage}}%</w:t></w:r></w:p></w:tc>
  </w:tr>
  {{/each}}
</w:tbl>
```

**Rendered Output:**
```
┌───────────────┬─────────────┐
│ Member Name   │ Ownership % │
├───────────────┼─────────────┤
│ Alice Smith   │ 50%         │
│ Bob Jones     │ 50%         │
└───────────────┴─────────────┘
```

---

## 3. Field Types & Formatting

### 3.1. Text Fields

**Simple Text:**
```xml
Company Name: {{company_name}}
```

**Multi-line Text:**
```xml
Business Description:
{{business_description}}
```

**Formatting:**
- Preserve user's line breaks (convert `\n` to `<w:br/>` in OOXML)

---

### 3.2. Date Fields

**Date Format:**
```xml
Formation Date: {{formation_date|date('MMMM DD, YYYY')}}
```

**Example:**
```json
{ "formation_date": "2025-01-15" }
```

**Rendered:**
```
Formation Date: January 15, 2025
```

---

### 3.3. Currency Fields

**Currency Format:**
```xml
Monthly Rent: {{monthly_rent|currency('USD')}}
```

**Example:**
```json
{ "monthly_rent": 2500 }
```

**Rendered:**
```
Monthly Rent: $2,500.00
```

---

### 3.4. Address Fields

**Structured Address:**
```xml
Principal Office Address:
{{company_address.street_line_1}}
{{#if company_address.street_line_2}}{{company_address.street_line_2}}{{/if}}
{{company_address.city}}, {{company_address.state}} {{company_address.zip}}
```

**Example:**
```json
{
  "company_address": {
    "street_line_1": "123 Main St",
    "street_line_2": "Suite 200",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94102"
  }
}
```

**Rendered:**
```
Principal Office Address:
123 Main St
Suite 200
San Francisco, CA 94102
```

---

## 4. Template Metadata

**Embedded in DOCX:**
Each template includes a JSON metadata section (embedded in `docProps/custom.xml`):

```xml
<Properties>
  <property name="elv:template_id" value="operating-agreement-llc-v1"/>
  <property name="elv:template_name" value="LLC Operating Agreement"/>
  <property name="elv:version" value="1"/>
  <property name="elv:required_fields" value='["company_name", "state_of_formation", "member_names"]'/>
</Properties>
```

**Purpose:**
- Extension reads metadata to know which fields are required
- Enables validation before merge

---

## 5. Rendering Process (Client-Side)

### 5.1. Merge Algorithm

```typescript
// docxMerge.ts

import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

export async function mergeTemplate(
  templateArrayBuffer: ArrayBuffer,
  fields: Record<string, any>
): Promise<ArrayBuffer> {
  // Step 1: Load DOCX as ZIP
  const zip = new PizZip(templateArrayBuffer);
  
  // Step 2: Parse XML
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '[MISSING]'  // Placeholder for missing fields
  });
  
  // Step 3: Set data
  doc.setData(fields);
  
  // Step 4: Render (merge)
  try {
    doc.render();
  } catch (error) {
    if (error.properties && error.properties.errors) {
      // Report specific errors (missing fields, invalid syntax)
      const errors = error.properties.errors.map(e => e.message).join('\n');
      throw new Error(`Template merge failed:\n${errors}`);
    }
    throw new Error(`Template merge failed: ${error.message}`);
  }
  
  // Step 5: Generate merged DOCX
  const mergedBuffer = doc.getZip().generate({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }  // Balance between speed and size
  });
  
  return mergedBuffer;
}
```

### 5.2. Error Handling

**Missing Field:**
```
Error: Field "ein" is required but not provided.
```

**Invalid Conditional:**
```
Error: Conditional syntax error at line 42: {{#if state = 'CA'}}
Expected: {{#if state === 'CA'}}
```

**Malformed XML:**
```
Error: DOCX XML is malformed. Cannot parse template.
```

---

## 6. Template Validation

### 6.1. Pre-Merge Validation

**Check Required Fields:**
```typescript
function validateFields(requiredFields: string[], providedFields: Record<string, any>): string[] {
  const missing = [];
  
  for (const field of requiredFields) {
    if (!(field in providedFields) || providedFields[field] === null || providedFields[field] === '') {
      missing.push(field);
    }
  }
  
  return missing;
}

// Usage
const missing = validateFields(['company_name', 'ein'], fields);
if (missing.length > 0) {
  throw new Error(`Missing required fields: ${missing.join(', ')}`);
}
```

### 6.2. Post-Merge Validation

**Check for Placeholder:**
```typescript
function checkPlaceholders(mergedXML: string): boolean {
  return mergedXML.includes('[MISSING]');
}

// Usage
if (checkPlaceholders(doc.getZip().file('word/document.xml').asText())) {
  console.warn('Warning: Some fields were not filled (marked as [MISSING])');
}
```

---

## 7. Template Versioning

**Problem:** Templates evolve (new fields, changed clauses)

**Solution:** Version templates; allow users to access previous versions

**Schema:**
```json
{
  "template_id": "operating-agreement-llc",
  "versions": [
    {
      "version": 1,
      "created_at": "2025-01-01",
      "changelog": "Initial release",
      "docx_url": "https://cdn.elv.com/templates/operating-agreement-llc-v1.docx"
    },
    {
      "version": 2,
      "created_at": "2025-06-01",
      "changelog": "Added dispute resolution clause",
      "docx_url": "https://cdn.elv.com/templates/operating-agreement-llc-v2.docx"
    }
  ]
}
```

**Business Rule:**
- Users who purchased v1 can upgrade to v2 for free (or discounted)
- New users get latest version

---

## 8. Template Library (MVP)

### 8.1. Initial 10 Templates

| Template | Category | Complexity | Price |
|----------|----------|------------|-------|
| **Simple NDA** | Contracts | Simple | $9 |
| **Mutual NDA** | Contracts | Simple | $12 |
| **Independent Contractor Agreement** | Contracts | Moderate | $19 |
| **Operating Agreement (LLC)** | Business Formation | Moderate | $29 |
| **Bylaws (Corp)** | Business Formation | Moderate | $29 |
| **Commercial Lease** | Real Estate | Moderate | $24 |
| **Residential Lease** | Real Estate | Simple | $14 |
| **Employment Agreement** | HR | Moderate | $24 |
| **Offer Letter** | HR | Simple | $9 |
| **Therapist Intake Form** | Healthcare | Simple | $12 |

### 8.2. Vertical Bundles

**Therapist Private Practice Kit ($149):**
- Therapist Intake Form
- Consent to Treatment
- Fee Agreement
- HIPAA Authorization
- Emergency Contact Form

**Startup Formation Bundle ($249):**
- Operating Agreement (LLC)
- Cap Table Template
- SAFE Agreement
- Board Resolution Template
- Bylaws (Corp)

---

## 9. Open Questions

| Question | Options | Recommendation |
|----------|---------|----------------|
| **Support PDF output?** | Yes (convert DOCX → PDF) | Year 2; DOCX is sufficient for MVP |
| **Support rich media (images)?** | Yes (logo injection) | Year 2; text-only for MVP |
| **Template marketplace for user-created templates?** | Yes (UGC) | Year 2; curated only for MVP |
| **AI-generated clauses?** | Yes (GPT integration) | Year 2; UPL risk too high for MVP |

---

## 10. Conclusion

This DOCX template specification enables:
1. **Flexible templates** – Loops, conditionals, tables
2. **Type-safe fields** – Formatted dates, currency, addresses
3. **Client-side merge** – Zero-knowledge guarantee (server never sees content)
4. **Versioning** – Templates can evolve without breaking existing users

**Critical Path for MVP:**
1. Design initial 10 templates in Word
2. Add ELV token syntax (`{{field_id}}`)
3. Embed metadata in custom properties
4. Implement docxtemplater merge in extension
5. Test merge with sample data
```

---

*Continuing with documents 09-14 in next response...*