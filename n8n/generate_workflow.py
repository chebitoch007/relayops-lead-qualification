"""
Generates n8n/relayops-lead-qualification.json.

Built programmatically rather than hand-written because the failure mode for
a hand-typed 700-line n8n export is a typo'd node name breaking a connection
reference with no error until import — generating it lets every connection
reference a node by a Python variable (so a typo is a NameError at
generation time, not a silent broken edge at import time).

n8n's own import behaviour is forgiving about node-level `parameters`
mismatches across versions (an imported node with slightly-off params for
the installed node version still loads — it just shows a config prompt),
but it is NOT forgiving about top-level shape: every connection must
reference a real node name, every node needs a unique id/name. That
top-level shape is what this script guarantees.
"""

import json
import uuid


def nid():
    return str(uuid.uuid4())


nodes = []
connections = {}


def add_node(
    name,
    node_type,
    parameters,
    position,
    type_version=1,
    notes=None,
    notes_in_flow=False,
    on_error=None,
    retry=None,
    webhook_id=None,
):
    node = {
        "id": nid(),
        "name": name,
        "type": node_type,
        "typeVersion": type_version,
        "position": position,
        "parameters": parameters,
    }
    if notes:
        node["notes"] = notes
        node["notesInFlow"] = notes_in_flow
    if on_error:
        node["onError"] = on_error
    if retry:
        node["retryOnFail"] = True
        node["maxTries"] = retry.get("maxTries", 3)
        node["waitBetweenTries"] = retry.get("waitBetweenTries", 2000)
    if webhook_id:
        node["webhookId"] = webhook_id
    nodes.append(node)
    return name


def connect(source, target, source_output=0, target_input=0, kind="main"):
    """source -> target on the given output/input index (0 = success/main, 1 = error)."""
    entry = connections.setdefault(source, {}).setdefault(kind, [])
    while len(entry) <= source_output:
        entry.append([])
    entry[source_output].append({"node": target, "type": kind, "index": target_input})


def http_request(
    name,
    method,
    url,
    body_fields,
    position,
    notes,
    headers=None,
    retry_max_tries=3,
    wait_between_tries=2000,
):
    """
    Standard placeholder HTTP Request node: JSON body, retry on failure, and
    `onError: continueErrorOutput` so a second ("error") output pin exists to
    wire into the shared structured-error-log branch.
    """
    header_params = {"parameters": []}
    for h_name, h_value in (headers or {"Content-Type": "application/json"}).items():
        header_params["parameters"].append({"name": h_name, "value": h_value})

    return add_node(
        name,
        "n8n-nodes-base.httpRequest",
        {
            "method": method,
            "url": url,
            "sendHeaders": True,
            "headerParameters": header_params,
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": body_fields,
            "options": {"timeout": 10000},
        },
        position,
        type_version=4.2,
        notes=notes,
        notes_in_flow=True,
        on_error="continueErrorOutput",
        retry={"maxTries": retry_max_tries, "waitBetweenTries": wait_between_tries},
    )


def set_node(name, assignments, position, notes=None):
    """Classic Set node (typeVersion 1) — most stable schema across n8n versions."""
    values_string = []
    values_number = []
    for key, value in assignments.items():
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            values_number.append({"name": key, "value": value})
        else:
            values_string.append({"name": key, "value": value})
    values = {}
    if values_string:
        values["string"] = values_string
    if values_number:
        values["number"] = values_number
    return add_node(
        name,
        "n8n-nodes-base.set",
        {"values": values, "options": {}},
        position,
        type_version=1,
        notes=notes,
        notes_in_flow=bool(notes),
    )


def if_node(name, value1_expr, value2, position, notes=None):
    return add_node(
        name,
        "n8n-nodes-base.if",
        {
            "conditions": {
                "string": [{"value1": value1_expr, "operation": "equal", "value2": value2}]
            }
        },
        position,
        type_version=1,
        notes=notes,
        notes_in_flow=bool(notes),
    )


def sticky(name, content, position, color=3, width=320, height=200):
    return add_node(
        name,
        "n8n-nodes-base.stickyNote",
        {"content": content, "height": height, "width": width, "color": color},
        position,
        type_version=1,
    )


# ─────────────────────────────────────────────────────────────────────────
# Shared structured error-log branch (every HTTP node's error output -> here)
# ─────────────────────────────────────────────────────────────────────────

ERR_FORMAT = set_node(
    "Format Error Entry",
    {
        "logType": "workflow_error",
        "leadId": "={{$json.leadId || $json.body?.leadId || 'unknown'}}",
        "errorMessage": "={{$json.error?.message || $json.error || 'Unknown error'}}",
        "failedNode": "={{$json.error?.node?.name || 'unknown'}}",
        "occurredAt": "={{$now.toISO()}}",
    },
    [1700, 760],
    notes=(
        "Normalizes whatever failed upstream into one structured shape before it's "
        "logged. n8n auto-populates $json.error on error-output items with details "
        "about the failure and the node that threw it."
    ),
)

ERR_SEND = http_request(
    "Send Error To Logging Service (Placeholder)",
    "POST",
    "https://api.placeholder-logging.example.com/v1/errors",
    "={{ $json }}",
    [1940, 760],
    notes=(
        "PLACEHOLDER ENDPOINT — swap for a real error sink before going to "
        "production. Good options: Sentry (POST to your DSN's envelope "
        "endpoint), Datadog Logs API, or simplest of all, a Slack Incoming "
        "Webhook URL posting `{{$json.errorMessage}}` to an #alerts channel. "
        "Retry is intentionally NOT configured here — an error-logging call "
        "that itself keeps failing shouldn't loop."
    ),
    retry_max_tries=1,
)
# Don't let a broken logging endpoint break the workflow either, and don't
# retry it (a logging call that itself keeps failing shouldn't loop) — this
# overrides the default retry the http_request() helper applies everywhere
# else, to match this node's notes above.
nodes[-1]["onError"] = "continueRegularOutput"
nodes[-1]["retryOnFail"] = False
del nodes[-1]["maxTries"]
del nodes[-1]["waitBetweenTries"]

ERR_TERMINAL = add_node(
    "Error Logged",
    "n8n-nodes-base.noOp",
    {},
    [2180, 760],
    notes="Terminal node — confirms the error branch completed. Nothing downstream depends on this.",
)

connect(ERR_FORMAT, ERR_SEND)
connect(ERR_SEND, ERR_TERMINAL)

ERR_STICKY = sticky(
    "Error Handling Note",
    "## Shared Error Log\n\nEvery HTTP Request node in this workflow has "
    "`onError: continueErrorOutput` set, so a failed call doesn't stop the "
    "execution — it routes here instead via the node's second (error) "
    "output pin. All branches funnel into this one place so there's a "
    "single structured error trail rather than scattered failure handling.\n\n"
    "Retry: each HTTP Request node retries 3 times with a **fixed** delay "
    "(n8n's built-in retry is fixed-delay, not exponential — see each "
    "node's notes for how to add real exponential backoff via a Code node "
    "if a client needs it).",
    [1680, 600],
    color=5,
    width=560,
    height=140,
)

# ─────────────────────────────────────────────────────────────────────────
# TRIGGER A — Lead Intake Webhook (called by POST /api/leads after CRM write)
# ─────────────────────────────────────────────────────────────────────────

TRIGGER_A = add_node(
    "Lead Intake Webhook",
    "n8n-nodes-base.webhook",
    {
        "httpMethod": "POST",
        "path": "relayops/lead-intake",
        "responseMode": "onReceived",
        "responseData": "success",
        "options": {},
    },
    [-200, 280],
    type_version=1,
    notes=(
        "Receives the lead payload from src/app/api/leads/route.ts right after its "
        "Google Sheets CRM write. responseMode is 'onReceived' so this responds "
        "200 immediately on receipt — the Next.js call is fire-and-forget, it does "
        "not wait for the branches below to finish.\n\n"
        "TO CONFIGURE: set this node's Authentication to 'Header Auth' and create a "
        "credential whose header name is 'x-n8n-secret' and value matches "
        "N8N_WEBHOOK_SECRET in the Next.js app's environment — otherwise anyone who "
        "finds this URL can post fake leads into the workflow.\n\n"
        "After import, copy this node's Production URL into N8N_WEBHOOK_URL in the "
        "Next.js app's .env."
    ),
    notes_in_flow=True,
    webhook_id=nid(),
)

NORMALIZE = set_node(
    "Validate & Normalize Payload",
    {
        "leadId": "={{$json.body.leadId}}",
        "status": "={{$json.body.status}}",
        "name": "={{$json.body.name}}",
        "email": "={{$json.body.email}}",
        "company": "={{$json.body.company}}",
        "score": "={{$json.body.score}}",
        "bookingUrl": "={{$json.body.bookingUrl || ''}}",
        "monthlyRevenue": "={{$json.body.monthlyRevenue}}",
        "monthlyLeadVolume": "={{$json.body.monthlyLeadVolume}}",
        "recommendedNextStep": "={{$json.body.recommendedNextStep}}",
        "receivedAt": "={{$now.toISO()}}",
    },
    [60, 280],
    notes=(
        "Flattens the webhook's nested `body` wrapper into top-level fields so every "
        "downstream node can reference e.g. {{$json.leadId}} directly instead of "
        "{{$json.body.leadId}}. This is the only node that needs to change if the "
        "Next.js payload shape ever changes."
    ),
)
connect(TRIGGER_A, NORMALIZE)

IF_QUALIFIED = if_node(
    "Is Qualified?",
    "={{$json.status}}",
    "qualified",
    [320, 280],
    notes="Routes the qualified branch. False side continues checking maybe_qualified next.",
)
connect(NORMALIZE, IF_QUALIFIED)

IF_MAYBE = if_node(
    "Is Maybe-Qualified?",
    "={{$json.status}}",
    "maybe_qualified",
    [320, 460],
    notes="Only reached if Is Qualified? was false. False side continues to Is Not-Qualified?.",
)
connect(IF_QUALIFIED, IF_MAYBE, target_input=0, kind="main")  # placeholder, corrected below

# The two IF nodes chain on their FALSE output (index 1), not main index 0 —
# fix the connection above and wire correctly:
connections[IF_QUALIFIED]["main"][0] = []  # clear the placeholder TRUE-output entry
connect(IF_QUALIFIED, IF_MAYBE, source_output=1, target_input=0)

IF_NOT_QUALIFIED = if_node(
    "Is Not-Qualified?",
    "={{$json.status}}",
    "not_qualified",
    [320, 640],
    notes="Only reached if both prior checks were false. False side means an unrecognized status value reached this workflow.",
)
connect(IF_MAYBE, IF_NOT_QUALIFIED, source_output=1, target_input=0)

UNEXPECTED_STATUS = set_node(
    "Unexpected Status - Tag For Error Log",
    {
        "error": "Unrecognized qualification status reached the n8n workflow",
        "leadId": "={{$json.leadId}}",
    },
    [580, 900],
    notes=(
        "Reached only if qualification.status was something other than qualified / "
        "maybe_qualified / not_qualified — which should be impossible given the "
        "QUALIFICATION_STATUSES enum in src/types, but this exists so a future "
        "change to that enum fails loudly here instead of silently dropping leads."
    ),
)
connect(IF_NOT_QUALIFIED, UNEXPECTED_STATUS, source_output=1, target_input=0)
connect(UNEXPECTED_STATUS, ERR_FORMAT)

# ─────────────────────────────────────────────────────────────────────────
# QUALIFIED BRANCH
# ─────────────────────────────────────────────────────────────────────────

QUALIFIED_STICKY = sticky(
    "Qualified Branch Note",
    "## Qualified Branch\n\nCreates the internal task and logs the booking link "
    "(already issued by the Next.js route before this workflow even fired). "
    "**Does not** wait inline for the booking to happen — see 'Calendly Booking "
    "Webhook' trigger lower in this canvas for why, and how the two connect via "
    "leadId.",
    [580, 40],
    color=4,
    width=420,
    height=140,
)

ANNOTATE_QUALIFIED = set_node(
    "Annotate Qualified Lead",
    {"branch": "qualified", "taskTitle": "={{'Discovery call lead: ' + $json.company}}"},
    [580, 220],
)
connect(IF_QUALIFIED, ANNOTATE_QUALIFIED, source_output=0, target_input=0)

CREATE_TASK = http_request(
    "Create Internal Task (Placeholder)",
    "POST",
    "https://api.placeholder-task-manager.example.com/v1/tasks",
    "={{ { title: $json.taskTitle, description: 'Lead: ' + $json.name + ' (' + $json.email + ') — score ' + $json.score + '/10. Next step: ' + $json.recommendedNextStep, dueInDays: 1, leadId: $json.leadId } }}",
    [820, 220],
    notes=(
        "PLACEHOLDER ENDPOINT — replace with the real task tool:\n"
        "  Asana:    POST https://app.asana.com/api/1.0/tasks (Bearer token auth)\n"
        "  Trello:   POST https://api.trello.com/1/cards?idList=<LIST_ID> (key+token query params)\n"
        "  ClickUp:  POST https://api.clickup.com/api/v2/list/<LIST_ID>/task (Bearer token)\n"
        "Whichever you pick, set its credential on this node and update the URL/body "
        "to match that API's task-creation shape."
    ),
)
connect(ANNOTATE_QUALIFIED, CREATE_TASK)
connect(CREATE_TASK, ERR_FORMAT, source_output=1, target_input=0)

LOG_BOOKING_LINK = set_node(
    "Log Booking Link Issued",
    {
        "logType": "booking_link_issued",
        "leadId": "={{$json.leadId}}",
        "bookingUrl": "={{$json.bookingUrl}}",
        "issuedAt": "={{$now.toISO()}}",
    },
    [1060, 220],
    notes=(
        "Structured record that a booking link went out for this lead, viewable in "
        "this execution's run data. Not sent anywhere externally by default — wire "
        "this node's output to a logging HTTP node (same pattern as the shared "
        "error log) if you want it durable outside n8n's own execution history."
    ),
)
connect(CREATE_TASK, LOG_BOOKING_LINK, source_output=0, target_input=0)

QUALIFIED_TERMINAL = add_node(
    "Qualified Lead Processed",
    "n8n-nodes-base.noOp",
    {},
    [1300, 220],
    notes=(
        "Terminal node for this execution. The booking outcome (booked/cancelled) "
        "is NOT handled here — it arrives later, in a separate execution, via the "
        "'Calendly Booking Webhook' trigger below, matched back to this lead by "
        "leadId. See that trigger's notes for why it has to be a separate trigger "
        "rather than a continuation of this one."
    ),
)
connect(LOG_BOOKING_LINK, QUALIFIED_TERMINAL)

# ─────────────────────────────────────────────────────────────────────────
# MAYBE-QUALIFIED BRANCH
# ─────────────────────────────────────────────────────────────────────────

MAYBE_STICKY = sticky(
    "Maybe-Qualified Branch Note",
    "## Maybe-Qualified Branch\n\nNurture + manual review queue, then a 2-business-day "
    "wait before a follow-up reminder fires.",
    [580, 420],
    color=7,
    width=420,
    height=120,
)

ANNOTATE_MAYBE = set_node(
    "Annotate Maybe-Qualified Lead",
    {"branch": "maybe_qualified"},
    [580, 560],
)
connect(IF_MAYBE, ANNOTATE_MAYBE, source_output=0, target_input=0)

ADD_NURTURE = http_request(
    "Add To Nurture Sequence (Placeholder)",
    "POST",
    "https://api.placeholder-nurture.example.com/v1/contacts",
    "={{ { email: $json.email, name: $json.name, tag: 'relayops-maybe-qualified', leadId: $json.leadId } }}",
    [820, 500],
    notes=(
        "PLACEHOLDER ENDPOINT — replace with the real nurture/ESP tool:\n"
        "  Mailchimp:      POST https://<dc>.api.mailchimp.com/3.0/lists/<list_id>/members\n"
        "  ActiveCampaign: POST https://<account>.api-us1.com/api/3/contacts\n"
        "  Klaviyo:        POST https://a.klaviyo.com/api/profiles\n"
        "Add this lead to whichever nurture sequence/list is appropriate for a "
        "not-yet-clear-cut fit."
    ),
)
connect(ANNOTATE_MAYBE, ADD_NURTURE)
connect(ADD_NURTURE, ERR_FORMAT, source_output=1, target_input=0)

ADD_REVIEW_QUEUE = http_request(
    "Add To Manual Review Queue (Placeholder)",
    "POST",
    "https://api.placeholder-review-queue.example.com/v1/queue-items",
    "={{ { leadId: $json.leadId, name: $json.name, company: $json.company, score: $json.score, recommendedNextStep: $json.recommendedNextStep } }}",
    [1060, 500],
    notes=(
        "PLACEHOLDER ENDPOINT — for most clients this ends up being a row in a "
        "dedicated 'Review Queue' Airtable base or Notion database rather than a "
        "generic API, since a human needs to actually look at it and act. Point "
        "this at whichever review surface the founder/team actually checks daily — "
        "a queue nobody looks at isn't a queue, it's a leak."
    ),
)
connect(ADD_NURTURE, ADD_REVIEW_QUEUE, source_output=0, target_input=0)
connect(ADD_REVIEW_QUEUE, ERR_FORMAT, source_output=1, target_input=0)

WAIT_FOLLOWUP = add_node(
    "Wait 2 Business Days For Follow-Up",
    "n8n-nodes-base.wait",
    {"resume": "timeInterval", "amount": 2, "unit": "days"},
    [1300, 500],
    notes=(
        "Pauses this execution for a fixed 48 hours. NOTE: n8n's Wait node counts "
        "calendar days, not business days — a lead that lands on a Friday afternoon "
        "will get followed up on Sunday, not the following Tuesday. For true "
        "business-day-aware scheduling, follow this with an IF node checking "
        "{{$now.weekday}} (1-5 = Mon-Fri) and looping back into another short Wait "
        "if it lands on a weekend. Left as a fixed 2-day wait here to keep the v1 "
        "workflow simple — flagging the gap rather than hiding it."
    ),
)
connect(ADD_REVIEW_QUEUE, WAIT_FOLLOWUP, source_output=0, target_input=0)

SEND_REMINDER = http_request(
    "Send Follow-Up Reminder (Placeholder)",
    "POST",
    "https://api.placeholder-reminder.example.com/v1/reminders",
    "={{ { leadId: $json.leadId, assignee: 'founder', message: 'Follow up with ' + $json.name + ' at ' + $json.company + ' — maybe-qualified, 2 days have passed.' } }}",
    [1540, 500],
    notes=(
        "PLACEHOLDER ENDPOINT — realistic swaps: a Slack message via a Slack "
        "Incoming Webhook (simplest), or a task on the same tool wired up in "
        "'Create Internal Task' above so all follow-ups land in one place."
    ),
)
connect(WAIT_FOLLOWUP, SEND_REMINDER)
connect(SEND_REMINDER, ERR_FORMAT, source_output=1, target_input=0)

MAYBE_TERMINAL = add_node(
    "Maybe-Qualified Lead Processed",
    "n8n-nodes-base.noOp",
    {},
    [1780, 500],
    notes="Terminal node for this branch.",
)
connect(SEND_REMINDER, MAYBE_TERMINAL, source_output=0, target_input=0)

# ─────────────────────────────────────────────────────────────────────────
# NOT-QUALIFIED BRANCH
# ─────────────────────────────────────────────────────────────────────────

NOT_QUALIFIED_STICKY = sticky(
    "Not-Qualified Branch Note",
    "## Not-Qualified Branch\n\nArchive only — the decline email was already sent "
    "directly by the Next.js route, so there's nothing further to automate here.",
    [580, 760],
    color=3,
    width=420,
    height=100,
)

ANNOTATE_NOT_QUALIFIED = set_node(
    "Annotate Not-Qualified Lead",
    {"branch": "not_qualified"},
    [580, 880],
)
connect(IF_NOT_QUALIFIED, ANNOTATE_NOT_QUALIFIED, source_output=0, target_input=0)

ARCHIVE_LEAD = http_request(
    "Archive Lead (Placeholder)",
    "POST",
    "https://api.placeholder-archive.example.com/v1/leads/archive",
    "={{ { leadId: $json.leadId, reason: 'not_qualified' } }}",
    [820, 880],
    notes=(
        "PLACEHOLDER ENDPOINT — in many real deployments this step is actually "
        "redundant: the Google Sheets CRM record already has status='not_qualified' "
        "from the Next.js write, which IS the archive. Keep this node only if the "
        "client wants leads physically moved to a separate sheet/tab, a different "
        "CRM pipeline stage, or removed from an active-leads view."
    ),
)
connect(ANNOTATE_NOT_QUALIFIED, ARCHIVE_LEAD)
connect(ARCHIVE_LEAD, ERR_FORMAT, source_output=1, target_input=0)

NOT_QUALIFIED_TERMINAL = add_node(
    "Not-Qualified Lead Archived",
    "n8n-nodes-base.noOp",
    {},
    [1060, 880],
    notes="Terminal node for this branch.",
)
connect(ARCHIVE_LEAD, NOT_QUALIFIED_TERMINAL, source_output=0, target_input=0)

# ─────────────────────────────────────────────────────────────────────────
# TRIGGER B — Calendly Booking Webhook (separate trigger; see sticky note)
# ─────────────────────────────────────────────────────────────────────────

TRIGGER_B_STICKY = sticky(
    "Calendly Webhook Note",
    "## Why this is a separate trigger\n\n"
    "Calendly's webhook subscription needs ONE static URL configured once in "
    "Calendly's settings, covering every lead. n8n's Wait node CAN resume on a "
    "webhook call, but that resume URL is unique per execution — Calendly has no "
    "way to know which per-execution URL to call for which booking. So instead: "
    "this is its own always-on trigger that receives every Calendly event for "
    "every lead, pulls the leadId back out of Calendly's payload (it was embedded "
    "as utm_content when the booking link was built — see "
    "src/lib/booking/calendly.ts buildBookingLink()), and reports the outcome back "
    "to Next.js. The original lead-intake execution above has already finished by "
    "the time this fires, often days later.",
    [-200, 1080],
    color=4,
    width=600,
    height=200,
)

TRIGGER_B = add_node(
    "Calendly Booking Webhook",
    "n8n-nodes-base.webhook",
    {
        "httpMethod": "POST",
        "path": "relayops/calendly-booking",
        "responseMode": "onReceived",
        "responseData": "success",
        "options": {"rawBody": True},
    },
    [-200, 1340],
    type_version=1,
    notes=(
        "TO CONFIGURE: in Calendly's webhook subscription settings, point the "
        "subscription URL at this node's Production URL, subscribed to the "
        "'invitee.created' and 'invitee.canceled' events. Copy Calendly's signing "
        "key into this n8n instance's CALENDLY_WEBHOOK_SIGNING_KEY environment "
        "variable (same name as the Next.js app's env var, for consistency — they "
        "can hold the same value).\n\n"
        "'rawBody: true' is enabled because signature verification needs the exact "
        "unparsed request body bytes, not the JSON-parsed version."
    ),
    notes_in_flow=True,
    webhook_id=nid(),
)

VERIFY_SIGNATURE = add_node(
    "Verify Calendly Signature",
    "n8n-nodes-base.code",
    {
        "jsCode": (
            "// Verifies Calendly's webhook signature.\n"
            "// Header format: 'Calendly-Webhook-Signature: t=<timestamp>,v1=<hex-hmac>'\n"
            "// Signed payload is the string '<timestamp>.<rawBody>', HMAC-SHA256'd with\n"
            "// the signing key from Calendly's webhook subscription settings.\n"
            "//\n"
            "// NOTE ON n8n VERSIONS: this reads the raw body from the binary property\n"
            "// n8n's Webhook node produces when 'Raw Body' is enabled. The exact\n"
            "// property path (here: $binary.data) has shifted across n8n releases —\n"
            "// if this throws, open the Webhook node's output in the n8n UI, find\n"
            "// where the raw body actually landed, and adjust the path below.\n"
            "\n"
            "const crypto = require('crypto');\n"
            "\n"
            "const signingKey = $env.CALENDLY_WEBHOOK_SIGNING_KEY;\n"
            "const sigHeader = $input.item.json.headers['calendly-webhook-signature'];\n"
            "\n"
            "let signatureValid = false;\n"
            "let reason = '';\n"
            "\n"
            "if (!signingKey) {\n"
            "  reason = 'CALENDLY_WEBHOOK_SIGNING_KEY is not set on this n8n instance';\n"
            "} else if (!sigHeader) {\n"
            "  reason = 'Missing Calendly-Webhook-Signature header';\n"
            "} else {\n"
            "  try {\n"
            "    const parts = Object.fromEntries(\n"
            "      sigHeader.split(',').map((p) => p.split('=').map((s) => s.trim())),\n"
            "    );\n"
            "    const rawBodyBuffer = $input.item.binary?.data?.data\n"
            "      ? Buffer.from($input.item.binary.data.data, 'base64')\n"
            "      : Buffer.from(JSON.stringify($input.item.json.body));\n"
            "    const signedPayload = `${parts.t}.${rawBodyBuffer.toString('utf8')}`;\n"
            "    const expected = crypto\n"
            "      .createHmac('sha256', signingKey)\n"
            "      .update(signedPayload)\n"
            "      .digest('hex');\n"
            "    signatureValid = crypto.timingSafeEqual(\n"
            "      Buffer.from(expected, 'hex'),\n"
            "      Buffer.from(parts.v1 || '', 'hex'),\n"
            "    );\n"
            "    if (!signatureValid) reason = 'Signature mismatch';\n"
            "  } catch (err) {\n"
            "    reason = `Verification error: ${err.message}`;\n"
            "  }\n"
            "}\n"
            "\n"
            "return [{ json: { ...$input.item.json.body, signatureValid, signatureFailureReason: reason } }];\n"
        )
    },
    [60, 1340],
    type_version=2,
    notes=(
        "Computes and checks the HMAC signature so this endpoint can't be spoofed "
        "into reporting fake bookings. See the in-code comment about n8n-version-"
        "specific raw-body access if this needs adjustment after import."
    ),
    notes_in_flow=True,
)
connect(TRIGGER_B, VERIFY_SIGNATURE)

IF_SIGNATURE_VALID = if_node(
    "Signature Valid?",
    "={{$json.signatureValid}}",
    "true",
    [300, 1340],
    notes="Only continues to update Next.js if the HMAC check passed.",
)
connect(VERIFY_SIGNATURE, IF_SIGNATURE_VALID)

LOG_INVALID_SIGNATURE = set_node(
    "Log Invalid Calendly Signature",
    {
        "error": "={{'Calendly webhook signature check failed: ' + $json.signatureFailureReason}}",
        "leadId": "={{$json.payload?.tracking?.utm_content || 'unknown'}}",
    },
    [560, 1460],
    notes="Routes signature failures into the shared error log instead of silently dropping them.",
)
connect(IF_SIGNATURE_VALID, LOG_INVALID_SIGNATURE, source_output=1, target_input=0)
connect(LOG_INVALID_SIGNATURE, ERR_FORMAT)

EXTRACT_BOOKING = set_node(
    "Extract Lead ID & Booking Status",
    {
        "leadId": "={{$json.payload?.tracking?.utm_content || ''}}",
        "bookingStatus": "={{$json.event === 'invitee.canceled' ? 'cancelled' : 'booked'}}",
        "bookingUrl": "={{$json.payload?.scheduled_event?.location?.join_url || $json.payload?.uri || ''}}",
    },
    [560, 1280],
    notes=(
        "Pulls the lead id back out of Calendly's tracking.utm_content (set when "
        "the booking link was built — see buildBookingLink() in "
        "src/lib/booking/calendly.ts) and maps Calendly's event name to our "
        "bookingStatus vocabulary ('booked' | 'cancelled')."
    ),
)
connect(IF_SIGNATURE_VALID, EXTRACT_BOOKING, source_output=0, target_input=0)

NOTIFY_NEXTJS = http_request(
    "Notify Next.js — Update Booking Status",
    "POST",
    "={{$env.RELAYOPS_APP_URL}}/api/webhooks/n8n",
    "={{ { leadId: $json.leadId, bookingStatus: $json.bookingStatus, bookingUrl: $json.bookingUrl } }}",
    [800, 1280],
    notes=(
        "Calls back into the Next.js app's POST /api/webhooks/n8n, which patches "
        "the CrmRecord's bookingStatus (and flips status to 'booked' when "
        "applicable — see that route's handler). TO CONFIGURE: set RELAYOPS_APP_URL "
        "(e.g. https://your-app.vercel.app, no trailing slash) as an environment "
        "variable on this n8n instance."
    ),
    headers={"Content-Type": "application/json", "x-n8n-secret": "={{$env.N8N_WEBHOOK_SECRET}}"},
)
connect(EXTRACT_BOOKING, NOTIFY_NEXTJS)
connect(NOTIFY_NEXTJS, ERR_FORMAT, source_output=1, target_input=0)

BOOKING_TERMINAL = add_node(
    "Booking Status Synced",
    "n8n-nodes-base.noOp",
    {},
    [1040, 1280],
    notes="Terminal node — confirms Next.js's CRM record now reflects the real booking outcome.",
)
connect(NOTIFY_NEXTJS, BOOKING_TERMINAL, source_output=0, target_input=0)

# ─────────────────────────────────────────────────────────────────────────
# Assemble + write
# ─────────────────────────────────────────────────────────────────────────

workflow = {
    "name": "RelayOps — Lead Qualification & Booking Automation",
    "nodes": nodes,
    "connections": connections,
    "active": False,
    "settings": {"executionOrder": "v1"},
    "pinData": {},
    "meta": {
        "templateCredsSetupCompleted": False,
    },
}

with open("/home/claude/relayops/n8n/relayops-lead-qualification.json", "w") as f:
    json.dump(workflow, f, indent=2)
    f.write("\n")

print(f"Wrote {len(nodes)} nodes.")
