"""
Generates docs/diagrams/data-flow.svg — a sequential trace of one lead's
journey, distinct from architecture.svg's system map. Run:
    python3 generate_data_flow_diagram.py
"""

from svg_helpers import (
    COLORS,
    arrow,
    box,
    defs_arrowhead,
    label_badge,
    multiline_text,
    node_box,
    text,
)

W = 1100
CENTER_X = W / 2
MAIN_W = 580
MAIN_X = CENTER_X - MAIN_W / 2

parts = []
nodes = []  # (x, y, w, h) of each main-column step, for arrow-chaining
cursor_y = 90


def step(title, sublines=None, height=78, accent=None, non_blocking=False):
    """Places one main-column box at the current cursor, draws the arrow
    from the previous step, advances the cursor, and returns this box's
    geometry so callers can branch off it afterward."""
    global cursor_y
    bx, bw, by = MAIN_X, MAIN_W, cursor_y

    if nodes:
        px, py, pw, ph = nodes[-1]
        parts.append(arrow(px + pw / 2, py + ph, bx + bw / 2, by, color=COLORS["primary"]))

    dash = "5,4" if non_blocking else None
    parts.append(node_box(bx, by, bw, height, title, sublines, accent=accent, dash=dash))
    if non_blocking:
        parts.append(label_badge(bx + bw - 14, by + 18, "non-blocking", COLORS["warning"]))

    nodes.append((bx, by, bw, height))
    cursor_y = by + height + 60
    return (bx, by, bw, height)


# ── Header ──────────────────────────────────────────────────────────────
parts.append(
    text(CENTER_X, 36, "RELAYOPS — DATA FLOW: ONE LEAD'S JOURNEY", size=15,
         color=COLORS["primary_bright"], anchor="middle", weight="700", letter_spacing="1.2px")
)
parts.append(
    text(CENTER_X, 58, "From form submission to a booked (or declined) call",
         size=12.5, color=COLORS["muted"], anchor="middle")
)

# ── Steps 1–3 ─────────────────────────────────────────────────────────────
step("1. Form Submit (Client)", ["Browser → POST /api/leads", "react-hook-form values, JSON body"],
     accent=COLORS["primary"])

step("2. Zod Validation", ["leadFormSchema — identical schema on client", "and server (lib/validation/lead-schema.ts)"],
     accent=COLORS["primary"])

step("3. Gemini Qualification", ["Structured-output JSON schema → score (1–10),", "status, confidence, recommendedNextStep"],
     accent=COLORS["primary"])

# ── Branch fork: qualification status ────────────────────────────────────
fork_y = cursor_y
px, py, pw, ph = nodes[-1]
parts.append(
    text(CENTER_X, fork_y - 20, "BRANCH ON qualification.status", size=11, color=COLORS["muted"],
         anchor="middle", mono=True, letter_spacing="1px")
)

branch_w, branch_h = 320, 100
gap = 30
total_w = branch_w * 3 + gap * 2
branch_x0 = CENTER_X - total_w / 2
branch_defs = [
    ("QUALIFIED", ["Calendly link built", "(buildBookingLink)"], COLORS["success"]),
    ("MAYBE_QUALIFIED", ["No booking link;", "routed to review queue"], COLORS["warning"]),
    ("NOT_QUALIFIED", ["No booking link;", "respectful decline"], COLORS["destructive"]),
]
branch_boxes = []
bx = branch_x0
for label, sub, color in branch_defs:
    parts.append(arrow(px + pw / 2, py + ph, bx + branch_w / 2, fork_y, color=color))
    parts.append(box(bx, fork_y, branch_w, branch_h, stroke=color, fill=COLORS["surface_2"]))
    parts.append(text(bx + 16, fork_y + 26, label, size=13, mono=True, color=color, weight="700"))
    parts.append(multiline_text(bx + 16, fork_y + 46, sub, size=11, color=COLORS["muted"], line_height=15))
    branch_boxes.append((bx, fork_y, branch_w, branch_h, color))
    bx += branch_w + gap

cursor_y = fork_y + branch_h + 60

# ── Convergence: CRM write (all three branches feed into this) ──────────
converge_y = cursor_y
converge_h = 78
parts.append(
    text(CENTER_X, converge_y - 16, "ALL BRANCHES CONVERGE", size=10.5, color=COLORS["muted"],
         anchor="middle", mono=True, letter_spacing="1px")
)
for bx, by, bw, bh, color in branch_boxes:
    parts.append(arrow(bx + bw / 2, by + bh, CENTER_X, converge_y, color=color))
parts.append(
    node_box(MAIN_X, converge_y, MAIN_W, converge_h, "4. Google Sheets CRM Write",
             ["getCrmAdapter().createRecord() — full lead +", "qualification + booking status, one row"],
             accent=COLORS["primary_bright"])
)
nodes.append((MAIN_X, converge_y, MAIN_W, converge_h))
cursor_y = converge_y + converge_h + 60

# ── Non-blocking steps ────────────────────────────────────────────────────
step("5. Email Sends", ["Lead email (status-specific) + founder", "notification — each in its own try/catch"],
     accent=COLORS["primary_bright"], non_blocking=True)

step("6. n8n Webhook Fired", ["POST to N8N_WEBHOOK_URL if configured —", "fire-and-forget, only if set"],
     accent=COLORS["primary_bright"], non_blocking=True)

step("7. n8n Branches By Status", ["Task creation / nurture+review queue / archive —", "see architecture.svg for full branch detail"],
     accent=COLORS["success"])

# ── Time-gap divider ──────────────────────────────────────────────────────
gap_y = cursor_y - 30
parts.append(
    text(CENTER_X, gap_y, "\u22ee  DAYS LATER \u2014 LEAD ACTUALLY BOOKS OR CANCELS  \u22ee", size=11.5,
         color=COLORS["muted"], anchor="middle", mono=True, letter_spacing="0.8px")
)
parts.append(
    f'  <path d="M {MAIN_X} {gap_y + 14} L {MAIN_X + MAIN_W} {gap_y + 14}" '
    f'stroke="{COLORS["border"]}" stroke-width="1.5" stroke-dasharray="4,6"/>\n'
)
cursor_y += 28

step("8. Calendly Fires Event", ["invitee.created / invitee.canceled /", "invitee_no_show.created"],
     accent=COLORS["warning"])

# ── Second fork: two paths back to the CRM ───────────────────────────────
fork2_y = cursor_y
px, py, pw, ph = nodes[-1]
parts.append(
    text(CENTER_X, fork2_y - 16, "TWO PATHS \u2014 A REAL DEPLOYMENT USES ONE, NOT BOTH",
         size=10.5, color=COLORS["muted"], anchor="middle", mono=True, letter_spacing="0.6px")
)

path_w, path_h = 420, 90
path_gap = 40
path_x0 = CENTER_X - (path_w * 2 + path_gap) / 2
path_defs = [
    ("Via n8n", ["Calendly \u2192 n8n trigger \u2192 Verify", "Calendly Signature \u2192 /api/webhooks/n8n"], COLORS["success"]),
    ("Direct", ["Calendly \u2192 /api/webhooks/calendly", "(HMAC-verified, no n8n required)"], COLORS["primary_bright"]),
]
path_boxes = []
bx = path_x0
for label, sub, color in path_defs:
    parts.append(arrow(px + pw / 2, py + ph, bx + path_w / 2, fork2_y, color=color))
    parts.append(box(bx, fork2_y, path_w, path_h, stroke=color, fill=COLORS["surface_2"]))
    parts.append(text(bx + 16, fork2_y + 26, label, size=13, mono=True, color=color, weight="700"))
    parts.append(multiline_text(bx + 16, fork2_y + 46, sub, size=11, color=COLORS["muted"], line_height=15))
    path_boxes.append((bx, fork2_y, path_w, path_h, color))
    bx += path_w + path_gap

cursor_y = fork2_y + path_h + 60

# ── Final convergence ─────────────────────────────────────────────────────
final_y = cursor_y
final_h = 86
for bx, by, bw, bh, color in path_boxes:
    parts.append(arrow(bx + bw / 2, by + bh, CENTER_X, final_y, color=color))
parts.append(
    node_box(MAIN_X, final_y, MAIN_W, final_h, "9. CRM Patched",
             ["bookingStatus updated ('booked' | 'cancelled' | 'no_show')",
              "\u2014 'booked' also flips the lead's overall status"],
             accent=COLORS["success"])
)

TOTAL_HEIGHT = int(final_y + final_h + 60)

# ── Assemble ──────────────────────────────────────────────────────────────
header = (
    f'<svg viewBox="0 0 {W} {TOTAL_HEIGHT}" width="{W}" height="{TOTAL_HEIGHT}" '
    f'xmlns="http://www.w3.org/2000/svg" font-family="Inter, -apple-system, Segoe UI, Helvetica, Arial, sans-serif">\n'
    f"  <title>RelayOps \u2014 Data Flow: One Lead's Journey</title>\n"
    f'  <rect width="{W}" height="{TOTAL_HEIGHT}" fill="{COLORS["background"]}"/>\n'
    + defs_arrowhead("primary", COLORS["primary"])
    + defs_arrowhead("bright", COLORS["primary_bright"])
    + defs_arrowhead("muted", COLORS["muted"])
    + defs_arrowhead("success", COLORS["success"])
    + defs_arrowhead("warning", COLORS["warning"])
    + defs_arrowhead("destructive", COLORS["destructive"])
)

svg = header + "".join(parts) + "</svg>\n"

with open("/home/claude/relayops/docs/diagrams/data-flow.svg", "w") as f:
    f.write(svg)

print(f"Wrote data-flow.svg, height={TOTAL_HEIGHT}")
