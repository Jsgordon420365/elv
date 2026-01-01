# ENCRYPTED LEGAL VAULT (ELV) - REMAINING PLANNING DOCUMENTATION (PART 4)

## 09_WEB_APP_ARCHITECTURE.md

```markdown
# Web Application Architecture

## 1. Overview

The ELV web app serves as the **marketplace and dashboard**:
1. **Marketplace** – Browse/purchase templates
2. **Dashboard** – Manage account, view order history
3. **Template Editor** – (Admin only) Create/edit templates

**Tech Stack:**
- **Frontend:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Next.js API routes (serverless)
- **Database:** PostgreSQL (via Supabase)
- **Auth:** Clerk (passwordless, OAuth)
- **Payments:** Stripe
- **Hosting:** Vercel
- **CDN:** Cloudflare R2 (template storage)

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                        Vercel Edge                      │
│  ┌───────────────────────────────────────────────────┐ │
│  │   Next.js 14 (App Router)                         │ │
│  │   ┌──────────────┐  ┌──────────────┐             │ │
│  │   │ Marketplace  │  │  Dashboard   │             │ │
│  │   │    /browse   │  │   /account   │             │ │
│  │   └──────────────┘  └──────────────┘             │ │
│  │                                                    │ │
│  │   API Routes:                                     │ │
│  │   • POST /api/checkout → Stripe                  │ │
│  │   • GET  /api/templates → Supabase               │ │
│  │   • POST /api/purchases → Supabase + S3          │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
           │                    │                  │
           ▼                    ▼                  ▼
    ┌─────────────┐    ┌──────────────┐   ┌──────────────┐
    │   Stripe    │    │  Supabase    │   │ Cloudflare   │
    │  (Payments) │    │ (PostgreSQL) │   │ R2 (Templates)│
    └─────────────┘    └──────────────┘   └──────────────┘
```

---

## 3. Frontend Architecture

### 3.1. File Structure

```
src/
├── app/
│   ├── (marketing)/
│   │   ├── page.tsx                 # Homepage
│   │   ├── about/page.tsx           # About page
│   │   └── pricing/page.tsx         # Pricing page
│   ├── (marketplace)/
│   │   ├── browse/page.tsx          # Template marketplace
│   │   ├── template/[id]/page.tsx   # Template detail page
│   │   └── checkout/page.tsx        # Stripe checkout
│   ├── (dashboard)/
│   │   ├── account/page.tsx         # User account dashboard
│   │   ├── purchases/page.tsx       # Order history
│   │   └── settings/page.tsx        # User settings
│   ├── api/
│   │   ├── checkout/route.ts        # Stripe Checkout Session
│   │   ├── webhook/route.ts         # Stripe Webhooks
│   │   ├── templates/route.ts       # Fetch templates
│   │   └── purchases/route.ts       # Record purchases
│   └── layout.tsx                   # Root layout (navbar, footer)
├── components/
│   ├── ui/                          # Shadcn UI components
│   ├── TemplateCard.tsx             # Template preview card
│   ├── PurchaseButton.tsx           # Buy button (Stripe)
│   └── Navbar.tsx                   # Navigation bar
├── lib/
│   ├── db.ts                        # Supabase client
│   ├── stripe.ts                    # Stripe client
│   └── utils.ts                     # Helper functions
└── types/
    ├── template.ts                  # Template types
    └── user.ts                      # User types
```

### 3.2. Key Pages

#### 3.2.1. Marketplace (`/browse`)

**Purpose:** Display all available templates

**UI:**
```
┌────────────────────────────────────────────────────┐
│  Encrypted Legal Vault          [Login] [Sign Up] │
├────────────────────────────────────────────────────┤
│                                                    │
│  Browse Legal Templates                           │
│                                                    │
│  [All] [Business] [Contracts] [Real Estate] [HR]  │
│                                                    │
│  ┌──────────────┐  ┌──────────────┐              │
│  │ Simple NDA   │  │ Mutual NDA   │              │
│  │ $9           │  │ $12          │              │
│  │ [View]       │  │ [View]       │              │
│  └──────────────┘  └──────────────┘              │
│                                                    │
│  ┌──────────────┐  ┌──────────────┐              │
│  │ LLC Op. Agr. │  │ Corp Bylaws  │              │
│  │ $29          │  │ $29          │              │
│  │ [View]       │  │ [View]       │              │
│  └──────────────┘  └──────────────┘              │
│                                                    │
└────────────────────────────────────────────────────┘
```

**Implementation:**
```tsx
// app/(marketplace)/browse/page.tsx

import { createClient } from '@/lib/db';
import { TemplateCard } from '@/components/TemplateCard';

export default async function BrowsePage() {
  const supabase = createClient();
  
  const { data: templates } = await supabase
    .from('templates')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Browse Legal Templates</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {templates?.map(template => (
          <TemplateCard key={template.id} template={template} />
        ))}
      </div>
    </div>
  );
}
```

#### 3.2.2. Template Detail (`/template/[id]`)

**Purpose:** Show template details, preview, purchase button

**UI:**
```
┌────────────────────────────────────────────────────┐
│  Operating Agreement (LLC)                         │
├────────────────────────────────────────────────────┤
│                                                    │
│  $29                                              │
│                                                    │
│  ⭐⭐⭐⭐⭐ 4.8 (124 reviews)                      │
│                                                    │
│  This comprehensive operating agreement           │
│  covers:                                          │
│  • Member rights and responsibilities             │
│  • Capital contributions                          │
│  • Profit distribution                            │
│  • Dissolution procedures                         │
│                                                    │
│  Required Fields:                                 │
│  • Company Name                                   │
│  • State of Formation                             │
│  • Member Names                                   │
│                                                    │
│  [ Preview Sample ]  [ Buy Now - $29 ]           │
│                                                    │
└────────────────────────────────────────────────────┘
```

**Implementation:**
```tsx
// app/(marketplace)/template/[id]/page.tsx

import { createClient } from '@/lib/db';
import { PurchaseButton } from '@/components/PurchaseButton';

export default async function TemplatePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  
  const { data: template } = await supabase
    .from('templates')
    .select('*')
    .eq('id', params.id)
    .single();
  
  if (!template) {
    return <div>Template not found</div>;
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-4">{template.name}</h1>
      <p className="text-2xl text-gray-700 mb-4">${template.price}</p>
      
      <div className="prose max-w-none mb-8">
        <p>{template.description}</p>
        
        <h2>Required Fields:</h2>
        <ul>
          {template.required_fields.map(field => (
            <li key={field}>{field}</li>
          ))}
        </ul>
      </div>
      
      <PurchaseButton templateId={template.id} price={template.price} />
    </div>
  );
}
```

#### 3.2.3. Dashboard (`/account`)

**Purpose:** Show user's purchased templates, order history

**UI:**
```
┌────────────────────────────────────────────────────┐
│  My Account                            [Logout]    │
├────────────────────────────────────────────────────┤
│                                                    │
│  Purchased Templates (3)                          │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ Simple NDA                                   │ │
│  │ Purchased: Jan 15, 2025                      │ │
│  │ [ Download Extension to Use ]                │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ Operating Agreement (LLC)                    │ │
│  │ Purchased: Jan 10, 2025                      │ │
│  │ [ Download Extension to Use ]                │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
└────────────────────────────────────────────────────┘
```

**Implementation:**
```tsx
// app/(dashboard)/account/page.tsx

import { auth } from '@clerk/nextjs';
import { createClient } from '@/lib/db';

export default async function AccountPage() {
  const { userId } = auth();
  const supabase = createClient();
  
  const { data: purchases } = await supabase
    .from('purchases')
    .select('*, templates(*)')
    .eq('user_id', userId)
    .order('purchased_at', { ascending: false });
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">My Account</h1>
      
      <h2 className="text-2xl font-semibold mb-4">Purchased Templates ({purchases?.length || 0})</h2>
      
      <div className="space-y-4">
        {purchases?.map(purchase => (
          <div key={purchase.id} className="border p-4 rounded-lg">
            <h3 className="font-semibold">{purchase.templates.name}</h3>
            <p className="text-sm text-gray-600">
              Purchased: {new Date(purchase.purchased_at).toLocaleDateString()}
            </p>
            <button className="mt-2 bg-blue-500 text-white px-4 py-2 rounded">
              Download Extension to Use
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 4. Backend Architecture

### 4.1. API Routes

#### 4.1.1. Stripe Checkout (`POST /api/checkout`)

**Purpose:** Create Stripe Checkout Session

**Flow:**
```
User clicks "Buy Now" → POST /api/checkout
   ↓
Create Stripe Checkout Session (with template metadata)
   ↓
Return session.url → Redirect user to Stripe
   ↓
User completes payment
   ↓
Stripe redirects to success page
   ↓
Stripe sends webhook to /api/webhook
   ↓
Record purchase in database
   ↓
Grant user access to template
```

**Implementation:**
```typescript
// app/api/checkout/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
});

export async function POST(req: NextRequest) {
  const { userId } = auth();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { templateId, price } = await req.json();
  
  // Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Template: ${templateId}`
          },
          unit_amount: price * 100  // Convert to cents
        },
        quantity: 1
      }
    ],
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/template/${templateId}`,
    metadata: {
      user_id: userId,
      template_id: templateId
    }
  });
  
  return NextResponse.json({ url: session.url });
}
```

#### 4.1.2. Stripe Webhook (`POST /api/webhook`)

**Purpose:** Record purchases after successful payment

**Implementation:**
```typescript
// app/api/webhook/route.ts

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;
  
  let event: Stripe.Event;
  
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // Record purchase
    const supabase = createClient();
    await supabase.from('purchases').insert({
      user_id: session.metadata!.user_id,
      template_id: session.metadata!.template_id,
      stripe_session_id: session.id,
      amount_paid: session.amount_total! / 100,
      purchased_at: new Date().toISOString()
    });
    
    // TODO: Send confirmation email
  }
  
  return NextResponse.json({ received: true });
}
```

---

## 5. Database Schema (Supabase)

### 5.1. Tables

#### `templates`
```sql
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,  -- 'business', 'contracts', 'real_estate', 'hr'
  price DECIMAL(10,2) NOT NULL,
  required_fields JSONB NOT NULL,  -- ["company_name", "ein", ...]
  docx_url TEXT NOT NULL,  -- Cloudflare R2 URL
  sample_url TEXT,  -- Sample DOCX for preview
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_templates_category ON templates(category);
CREATE INDEX idx_templates_is_active ON templates(is_active);
```

#### `purchases`
```sql
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,  -- Clerk user ID
  template_id UUID REFERENCES templates(id),
  stripe_session_id TEXT NOT NULL,
  amount_paid DECIMAL(10,2) NOT NULL,
  purchased_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_purchases_user_id ON purchases(user_id);
CREATE INDEX idx_purchases_template_id ON purchases(template_id);
```

#### `template_reviews`
```sql
CREATE TABLE template_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID REFERENCES templates(id),
  user_id TEXT NOT NULL,  -- Clerk user ID
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reviews_template_id ON template_reviews(template_id);
```

---

## 6. CDN (Cloudflare R2)

**Purpose:** Store DOCX templates (encrypted at rest)

**Structure:**
```
elv-templates/
├── operating-agreement-llc-v1.docx
├── operating-agreement-llc-v2.docx
├── simple-nda-v1.docx
└── ...
```

**Access Control:**
- Public read (via signed URLs with expiry)
- Admin-only write

**Upload Flow:**
1. Admin uploads DOCX via web app
2. Server generates signed URL
3. Admin uploads directly to R2
4. Server records template metadata in database

---

## 7. Authentication (Clerk)

**Features:**
- Passwordless login (email magic link)
- OAuth (Google, Microsoft)
- User profile management

**Integration:**
```tsx
// app/layout.tsx

import { ClerkProvider } from '@clerk/nextjs';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

**Protected Routes:**
```tsx
// app/(dashboard)/layout.tsx

import { auth } from '@clerk/nextjs';
import { redirect } from 'next/navigation';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = auth();
  
  if (!userId) {
    redirect('/sign-in');
  }
  
  return <div>{children}</div>;
}
```

---

## 8. Deployment (Vercel)

**Configuration:**
```json
{
  "buildCommand": "next build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "env": {
    "NEXT_PUBLIC_APP_URL": "https://app.encryptedlegalvault.com",
    "CLERK_SECRET_KEY": "@clerk-secret",
    "STRIPE_SECRET_KEY": "@stripe-secret",
    "STRIPE_WEBHOOK_SECRET": "@stripe-webhook-secret",
    "SUPABASE_URL": "@supabase-url",
    "SUPABASE_ANON_KEY": "@supabase-anon-key"
  }
}
```

**Custom Domain:**
- Point `app.encryptedlegalvault.com` to Vercel
- SSL certificate auto-provisioned

---

## 9. Open Questions

| Question | Options | Recommendation |
|----------|---------|----------------|
| **Support dark mode?** | Yes (user preference) | Yes; implement with Tailwind |
| **Internationalization?** | Start with English only | Year 2; focus on US market for MVP |
| **Admin panel for template management?** | Yes (custom UI) | Yes; build simple CRUD interface |
| **Analytics?** | Google Analytics, Plausible | Plausible (privacy-friendly) |

---

## 10. Conclusion

This web app architecture enables:
1. **Fast marketplace** – Server-side rendering for SEO
2. **Secure payments** – Stripe integration
3. **Scalable database** – Supabase (PostgreSQL)
4. **Zero-downtime deploys** – Vercel edge functions

**Critical Path for MVP:**
1. Build marketplace UI (browse, detail pages)
2. Integrate Stripe checkout
3. Set up Supabase tables
4. Upload initial 10 templates to R2
5. Deploy to Vercel
```

---

## 10_API_SPECIFICATION.md

```markdown
# API Specification

## 1. Overview

The ELV API serves two purposes:
1. **Extension API** – Endpoints for extension to fetch templates, record usage
2. **Admin API** – Endpoints for admin to upload templates, view analytics

**Base URL:** `https://app.encryptedlegalvault.com/api`

**Authentication:**
- Extension: Device token (JWT)
- Admin: Clerk session token

---

## 2. Extension API

### 2.1. `GET /api/templates`

**Purpose:** Fetch all templates (metadata only)

**Auth:** Public (no auth required)

**Request:**
```
GET /api/templates
```

**Response:**
```json
{
  "templates": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Simple NDA",
      "category": "contracts",
      "price": 9.00,
      "required_fields": ["party_1_name", "party_2_name", "effective_date"],
      "sample_url": "https://cdn.elv.com/samples/simple-nda-v1.pdf"
    }
  ]
}
```

### 2.2. `GET /api/templates/:id`

**Purpose:** Fetch template details (including schema)

**Auth:** Public

**Request:**
```
GET /api/templates/550e8400-e29b-41d4-a716-446655440000
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Simple NDA",
  "description": "A straightforward non-disclosure agreement for protecting confidential information.",
  "category": "contracts",
  "price": 9.00,
  "required_fields": [
    {
      "field_id": "party_1_name",
      "field_type": "text",
      "label": "Party 1 Name",
      "placeholder": "e.g., Acme Corp"
    },
    {
      "field_id": "party_2_name",
      "field_type": "text",
      "label": "Party 2 Name",
      "placeholder": "e.g., John Doe"
    },
    {
      "field_id": "effective_date",
      "field_type": "date",
      "label": "Effective Date"
    }
  ],
  "sample_url": "https://cdn.elv.com/samples/simple-nda-v1.pdf",
  "docx_url": "https://cdn.elv.com/templates/simple-nda-v1.docx"  // Only if user owns template
}
```

### 2.3. `POST /api/purchases/verify`

**Purpose:** Verify if user owns a template (extension polls this to unlock download)

**Auth:** Device token

**Request:**
```json
POST /api/purchases/verify
{
  "device_token": "eyJhbGciOiJI...",
  "template_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**
```json
{
  "owns_template": true,
  "docx_url": "https://cdn.elv.com/templates/simple-nda-v1.docx"
}
```

### 2.4. `POST /api/usage`

**Purpose:** Record template usage (analytics)

**Auth:** Device token

**Request:**
```json
POST /api/usage
{
  "device_token": "eyJhbGciOiJI...",
  "template_id": "550e8400-e29b-41d4-a716-446655440000",
  "action": "generate",  // 'generate' | 'preview'
  "timestamp": "2025-01-15T10:30:00Z"
}
```

**Response:**
```json
{
  "success": true
}
```

---

## 3. Admin API

### 3.1. `POST /api/admin/templates`

**Purpose:** Upload new template

**Auth:** Clerk admin token

**Request:**
```json
POST /api/admin/templates
{
  "name": "Mutual NDA",
  "description": "Two-way non-disclosure agreement.",
  "category": "contracts",
  "price": 12.00,
  "required_fields": [
    {
      "field_id": "party_1_name",
      "field_type": "text",
      "label": "Party 1 Name"
    },
    {
      "field_id": "party_2_name",
      "field_type": "text",
      "label": "Party 2 Name"
    }
  ],
  "docx_file": "<base64-encoded DOCX>"
}
```

**Response:**
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "docx_url": "https://cdn.elv.com/templates/mutual-nda-v1.docx"
}
```

### 3.2. `GET /api/admin/analytics`

**Purpose:** Fetch usage analytics

**Auth:** Clerk admin token

**Request:**
```
GET /api/admin/analytics?start_date=2025-01-01&end_date=2025-01-31
```

**Response:**
```json
{
  "total_purchases": 150,
  "total_revenue": 2430.00,
  "top_templates": [
    {
      "template_id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Operating Agreement (LLC)",
      "purchases": 45,
      "revenue": 1305.00
    }
  ],
  "daily_revenue": [
    { "date": "2025-01-01", "revenue": 87.00 },
    { "date": "2025-01-02", "revenue": 102.00 }
  ]
}
```

---

## 4. Rate Limiting

**Rules:**
- Extension API: 60 requests/minute per device
- Admin API: 600 requests/minute per user

**Implementation:**
```typescript
// middleware.ts

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(60, '1 m')
});

export async function middleware(req: NextRequest) {
  const identifier = req.headers.get('x-device-token') || req.ip;
  
  const { success } = await ratelimit.limit(identifier);
  
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  
  return NextResponse.next();
}
```

---

## 5. Error Codes

| Code | Message | Meaning |
|------|---------|---------|
| **400** | Bad Request | Invalid request payload |
| **401** | Unauthorized | Missing or invalid auth token |
| **403** | Forbidden | User does not own template |
| **404** | Not Found | Template does not exist |
| **429** | Too Many Requests | Rate limit exceeded |
| **500** | Internal Server Error | Server error |

---

## 6. Conclusion

This API specification ensures:
1. **Secure access** – Device tokens prevent abuse
2. **Efficient caching** – Templates cached by extension
3. **Analytics** – Track usage for business insights
```

---

*Continuing with documents 11-14 in next response...*