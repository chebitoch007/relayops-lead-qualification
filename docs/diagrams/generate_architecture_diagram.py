"""
Generates docs/diagrams/architecture.svg.

Run: python3 generate_architecture_diagram.py
"""

from svg_helpers import (
    COLORS,
    FONT_MONO,
    arrow,
    arrow_label,
    box,
    defs_arrowhead,
    label_badge,
    multiline_text,
    node_box,
    section_label,
    svg_close,
    svg_open,
    text,
)

W, H = 1500, 1110

out = svg_open(W, H, "RelayOps — System Architecture")
out += defs_arrowhead("primary", COLORS["primary"])
out += defs_arrowhead("bright", COLORS["primary_bright"])
out += defs_arrowhead("muted", COLORS["muted"])
out += defs_arrowhead("warning", COLORS["warning"])

# ── Title ───────────────────────────────────────────────────────────────
out += text(W / 2, 38, "RELAYOPS — SYSTEM ARCHITECTURE", size=15, color=COLORS["primary_bright"],
            anchor="middle", weight="700", letter_spacing="1.5px")
out += text(W / 2, 62, "Lead Qualification & Appointment Booking Automation", size=13,
            color=COLORS["muted"], anchor="middle")

# ── Browser / Lead Form ──────────────────────────────────────────────────
browser = (60, 90, 460, 100)
out += node_box(*browser, "Browser — Lead Capture Form",
                ["User submits name, company, revenue band, biggest", "challenge, etc. — react-hook-form + zod"],
                accent=COLORS["primary"])

# ── Next.js App (hub) ─────────────────────────────────────────────────────
nextjs = (60, 250, 460, 300)
out += node_box(*nextjs, "Next.js App", accent=COLORS["primary_bright"])

route_x, route_w, route_h = 80, 420, 46
routes = [
    ("POST /api/leads", "validate → qualify → CRM write → email → n8n"),
    ("POST /api/webhooks/n8n", "patches CRM bookingStatus from n8n"),
    ("POST /api/webhooks/calendly", "direct booking path, HMAC-verified"),
]
route_y = 302
for label, sub in routes:
    out += box(route_x, route_y, route_w, route_h, fill=COLORS["surface_2"], rx=6)
    out += text(route_x + 12, route_y + 18, label, size=12.5, mono=True, color=COLORS["primary_bright"], weight="600")
    out += text(route_x + 12, route_y + 34, sub, size=10.5, color=COLORS["muted"])
    route_y += route_h + 8

out += text(route_x, route_y + 14, "Non-blocking after CRM write: email sends, n8n webhook",
            size=10.5, color=COLORS["muted"])

# ── Right column: Gemini / Sheets / Gmail ────────────────────────────────
col_x, col_w = 600, 320

gemini = (col_x, 250, col_w, 120)
out += node_box(*gemini, "Gemini AI", ["Structured-output JSON schema", "→ score, status, confidence, next step"],
                accent=COLORS["primary"])

sheets = (col_x, 400, col_w, 120)
out += node_box(*sheets, "Google Sheets (CRM)",
                ["Default CrmAdapter implementation", "Provisions its own \"Leads\" tab on first use"],
                accent=COLORS["primary_bright"])
out += label_badge(col_x + col_w - 14, 400 + 20, "swappable", COLORS["primary_bright"])
out += text(col_x + col_w - 14, 400 + 32, "via CrmAdapter", size=9.5, color=COLORS["muted"],
            anchor="end", mono=True)

gmail = (col_x, 550, col_w, 120)
out += node_box(*gmail, "Gmail SMTP (Email)",
                ["Lead email (qualified/maybe/not) +", "founder notification — both non-blocking"],
                accent=COLORS["primary_bright"])
out += label_badge(col_x + col_w - 14, 550 + 20, "swappable", COLORS["primary_bright"])
out += text(col_x + col_w - 14, 550 + 32, "via EmailProvider", size=9.5, color=COLORS["muted"],
            anchor="end", mono=True)

# ── Calendly ──────────────────────────────────────────────────────────────
calendly = (col_x, 700, col_w, 140)
out += node_box(*calendly, "Calendly",
                ["Booking link issued for qualified leads",
                 "Fires invitee.created / .canceled /",
                 "invitee_no_show.created on two paths →"],
                accent=COLORS["warning"])

# ── n8n Workflow (bottom, spans both columns) ────────────────────────────
n8n = (60, 900, 860, 170)
out += node_box(*n8n, "n8n Workflow", accent=COLORS["success"])
out += text(60 + 16, 900 + 44, "Branches on qualification.status:", size=11.5, color=COLORS["muted"])

branch_w, branch_h, branch_y, gap = 260, 82, 962, 20
branches = [
    ("QUALIFIED", "Internal task created;\nbooking link logged", COLORS["success"]),
    ("MAYBE_QUALIFIED", "Nurture + manual review\nqueue; 2-day follow-up", COLORS["warning"]),
    ("NOT_QUALIFIED", "Archive (often redundant —\nCRM already reflects it)", COLORS["destructive"]),
]
bx = 80
for label, desc, color in branches:
    out += box(bx, branch_y, branch_w, branch_h, fill=COLORS["surface_2"], stroke=color, rx=6)
    out += text(bx + 12, branch_y + 20, label, size=11.5, mono=True, color=color, weight="700")
    out += multiline_text(bx + 12, branch_y + 38, desc.split("\n"), size=10.5, color=COLORS["muted"], line_height=14)
    bx += branch_w + gap

# ── Legend ────────────────────────────────────────────────────────────────
legend_x, legend_y = 1000, 250
out += box(legend_x, legend_y, 440, 160, fill=COLORS["surface_2"])
out += section_label(legend_x + 16, legend_y + 26, "Legend")
legend_items = [
    (COLORS["primary"], "Core request/response flow"),
    (COLORS["primary_bright"], "Adapter-based, swappable component"),
    (COLORS["warning"], "Webhook / async callback path"),
    (COLORS["muted"], "Dashed = alternate path (direct vs. via n8n)"),
]
ly = legend_y + 50
for color, label in legend_items:
    out += box(legend_x + 16, ly - 10, 18, 10, fill=color, stroke=color, rx=2)
    out += text(legend_x + 44, ly, label, size=11.5, color=COLORS["foreground"])
    ly += 26

# ═══════════════════════════════════════════════════════════════════════
# Arrows
# ═══════════════════════════════════════════════════════════════════════

# Browser -> Next.js
out += arrow(290, 190, 290, 250, color=COLORS["primary"])
out += arrow_label(380, 222, "POST /api/leads", color=COLORS["primary_bright"])

# Next.js -> Gemini (and back, qualification is request/response in one call)
out += arrow(520, 290, 600, 255, color=COLORS["primary"], curve=(560, 240))
out += arrow_label(560, 222, "qualify() \u2192 score + status", color=COLORS["primary_bright"])

# Next.js -> Google Sheets
out += arrow(520, 380, 600, 440, color=COLORS["primary"], curve=(560, 400))
out += arrow_label(575, 390, "CRM write", color=COLORS["primary_bright"])

# Next.js -> Gmail SMTP
out += arrow(520, 460, 600, 590, color=COLORS["primary"], curve=(555, 520))
out += arrow_label(545, 533, "send email", color=COLORS["primary_bright"])

# Next.js -> Calendly (booking link issued)
out += arrow(520, 510, 600, 760, color=COLORS["warning"], curve=(550, 640))
out += arrow_label(525, 660, "booking link (qualified)", color=COLORS["warning"])

# Next.js <-> n8n (bidirectional, two distinct arrows)
out += arrow(350, 550, 350, 900, color=COLORS["primary"])
out += arrow_label(330, 730, "lead webhook \u2192", color=COLORS["primary_bright"])
out += arrow(460, 900, 460, 550, color=COLORS["primary_bright"])
out += arrow_label(490, 730, "\u2190 booking status", color=COLORS["primary_bright"])

# Calendly -> n8n (webhook path)
out += arrow(760, 840, 760, 900, color=COLORS["warning"])
out += arrow_label(820, 870, "webhook \u2192 n8n", color=COLORS["warning"])

# Calendly -> Next.js direct (dashed, alternate path)
out += arrow(600, 730, 520, 320, color=COLORS["muted"], dash="6,5", marker="muted",
             curve=(380, 480))
out += arrow_label(420, 560, "direct webhook (alt. path)", color=COLORS["muted"])

out += svg_close()

with open("/home/claude/relayops/docs/diagrams/architecture.svg", "w") as f:
    f.write(out)

print("Wrote architecture.svg")
