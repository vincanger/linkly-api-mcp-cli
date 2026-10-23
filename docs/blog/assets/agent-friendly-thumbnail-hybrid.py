import sys

# Blog thumbnail, hybrid take: the icons and outside labels of agent-friendly-thumbnail.py, drawn in the
# card style of agent-friendly-thumbnail-cards.py (rounded cards, curved spokes with dots at the ends).
# Same Wasp colors and size: drawn at 1200x630 and rendered at 2x to 2400x1260, with everything inside
# x 60..1140 for the blog list's 16:9 crop.
W, H = 1200, 630
BG, INK, Y, PAPER, LINE = "#f7f5f0", "#111111", "#f5c842", "#fdfcf9", "#d9d3c4"

NODE = HUB = 180
ICON = 1.35  # the icons were drawn for smaller cards
LX, RX = 150, W - 150 - NODE
TOP_Y = 138
BOT_Y = TOP_Y + NODE + 58
HCY = (TOP_Y + BOT_Y + NODE) / 2
HX, HY = (W - HUB) / 2, HCY - HUB / 2

MCP_MARK = [
    "M25 97.8528L92.8822 29.9706C102.255 20.598 117.451 20.598 126.823 29.9706V29.9706C136.196 39.3431 136.196 54.5391 126.823 63.9117L75.5581 115.177",
    "M76.2652 114.47L126.823 63.9117C136.196 54.5391 151.392 54.5391 160.765 63.9117L161.118 64.2652C170.491 73.6378 170.491 88.8338 161.118 98.2063L99.7248 159.6C96.6006 162.724 96.6006 167.789 99.7248 170.913L112.331 183.52",
    "M109.853 46.9411L59.6482 97.1457C50.2756 106.518 50.2756 121.714 59.6482 131.087V131.087C69.0208 140.459 84.2167 140.459 93.5893 131.087L143.794 80.8822",
]

out = []
def add(s): out.append(s)

dots = []
def dot(x, y):
    dots.append(f'<circle class="dot" cx="{x}" cy="{y}" r="5.5"/>')

def node(x, y, label, icon, cls="node"):
    add(f'<rect class="{cls}" x="{x}" y="{y}" width="{NODE}" height="{NODE}" rx="16"/>')
    cx, cy = x + NODE / 2, y + NODE / 2
    add(f'<g transform="translate({cx},{cy}) scale({ICON}) translate({-cx},{-cy})">')
    icon(cx, cy)
    add("</g>")
    add(f'<text class="label" x="{x + NODE / 2}" y="{y + NODE + 36}" text-anchor="middle">{label}</text>')

# Icons, each drawn around its center
def dashboard(cx, cy):
    w, h = 62, 48
    x, y = cx - w / 2, cy - h / 2
    add(f'<rect class="ico" x="{x}" y="{y}" width="{w}" height="{h}" rx="4"/>')
    add(f'<line class="ico" x1="{x}" y1="{y + 11}" x2="{x + w}" y2="{y + 11}"/>')
    for i, bh in enumerate((12, 22, 17, 28)):
        add(f'<rect class="fill" x="{x + 10 + i * 12}" y="{y + h - 6 - bh}" width="7" height="{bh}"/>')

def mcp(cx, cy):
    s = 0.36
    add(f'<g transform="translate({cx - 97 * s},{cy - 106 * s}) scale({s})">'
        + "".join(f'<path class="mcp" d="{d}"/>' for d in MCP_MARK) + "</g>")

def glyph(text):
    return lambda cx, cy: add(f'<text class="glyph" x="{cx}" y="{cy + 14}" text-anchor="middle">{text}</text>')

def webapp(cx, cy):
    w, h = 92, 70
    x, y = cx - w / 2, cy - h / 2
    add(f'<rect class="ico-hub" x="{x}" y="{y}" width="{w}" height="{h}" rx="6"/>')
    add(f'<line class="ico-hub" x1="{x}" y1="{y + 16}" x2="{x + w}" y2="{y + 16}"/>')
    for i in range(3):
        add(f'<rect class="fill" x="{x + 8 + i * 9}" y="{y + 6}" width="5" height="5"/>')
    add(f'<rect class="fill" x="{x + 12}" y="{y + 28}" width="{w - 24}" height="6"/>')
    add(f'<rect class="fill" x="{x + 12}" y="{y + 42}" width="{w - 44}" height="6"/>')
    add(f'<rect class="fill" x="{x + 12}" y="{y + 56}" width="{w - 34}" height="6"/>')

# Spokes: a curve from each card to its own spot on the hub, with dots at both ends
for nx, hub_x in ((LX + NODE, HX), (RX, HX + HUB)):
    for ny, hy in ((TOP_Y, HY + 52), (BOT_Y, HY + HUB - 52)):
        y = ny + NODE / 2
        mx = (nx + hub_x) / 2
        add(f'<path class="spoke" d="M{nx} {y} C{mx} {y} {mx} {hy} {hub_x} {hy}"/>')
        dot(nx, y)
        dot(hub_x, hy)

node(LX, TOP_Y, "Dashboard", dashboard)
node(LX, BOT_Y, "API", glyph("{}"))
node(RX, TOP_Y, "MCP", mcp)
node(RX, BOT_Y, "CLI", glyph("&gt;_"))

add(f'<rect class="hub" x="{HX}" y="{HY}" width="{HUB}" height="{HUB}" rx="20"/>')
add(f'<g transform="translate({W / 2},{HCY}) scale({ICON}) translate({-W / 2},{-HCY})">')
webapp(W / 2, HCY)
add("</g>")
add(f'<text class="label" x="{W / 2}" y="{HY + HUB + 38}" text-anchor="middle">Your web app</text>')
out.extend(dots)  # on top of the cards, centered on their edges

body = "\n  ".join(out)
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-labelledby="t">
  <title id="t">Making your web app agent friendly: your web app in the middle, with spokes out to a dashboard, an MCP server, an API, and a CLI</title>
  <style>
    text {{ font-family: "IBM Plex Mono", ui-monospace, Menlo, monospace; fill: {INK}; }}
    .title {{ font-size: 46px; font-weight: 600; letter-spacing: -0.01em; }}
    .label {{ font-size: 26px; font-weight: 500; }}
    .glyph {{ font-size: 40px; font-weight: 700; }}
    .node {{ fill: {PAPER}; stroke: {LINE}; stroke-width: 1.5; }}
    .hub {{ fill: {Y}; stroke: {INK}; stroke-width: 2; }}
    .spoke {{ fill: none; stroke: {INK}; stroke-width: 2; stroke-linecap: round; }}
    .dot {{ fill: {Y}; stroke: {INK}; stroke-width: 1.75; }}
    .ico {{ fill: none; stroke: {INK}; stroke-width: 3; stroke-linejoin: round; }}
    .ico-hub {{ fill: none; stroke: {INK}; stroke-width: 3.5; stroke-linejoin: round; }}
    .fill {{ fill: {INK}; }}
    .mcp {{ fill: none; stroke: {INK}; stroke-width: 13; stroke-linecap: round; }}
  </style>
  <rect width="{W}" height="{H}" fill="{BG}"/>
  <text class="title" x="{W / 2}" y="96" text-anchor="middle">Making your web app agent friendly</text>
  {body}
</svg>
'''
open(sys.argv[1], "w").write(svg)
