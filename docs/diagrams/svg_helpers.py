"""
Shared SVG building blocks for the architecture and data-flow diagrams.

Hand-written SVG (no svgwrite, no browser, no external diagram service) —
just string templates assembled by small helper functions, so a typo in a
coordinate is easy to spot and fix rather than buried in a GUI export.

Colors are lifted directly from src/app/globals.css's CSS variables and
tailwind.config.ts, not re-eyeballed, so these diagrams are actually the
same palette as the live app rather than a close approximation.
"""

COLORS = {
    "background": "#0A0E17",
    "card": "#11172A",
    "surface_2": "#161D33",
    "border": "#232B45",
    "foreground": "#F1F4FB",
    "muted": "#8B94B0",
    "primary": "#2F6FF0",
    "primary_bright": "#5B8DFF",
    "success": "#34D399",
    "warning": "#FBBF24",
    "destructive": "#E2574C",
}

FONT_SANS = "Inter, -apple-system, Segoe UI, Helvetica, Arial, sans-serif"
FONT_MONO = "'JetBrains Mono', 'Courier New', ui-monospace, monospace"


def esc(s):
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def svg_open(width, height, title):
    return (
        f'<svg viewBox="0 0 {width} {height}" width="{width}" height="{height}" '
        f'xmlns="http://www.w3.org/2000/svg" font-family="{FONT_SANS}">\n'
        f"  <title>{esc(title)}</title>\n"
        f'  <rect width="{width}" height="{height}" fill="{COLORS["background"]}"/>\n'
    )


def svg_close():
    return "</svg>\n"


def defs_arrowhead(color_id, color):
    """Defines a reusable arrowhead marker in the given color."""
    return (
        f'  <defs>\n'
        f'    <marker id="arrow-{color_id}" viewBox="0 0 10 10" refX="8" refY="5" '
        f'markerWidth="7" markerHeight="7" orient="auto-start-reverse">\n'
        f'      <path d="M 0 0 L 10 5 L 0 10 z" fill="{color}"/>\n'
        f'    </marker>\n'
        f'  </defs>\n'
    )


def box(x, y, w, h, fill=None, stroke=None, rx=10, stroke_width=1.5, dash=None):
    fill = fill or COLORS["card"]
    stroke = stroke or COLORS["border"]
    dash_attr = f' stroke-dasharray="{dash}"' if dash else ""
    return (
        f'  <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" '
        f'fill="{fill}" stroke="{stroke}" stroke-width="{stroke_width}"{dash_attr}/>\n'
    )


def text(x, y, content, size=14, color=None, weight="400", anchor="start", mono=False, letter_spacing=None):
    color = color or COLORS["foreground"]
    family = FONT_MONO if mono else FONT_SANS
    ls = f' letter-spacing="{letter_spacing}"' if letter_spacing else ""
    return (
        f'  <text x="{x}" y="{y}" font-family="{family}" font-size="{size}" '
        f'font-weight="{weight}" fill="{color}" text-anchor="{anchor}"{ls}>{esc(content)}</text>\n'
    )


def multiline_text(x, y, lines, size=13, color=None, line_height=18, anchor="start", mono=False, weight="400"):
    out = []
    for i, line in enumerate(lines):
        out.append(text(x, y + i * line_height, line, size=size, color=color, anchor=anchor, mono=mono, weight=weight))
    return "".join(out)


def label_badge(x, y, content, color, mono=True, size=10.5, anchor="end"):
    """Small uppercase tracked label, mirroring .font-mono-label in the app's CSS.
    Defaults to right-aligned since this is normally placed flush against a
    box's right edge (anchor="end" makes the text grow leftward, staying
    inside the box, instead of overflowing past it)."""
    return text(x, y, content.upper(), size=size, color=color, mono=mono, letter_spacing="0.8px", weight="600", anchor=anchor)


def node_box(x, y, w, h, title, sublines=None, accent=None, title_size=15.5, dash=None):
    """
    Standard component box: title at top, optional muted sublines beneath,
    a thin accent-colored top bar if `accent` is given (used to color-code
    branches/components without changing the whole box's palette).
    """
    accent = accent or COLORS["primary"]
    out = box(x, y, w, h, dash=dash)
    out += (
        f'  <rect x="{x}" y="{y}" width="{w}" height="4" rx="2" fill="{accent}"/>\n'
    )
    out += text(x + 16, y + 28, title, size=title_size, weight="700")
    if sublines:
        out += multiline_text(x + 16, y + 48, sublines, size=12, color=COLORS["muted"], line_height=16)
    return out


def arrow(x1, y1, x2, y2, color=None, width=2, dash=None, marker="primary", curve=None):
    """
    Straight or simple-curved connector with an arrowhead. `curve` is an
    optional (cx, cy) control point for a quadratic curve, used to route
    around boxes instead of crossing through them.
    """
    color = color or COLORS["primary"]
    dash_attr = f' stroke-dasharray="{dash}"' if dash else ""
    if curve:
        cx, cy = curve
        path = f"M {x1} {y1} Q {cx} {cy} {x2} {y2}"
    else:
        path = f"M {x1} {y1} L {x2} {y2}"
    return (
        f'  <path d="{path}" fill="none" stroke="{color}" stroke-width="{width}" '
        f'marker-end="url(#arrow-{marker})"{dash_attr}/>\n'
    )


def arrow_label(x, y, content, color=None, anchor="middle", size=11.5, mono=True, bg_pad=4):
    """Label sitting on/near a connector, with a small background patch so it doesn't collide with the line."""
    color = color or COLORS["muted"]
    text_width = len(content) * (6.4 if mono else 6.0) + bg_pad * 2
    out = (
        f'  <rect x="{x - text_width / 2}" y="{y - 12}" width="{text_width}" height="16" '
        f'fill="{COLORS["background"]}" opacity="0.85"/>\n'
    )
    out += text(x, y, content, size=size, color=color, anchor=anchor, mono=mono)
    return out


def section_label(x, y, content):
    """Larger uppercase section heading, e.g. grouping a row of boxes."""
    return text(x, y, content.upper(), size=12, color=COLORS["primary_bright"], mono=True, letter_spacing="1.2px", weight="600")
