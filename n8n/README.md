# n8n Workflow — RelayOps Lead Qualification & Booking Automation

This workflow picks up where `POST /api/leads` leaves off: internal task
creation, nurture/manual-review-queue routing, and booking-status tracking
via Calendly's own webhook. It's designed to import and run with minimal
changes — every external call is a clearly-labeled placeholder you swap for
a real tool.

## Regenerating this workflow

`relayops-lead-qualification.json` was built by `generate_workflow.py`
rather than hand-edited — every node and connection is a Python variable,
so a typo'd connection reference fails at generation time instead of as a
silently broken edge inside n8n. If you need to change node structure
(add a branch, rewire an error path, etc.), edit the generator and rerun
it rather than hand-editing the JSON directly:

```bash
cd n8n
python3 generate_workflow.py    # rewrites relayops-lead-qualification.json
python3 validate_workflow.py    # checks every connection resolves, no orphaned/duplicate nodes
```

`validate_workflow.py` only checks internal consistency (every connection
points at a real node, no duplicate names/ids, no orphaned nodes) — it
can't substitute for actually importing into n8n and running it, which it
has not been tested against in this build.

## Importing

1. In n8n: **Workflows → Import from File** → select
   `n8n/relayops-lead-qualification.json`.
2. The workflow imports inactive. Leave it inactive until you've configured
   credentials and swapped at least the placeholder endpoints you actually
   need (see below) — an active workflow with placeholder URLs will just
   fail every run.
3. If a node shows a small warning icon after import, open it — n8n is
   usually just asking you to re-confirm a field that's pre-filled but
   needs a credential attached (this happens when the installed n8n
   version's node UI has shifted slightly since this was built; the values
   are already there, you're just confirming them).

## Required environment variables (on the n8n instance itself)

Set these wherever your n8n instance configures environment variables (not
in the Next.js app's `.env` — n8n is a separate process):

| Variable | Purpose |
|---|---|
| `RELAYOPS_APP_URL` | Base URL of the deployed Next.js app, no trailing slash (e.g. `https://your-app.vercel.app`). Used by **Notify Next.js — Update Booking Status**. |
| `N8N_WEBHOOK_SECRET` | Must match the Next.js app's `N8N_WEBHOOK_SECRET` exactly — it's sent back as the `x-n8n-secret` header when this workflow calls `/api/webhooks/n8n`. |
| `CALENDLY_WEBHOOK_SIGNING_KEY` | The signing key from your Calendly webhook subscription (see below). Used by **Verify Calendly Signature** to confirm bookings are genuinely from Calendly. |

## Credentials to configure

**Lead Intake Webhook** node → set Authentication to **Header Auth**, and
create a credential with header name `x-n8n-secret` and a value matching
`N8N_WEBHOOK_SECRET` in the Next.js app's environment. Without this,
anyone who finds the webhook URL can inject fake leads.

After import, copy this node's **Production URL** into `N8N_WEBHOOK_URL` in
the Next.js app's `.env` (it's optional there — the lead route only calls
n8n if it's set).

## Swapping placeholder nodes for real tools

Every external integration in this workflow hits a fake
`*.placeholder-*.example.com` URL on purpose, so the workflow imports and
is inspectable without any real credentials, and so it's obvious at a
glance which nodes still need real wiring. Each placeholder node's **Notes**
(visible on the canvas and in the node's settings panel) name specific
real-world swaps. Summary:

| Node | Branch | Swap for |
|---|---|---|
| Create Internal Task (Placeholder) | Qualified | Asana, Trello, or ClickUp — see node notes for each API's task-creation endpoint |
| Add To Nurture Sequence (Placeholder) | Maybe-Qualified | Mailchimp, ActiveCampaign, or Klaviyo |
| Add To Manual Review Queue (Placeholder) | Maybe-Qualified | Usually an Airtable base or Notion database a human actually checks — not a generic API |
| Send Follow-Up Reminder (Placeholder) | Maybe-Qualified | A Slack Incoming Webhook is the simplest real swap |
| Archive Lead (Placeholder) | Not-Qualified | Often unnecessary in practice — the CRM record already has `status: 'not_qualified'`. Keep only if the client wants leads physically moved elsewhere. |
| Send Error To Logging Service (Placeholder) | Shared error log | Sentry, Datadog Logs API, or a Slack alert webhook |

To swap one: open the node, change the URL, update authentication
(n8n has built-in credential types for most of the above), and adjust the
JSON body in the node's **Body** field to match that API's expected shape.

## Setting up the Calendly webhook subscription

The **Calendly Booking Webhook** node is a separate, always-on trigger —
deliberately not chained off the main lead-intake flow. See the sticky
note on the canvas next to it for why (short version: Calendly needs one
static subscription URL covering every lead; n8n's per-execution Wait-node
resume URLs can't satisfy that).

1. In Calendly: **Integrations → Webhooks** (or via the Calendly API's
   `/webhook_subscriptions` endpoint), create a subscription for the
   `invitee.created` and `invitee.canceled` events.
2. Point the subscription's callback URL at this node's **Production URL**
   (visible in n8n once the workflow is active).
3. Calendly issues a signing key for the subscription — set it as
   `CALENDLY_WEBHOOK_SIGNING_KEY` on the n8n instance (same variable name
   the Next.js app uses, so you can reuse the same key value in both
   places).
4. The **Verify Calendly Signature** node checks this signature on every
   incoming call before anything else happens. If it fails, the event is
   logged to the shared error log and dropped — it never reaches the
   booking-status update.

## How a booking confirmation gets back to the Next.js app

```
Lead clicks the Calendly link issued during qualification
  (link includes ?utm_content=<leadId> — see buildBookingLink() in
   src/lib/booking/calendly.ts)
        │
        ▼
Calendly fires invitee.created / invitee.canceled to this n8n instance
        │
        ▼
Calendly Booking Webhook (trigger) → Verify Calendly Signature
        │ (valid)
        ▼
Extract Lead ID & Booking Status
  pulls leadId back out of payload.tracking.utm_content,
  maps the Calendly event to 'booked' | 'cancelled'
        │
        ▼
Notify Next.js — Update Booking Status
  POST {RELAYOPS_APP_URL}/api/webhooks/n8n
  headers: { "x-n8n-secret": N8N_WEBHOOK_SECRET }
  body:    { leadId, bookingStatus, bookingUrl }
        │
        ▼
Next.js route patches the CrmRecord (bookingStatus, and status → 'booked'
when applicable — see src/app/api/webhooks/n8n/route.ts)
```

This is the only path back into the Next.js app from this workflow — the
qualified/maybe/not-qualified branches are otherwise one-way (Next.js →
n8n → external tools), since the lead route already has everything it
needs from the original submission and doesn't wait on n8n for anything.

## Error handling & retries

Every HTTP Request node has `onError: continueErrorOutput` set, so a
failed call routes to its second output pin instead of stopping the
execution. All branches funnel into one shared **Format Error Entry → Send
Error To Logging Service** pair, so there's a single structured error
trail instead of scattered failure handling per branch.

Retries are configured at 3 attempts per HTTP Request node — but n8n's
built-in retry is a **fixed delay between tries, not exponential backoff**.
If a client genuinely needs exponential backoff, that requires a Code node
wrapping the HTTP call in a manual retry loop with increasing `Wait`
durations; it isn't something the HTTP Request node's settings panel
exposes directly. Flagging this rather than overclaiming it works
out of the box.

## A note on the "Wait" in the Maybe-Qualified branch

**Wait 2 Business Days For Follow-Up** pauses for a fixed 48 hours —
calendar days, not business days. A lead landing Friday afternoon gets
followed up Sunday, not the next Tuesday. See that node's notes for how to
make it genuinely business-day-aware (an IF check on `{{$now.weekday}}`
looping back into a short re-wait on weekends) if that gap matters for a
given client.
