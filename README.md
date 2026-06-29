# RelayOps — AI Lead Qualification & Appointment Booking System

Flagship demo implementation for marketing agencies: capture inbound leads,
qualify them with AI, route them by fit, and book discovery calls — without
a human touching the inbox.

## Build status

Phases 1–3 are complete: architecture scaffold, lead-capture UI + email
templates, and the n8n automation workflow. See
[`docs/architecture.md`](docs/architecture.md) for the full design
rationale. `npm run build`, `npx tsc --noEmit`, and `npx next lint` all
pass clean.

| Layer | Status |
|---|---|
| Project structure, types, config | ✅ Done |
| Validation schema (zod) | ✅ Done |
| CRM adapter pattern + Google Sheets adapter | ✅ Done (functional) |
| AI qualification (Gemini, structured output) | ✅ Done (functional) |
| `/api/leads`, `/api/qualify`, `/api/webhooks/n8n` | ✅ Done (functional) |
| Email provider pattern + Gmail SMTP | ✅ Done (functional, wired into `/api/leads`) |
| Lead + founder email templates | ✅ Done |
| Lead capture UI | ✅ Done |
| Booking (Calendly) | 🟡 Link builder done; webhook signature verification happens in the n8n workflow (see `/n8n`), not in the Next.js `calendly.ts` stub |
| n8n workflow | ✅ Done (`/n8n/relayops-lead-qualification.json`) |
| Founder notification module | ✅ Done |

## Getting started

```bash
npm install
cp .env.example .env.local
# fill in .env.local — see comments in that file for what each var needs
npm run dev
```

### Required for the backend to run end-to-end today

- `GEMINI_API_KEY` — AI qualification throws a clear `assertRequired` error
  without it.
- Google Sheets: `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`,
  `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`. The service account needs Editor
  access on the spreadsheet. You don't need to pre-create the `Leads` tab —
  the adapter provisions it with the correct headers on first use.
- `NEXT_PUBLIC_CALENDLY_BOOKING_URL` — required by the env schema even
  before a qualified lead exists, since it's validated as a URL at boot.

Gmail SMTP (`GMAIL_SMTP_USER` + `GMAIL_SMTP_APP_PASSWORD`, an [app
password](https://myaccount.google.com/apppasswords), not your normal
Gmail password) is required for lead and founder notification emails to
actually send — `/api/leads` calls it directly.

`N8N_WEBHOOK_URL` is optional. If unset, the route skips notifying n8n
entirely (everything else still works). See [`n8n/README.md`](n8n/README.md)
for the workflow itself.

Everything else (future CRM/email providers) has sane defaults or is
gracefully unimplemented with a clear error if selected.

## Testing the backend right now (before the UI exists)

```bash
curl -X POST http://localhost:3000/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jordan Lee",
    "email": "jordan@example.com",
    "phone": "+1 555 123 4567",
    "company": "Lee Growth Partners",
    "website": "leegrowthpartners.com",
    "monthlyLeadVolume": "51-200",
    "teamSize": "4-10",
    "monthlyRevenue": "50k_150k",
    "existingCrm": "none",
    "biggestChallenge": "We get a lot of inbound but no one follows up fast enough and we lose deals to slow response time."
  }'
```

This validates the payload, calls Gemini for qualification, builds a
Calendly link if qualified, writes a row to your configured Google Sheet,
sends the lead + founder emails, and — if `N8N_WEBHOOK_URL` is set — fires
the n8n workflow. Check the sheet and your inbox to confirm.

You can also hit `/api/qualify` with the same body to get back just the
qualification result, without touching the CRM — useful for testing prompt
changes in isolation.

## Project layout

See [`docs/architecture.md`](docs/architecture.md).

## Tech stack

Next.js 14.2.35 (App Router, patched for CVE-2025-55183/55184/67779) ·
TypeScript · Tailwind CSS · shadcn/ui · React Hook Form + Zod · Gemini API
(structured output) · Google Sheets · Calendly · n8n · Gmail SMTP (dev) →
Resend/SendGrid (prod-ready) · Vercel

## Next build phases

1. ~~**Lead capture UI**~~ — done (Phase 2).
2. ~~**Email templates**~~ — done (Phase 2).
3. ~~**n8n workflow**~~ — done (Phase 3). Import-ready export at
   `n8n/relayops-lead-qualification.json` with error handling, retries,
   labeled nodes, and the Calendly booking-webhook trigger. See
   [`n8n/README.md`](n8n/README.md).
4. **Booking completion** (next) — the `verifyCalendlyWebhookSignature()`
   stub in `src/lib/booking/calendly.ts` is currently unimplemented; signature
   verification for Calendly events is handled inside the n8n workflow
   instead (see `n8n/README.md`). This phase decides whether that Next.js
   stub gets implemented too (e.g. for a future direct-webhook path that
   bypasses n8n) or is removed as redundant, and closes out any remaining
   booking-completion edge cases (e.g. rescheduled events, no-shows).
5. **Demo assets** — screenshots, architecture/data-flow diagrams, Loom
   script.
