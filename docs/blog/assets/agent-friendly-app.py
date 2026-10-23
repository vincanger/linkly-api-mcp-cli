import re, sys

# The intro diagram: your web app in the middle, with a spoke out to each surface that uses it:
# the dashboard people click around in, and the MCP server, API, and CLI agents use.
W, H = 1100, 668

HUB = (400, 268, 300, 240)
DASH = (40, 112, 320, 220)
MCP = (740, 112, 320, 220)
API = (40, 420, 320, 220)
CLI = (740, 420, 320, 220)

# The MCP mark (the icon part of modelcontextprotocol.io's logo), drawn in a ~150px box.
MCP_MARK = [
    "M25 97.8528L92.8822 29.9706C102.255 20.598 117.451 20.598 126.823 29.9706V29.9706C136.196 39.3431 136.196 54.5391 126.823 63.9117L75.5581 115.177",
    "M76.2652 114.47L126.823 63.9117C136.196 54.5391 151.392 54.5391 160.765 63.9117L161.118 64.2652C170.491 73.6378 170.491 88.8338 161.118 98.2063L99.7248 159.6C96.6006 162.724 96.6006 167.789 99.7248 170.913L112.331 183.52",
    "M109.853 46.9411L59.6482 97.1457C50.2756 106.518 50.2756 121.714 59.6482 131.087V131.087C69.0208 140.459 84.2167 140.459 93.5893 131.087L143.794 80.8822",
]

out = []
def add(s): out.append(s)

def box(b, title, cls="box"):
    x, y, w, h = b
    add(f'<rect class="{cls}" x="{x}" y="{y}" width="{w}" height="{h}" rx="12"/>')
    if title:
        add(f'<text class="t" x="{x + 22}" y="{y + 42}">{title}</text>')

# Spokes first, so the boxes sit on top of their ends
hx, hy, hw, hh = HUB
for (x, y, w, h), sy in ((DASH, hy + 60), (API, hy + hh - 60), (MCP, hy + 60), (CLI, hy + hh - 60)):
    left = x < hx
    x1, y1 = (x + w, y + h / 2) if left else (x, y + h / 2)
    x2 = hx if left else hx + hw
    mx = (x1 + x2) / 2
    add(f'<path class="spoke" d="M{x1} {y1} C{mx} {y1} {mx} {sy} {x2} {sy}"/>')
    add(f'<circle class="end" cx="{x1}" cy="{y1}" r="5"/>')
    add(f'<circle class="end" cx="{x2}" cy="{sy}" r="5"/>')

# Your web app, with the operations everything else calls
box(HUB, "Your web app", "box hub")
add(f'<text class="s" x="{hx + 22}" y="{hy + 70}">one set of operations</text>')
for i, name in enumerate(("createLink", "listLinks", "deleteLink")):
    ry = hy + 94 + i * 46
    add(f'<rect class="row" x="{hx + 22}" y="{ry}" width="{hw - 44}" height="36" rx="8"/>')
    add(f'<text class="row-t mono" x="{hx + 40}" y="{ry + 24}">{name}()</text>')

# Dashboard: a little browser window with a sidebar and a bar chart
box(DASH, "Dashboard")
x, y, w, h = DASH
fx, fy, fw, fh = x + 22, y + 64, w - 44, h - 86
add(f'<rect class="chat" x="{fx}" y="{fy}" width="{fw}" height="{fh}" rx="8"/>')
for i in range(3):
    add(f'<circle class="chat-dot" cx="{fx + 13 + i * 10}" cy="{fy + 12}" r="3"/>')
add(f'<rect class="url" x="{fx + 48}" y="{fy + 6}" width="{fw - 62}" height="12" rx="6"/>')
add(f'<line class="chat-rule" x1="{fx}" y1="{fy + 24}" x2="{fx + fw}" y2="{fy + 24}"/>')
add(f'<line class="chat-rule" x1="{fx + 60}" y1="{fy + 24}" x2="{fx + 60}" y2="{fy + fh}"/>')
for i in range(4):
    add(f'<rect class="bar-bot" x="{fx + 12}" y="{fy + 36 + i * 18}" width="{36 - (i % 2) * 10}" height="6" rx="3"/>')
base = fy + fh - 14
for i, bh in enumerate((26, 44, 34, 62, 50, 72)):
    add(f'<rect class="bar-chart" x="{fx + 78 + i * 26}" y="{base - bh}" width="16" height="{bh}" rx="3"/>')
add(f'<line class="chat-rule" x1="{fx + 72}" y1="{base}" x2="{fx + fw - 12}" y2="{base}"/>')

# MCP server: the MCP mark and a few tools
box(MCP, None)
x, y, w, h = MCP
add(f'<g transform="translate({x + 16},{y + 16}) scale(0.2)">' + "".join(
    f'<path class="mcp-mark" d="{d}"/>' for d in MCP_MARK) + "</g>")
add(f'<text class="t" x="{x + 60}" y="{y + 42}">MCP</text>')
for i, name in enumerate(("create_link", "list_links", "delete_link")):
    ry = y + 64 + i * 46
    add(f'<rect class="row" x="{x + 22}" y="{ry}" width="{w - 44}" height="36" rx="8"/>')
    add(f'<text class="row-t mono" x="{x + 40}" y="{ry + 24}">{name}</text>')

# API: a few endpoints
box(API, "API")
x, y, w, h = API
for i, (verb, path) in enumerate((("POST", "/api/v1/links"), ("GET", "/api/v1/links"), ("DELETE", "/api/v1/links/{id}"))):
    ry = y + 64 + i * 46
    add(f'<rect class="row" x="{x + 22}" y="{ry}" width="{w - 44}" height="36" rx="8"/>')
    add(f'<text class="row-t mono" x="{x + 36}" y="{ry + 24}"><tspan class="verb">{verb}</tspan> {path}</text>')

# CLI: a terminal
box(CLI, "CLI")
x, y, w, h = CLI
fx, fy, fw, fh = x + 22, y + 64, w - 44, h - 86
add(f'<rect class="term" x="{fx}" y="{fy}" width="{fw}" height="{fh}" rx="8"/>')
for i in range(3):
    add(f'<circle class="term-dot" cx="{fx + 13 + i * 10}" cy="{fy + 12}" r="3"/>')
add(f'<text class="term-t mono" x="{fx + 14}" y="{fy + 46}"><tspan class="prompt">$</tspan> linkly links list</text>')
for i, bw in enumerate((180, 150, 196)):
    add(f'<rect class="term-bar" x="{fx + 14}" y="{fy + 62 + i * 16}" width="{bw}" height="6" rx="3"/>')
add(f'<text class="term-t mono" x="{fx + 14}" y="{fy + fh - 10}"><tspan class="prompt">$</tspan> <tspan class="cursor">▍</tspan></text>')

body = "\n  ".join(out)
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-labelledby="t d">
  <title id="t">Designing an agent-friendly web app</title>
  <desc id="d">Your web app sits in the middle with one set of operations (createLink, listLinks, deleteLink). Four spokes go out from it: a dashboard for people, an MCP server with tools like create_link, a REST API with endpoints like POST /api/v1/links, and a CLI run from a terminal. All four call the same operations.</desc>
  <style>
    svg {{
      --bg: #ffffff; --band: #f3f5f8; --box: #f8fafb; --ink: #15202b; --muted: #5a6774; --line: #cbd3db; --req: #2f5bd8;
      --term: #15202b; --term-ink: #e4ebf1; --ok: #23863a;
    }}
    @media (prefers-color-scheme: dark) {{
      svg {{
        --bg: #0e141a; --band: #151d25; --box: #1b2530; --ink: #e4ebf1; --muted: #95a3b0; --line: #2c3845; --req: #7d9dff;
        --term: #070b0f; --term-ink: #e4ebf1; --ok: #5ccb74;
      }}
    }}
    text {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; fill: var(--ink); }}
    .mono {{ font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }}
    .bg {{ fill: var(--bg); }}
    .band {{ fill: var(--band); }}
    .title {{ font-size: 30px; font-weight: 700; }}
    .box {{ fill: var(--box); stroke: var(--line); stroke-width: 1; }}
    .hub {{ stroke: var(--req); stroke-width: 2.5; }}
    .t {{ font-size: 24px; font-weight: 600; }}
    .s {{ font-size: 18px; fill: var(--muted); }}
    .row {{ fill: var(--bg); stroke: var(--line); stroke-width: 1; }}
    .row-t {{ font-size: 16px; }}
    .verb {{ font-weight: 700; fill: var(--req); }}
    .spoke {{ fill: none; stroke: var(--req); stroke-width: 3; stroke-linecap: round; }}
    .end {{ fill: var(--req); }}
    .chat {{ fill: var(--bg); stroke: var(--line); stroke-width: 1.5; }}
    .chat-dot {{ fill: var(--line); }}
    .chat-rule {{ stroke: var(--line); stroke-width: 1; }}
    .url {{ fill: var(--box); stroke: var(--line); stroke-width: 1; }}
    .bar-bot {{ fill: var(--muted); opacity: .45; }}
    .bar-chart {{ fill: var(--req); opacity: .8; }}
    .mcp-mark {{ fill: none; stroke: var(--ink); stroke-width: 12; stroke-linecap: round; }}
    .term {{ fill: var(--term); }}
    .term-dot {{ fill: var(--term-ink); opacity: .3; }}
    .term-t {{ font-size: 15px; fill: var(--term-ink); }}
    .term-bar {{ fill: var(--term-ink); opacity: .3; }}
    .prompt {{ fill: var(--ok); font-weight: 700; }}
    .cursor {{ fill: var(--term-ink); opacity: .7; }}
  </style>

  <rect class="bg" width="{W}" height="{H}" rx="14"/>
  <rect class="band" x="8" y="8" width="{W - 16}" height="{H - 16}" rx="10"/>
  <text class="title" x="{W / 2}" y="66" text-anchor="middle">Designing an Agent-friendly web app</text>
  {body}
</svg>
'''
open(sys.argv[1], "w").write(svg)
light = re.sub(r"\n    @media \(prefers-color-scheme: dark\) \{.*?\n    \}\n", "\n", svg, flags=re.S)
assert "prefers-color-scheme" not in light
open(sys.argv[1].replace(".svg", "-light.svg"), "w").write(light)
