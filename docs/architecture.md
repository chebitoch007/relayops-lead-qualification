# Architecture

## Why this structure

The brief's hard requirement is: **CRM and email providers must be swappable
without touching business logic.** Everything below exists in service of
that, plus standard separation of concerns.

```
src/
├── app/                       # Next.js App Router — routes only, no business logic
│   ├── api/
│   │   ├── leads/             # POST — validate → qualify → route → persist
│   │   ├── qualify/           # POST — standalone re-qualification (manual review queue)
│   │   └── webhooks/n8n/      # POST — n8n pushes booking status back into the CRM
│   ├── page.tsx                # Lead capture form (UI build phase)
│   └── success/page.tsx        # Post-submit confirmation
├── components/
│   ├── ui/                    # shadcn/ui primitives
│   ├── forms/                 # Form-specific composition
│   └── sections/              # Page-level composition
├── lib/
│   ├── ai/
│   │   ├── types.ts            # QualificationService contract, prompt, response schema
│   │   └── gemini-client.ts    # GeminiQualificationService + qualificationService singleton
│   ├── crm/
│   │   ├── types.ts            # CrmAdapter contract + CrmAdapterError
│   │   ├── google-sheets.ts    # v1 default implementation
│   │   ├── future-providers.ts # HubSpot / GoHighLevel / Pipedrive / Airtable stubs
│   │   └── index.ts            # getCrmAdapter() factory — the only file that branches on CRM_PROVIDER
│   ├── email/
│   │   ├── types.ts            # EmailProvider contract + EmailProviderError
│   │   ├── gmail-smtp.ts       # v1 default implementation
│   │   ├── future-providers.ts # Resend / SendGrid stubs
│   │   └── index.ts            # getEmailProvider() factory — mirrors the CRM factory
│   ├── booking/
│   │   └── calendly.ts         # Booking-link builder + webhook signature verification (stubbed)
│   ├── validation/
│   │   └── lead-schema.ts      # zod schema shared by the form and the API route
│   ├── config/
│   │   └── env.ts              # Typed env access + assertRequired() helper
│   └── utils.ts                 # cn() class-merge helper
├── types/
│   └── index.ts                 # Canonical domain types — LeadInput, Lead, QualificationResult, CrmRecord
└── hooks/                       # Form/UI hooks (UI build phase)
```

## The adapter pattern (CRM + Email)

Both CRM and email follow the same shape:

1. A **contract** (`CrmAdapter` in `lib/crm/types.ts`, `EmailProvider` in
   `lib/email/types.ts`) defines the interface.
2. Each **provider implementation** satisfies that interface and owns all
   provider-specific mapping. `GoogleSheetsCrmAdapter` flattens
   `CrmRecord` into sheet columns (and provisions the `Leads` tab with
   headers on first use if it doesn't exist) — nothing outside
   `google-sheets.ts` knows Sheets exists. `GmailSmtpProvider` derives a
   plain-text fallback from HTML if a caller doesn't supply one.
3. **Stub classes** for not-yet-built providers (`future-providers.ts` in
   both `crm/` and `email/`) share an abstract base
   (`UnimplementedCrmAdapter` / `UnimplementedEmailProvider`) that throws a
   clear "not yet implemented, implement it here" error — so the
   factory's switch statement is exhaustive today, and adding a real
   provider later means writing one class and deleting one stub.
4. A **factory** (`getCrmAdapter()`, `getEmailProvider()`) is the *only*
   place that branches on which provider is active, driven by env vars
   (`CRM_PROVIDER`, `EMAIL_PROVIDER`).

Business logic — API routes, the qualification service, the eventual n8n
workflow triggers — depends only on the interface. Migrating from Google
Sheets to HubSpot means: write `HubspotCrmAdapter extends UnimplementedCrmAdapter`
with real `createRecord`/`updateRecord`/`getRecord` methods, swap it in for
the stub in `crm/index.ts`, set `CRM_PROVIDER=hubspot`. No route handler
changes.

## Data flow (high level)

```
Lead Form (client)
  │  react-hook-form + zod (lib/validation/lead-schema.ts)
  ▼
POST /api/leads
  │  1. Re-validate with the same zod schema (defense in depth)
  │  2. qualificationService.qualify() → Gemini, structured-output JSON
  │     schema, then re-validated with zod before being trusted
  │  3. buildBookingLink() if qualified → Calendly URL with lead id/name/email
  │  4. Flatten Lead + QualificationResult + booking info into a CrmRecord
  │  5. getCrmAdapter().createRecord() → persists it
  ▼
n8n workflow (triggered on CRM write — build phase, not yet implemented)
  │  Branches on qualification.status:
  │    qualified       → founder email + internal task (booking link already issued)
  │    maybe_qualified  → nurture sequence + manual review queue
  │    not_qualified    → helpful response email + archive
  ▼
POST /api/webhooks/n8n
     n8n reports back bookingStatus / bookingUrl → CRM record patched.
     A bookingStatus of "booked" also flips the lead's overall `status`.
```

## Why qualification logic lives in `lib/ai`, not in the route handler

`qualificationService.qualify()` is the only thing that talks to Gemini.
The route handler (`/api/leads`) and the manual re-qualification endpoint
(`/api/qualify`) both call it through the `QualificationService` interface
(`lib/ai/types.ts`), not the concrete `GeminiQualificationService` class.
Swapping models or adding a fallback provider later is a change in one
file plus the singleton export at the bottom of `gemini-client.ts`.

## Type safety boundary

AI output is **untrusted input**. Two layers guard against a malformed or
hallucinated response:

1. Gemini is called with `responseSchema: QUALIFICATION_RESPONSE_SCHEMA`
   (a JSON Schema), so the model is constrained to a matching shape at
   generation time.
2. The raw response is still re-parsed and validated against a zod schema
   in `gemini-client.ts` before it's allowed to become a typed
   `QualificationResult`. A mismatch throws `QualificationError` rather
   than letting `undefined` fields propagate downstream.

## Env validation: fail fast, but only for what's active

`lib/config/env.ts` validates the *shape* of every env var at import time
(`loadEnv()`), but provider credentials (Gemini key, Google Sheets
service account, Gmail SMTP creds, etc.) are `.optional()` in the schema —
because whether they're required depends on which provider is selected.
Each adapter/service asserts its own required vars at the point of use via
`assertRequired(['GEMINI_API_KEY'], 'Gemini qualification service')`,
which throws a specific, actionable error naming exactly what's missing
and why — rather than a generic env validation failure at boot, or a raw
`undefined` crash three layers into a third-party SDK call.

## What's intentionally not built in v1

Per the brief's "Future Extensions" section: Slack/WhatsApp/SMS
notifications, multi-tenant auth, analytics dashboard, RAG, etc. The env
schema already has `ENABLE_SLACK_NOTIFICATIONS` / `ENABLE_WHATSAPP_NOTIFICATIONS`
/ `ENABLE_SMS_NOTIFICATIONS` toggles (default `false`), and
`NotificationChannel` in `types/index.ts` already includes `'slack' |
'discord' | 'whatsapp'` alongside `'email'` — so adding them later is a
config flip plus a new notification module, not a rearchitecture.
