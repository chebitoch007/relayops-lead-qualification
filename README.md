# RelayOps — AI Lead Qualification & Appointment Booking System

Flagship demo implementation for marketing agencies: capture inbound leads,
qualify them with AI, route them by fit, and book discovery calls — without
a human touching the inbox.

## Demo

A lead fills out a form → Gemini scores and routes it → qualified leads
get a Calendly link and a founder gets notified, all within seconds, with
no human touching the inbox until a call is actually worth having.

- 🎥 [Loom walkthrough script](docs/loom-script.md) — what we say when
  showing this to a prospective client
- 🗺️ Full data-flow trace (form submit → booked call):
  [`docs/diagrams/data-flow.svg`](docs/diagrams/data-flow.svg)

![RelayOps system architecture — browser submits the lead form to the Next.js app, which calls Gemini for AI qualification, writes to Google Sheets as the CRM, sends email via Gmail SMTP, issues a Calendly booking link, and exchanges webhooks bidirectionally with the n8n automation workflow](docs/diagrams/architecture.svg)

## Build status

**All five build phases complete. Production-ready.** See
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
| Booking (Calendly) | ✅ Done — link builder, plus signature-verified webhook handling via both the n8n workflow (`/n8n`) and a direct `/api/webhooks/calendly` route that works without n8n |
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

`CALENDLY_WEBHOOK_SIGNING_KEY` is optional but required if you want
`/api/webhooks/calendly` (the direct, n8n-independent booking-completion
path) to work — without it, that route's signature check throws a clear
error and returns 401 on every call. Get the signing key from Calendly's
webhook subscription settings when you create the subscription.

Everything else (future CRM/email providers) has sane defaults or is
gracefully unimplemented with a clear error if selected.

## Testing the backend directly via curl

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
4. ~~**Booking completion**~~ — done (Phase 4). `verifyCalendlyWebhookSignature()`
   in `src/lib/booking/calendly.ts` is now implemented (HMAC-SHA256, timing-safe
   comparison, 5-minute replay window). A new direct path,
   `src/app/api/webhooks/calendly/route.ts`, handles Calendly events
   (`invitee.created`, `invitee.canceled`, `invitee_no_show.created`) without
   requiring n8n to be running — see `docs/architecture.md` for how it
   relates to the existing Calendly → n8n → Next.js path.
5. ~~**Demo assets**~~ — done (Phase 5). Architecture diagram
   (`docs/diagrams/architecture.svg`) and data-flow diagram
   (`docs/diagrams/data-flow.svg`), both generated programmatically — see
   `docs/diagrams/generate_*.py` to regenerate after a structural change.
   Loom walkthrough script at [`docs/loom-script.md`](docs/loom-script.md).
   Screenshots are placeholders pending a live demo instance — see
   [Screenshots](#screenshots) below.

All five phases are now complete. Remaining work is the kind that needs a
real deployment to do meaningfully: capturing actual screenshots, running
the n8n workflow against a live n8n instance for the first time (see the
honesty note in [`n8n/README.md`](n8n/README.md) about that), and
recording the actual Loom video from the script above.

## Screenshots

Captured from a live demo instance — not included in this repository yet
pending an actual deployment to screenshot. Paths below are where they'll
land once captured; see [`docs/loom-script.md`](docs/loom-script.md) for
the walkthrough these correspond to.

![Lead capture form — dark navy and electric blue themed intake form with name, email, company, revenue band, and biggest-challenge fields, with a signal-rail completion meter at the top](docs/screenshots/lead-capture-form.png)
*Lead capture form, mid-fill — the signal-rail meter at the top tracks real required-field completion.*

![Qualification success page — confirms submission and shows a Calendly booking CTA for a qualified lead](docs/screenshots/success-page.png)
*Success page for a qualified lead, with the booking CTA.*

![Google Sheets CRM view — a row showing a lead's full intake data, AI qualification score and status, and booking status](docs/screenshots/google-sheets-crm.png)
*A lead record in the Google Sheets CRM — intake data, qualification score/status, and booking status in one row.*

![n8n workflow canvas — three branches for qualified, maybe-qualified, and not-qualified leads, plus the separate Calendly booking webhook trigger](docs/screenshots/n8n-workflow-overview.png)
*The n8n workflow canvas — three qualification branches plus the Calendly booking-webhook trigger.*

![Founder notification email — internal alert showing lead name, company, AI score, qualification status, and recommended next step](docs/screenshots/founder-notification-email.png)
*Founder notification email — score, status, and next step at a glance.*
