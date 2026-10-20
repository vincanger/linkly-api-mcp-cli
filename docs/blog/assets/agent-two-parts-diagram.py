import re, sys

# A static, landscape take on agent-two-parts: the agent is one app with two parts, the client on
# top of the model, and your MCP server sits next to it, talking to the client.
W, H = 1000, 484

SRC = open(__file__.replace("-diagram.py", ".py")).read()
LOGOS = eval(re.search(r"^LOGOS = (\{.*\})$", SRC, re.M).group(1))

AGENT = (24, 24, 600, 436)
CLIENT = (48, 84, 552, 168)
MODEL = (48, 316, 552, 120)
SERVER = (720, 84, 256, 352)

out = []
def add(s): out.append(s)

def box(b, title, sub):
    x, y, w, h = b
    add(f'<rect class="box" x="{x}" y="{y}" width="{w}" height="{h}" rx="12"/>')
    add(f'<text class="t" x="{x + 22}" y="{y + 42}">{title}</text>')
    add(f'<text class="s" x="{x + 22}" y="{y + 70}">{sub}</text>')

# The agent: one dashed box around its two parts
x, y, w, h = AGENT
add(f'<rect class="agent" x="{x}" y="{y}" width="{w}" height="{h}" rx="14"/>')
add(f'<text class="cap-sm" x="{x + 24}" y="{y + 38}">YOUR AGENT</text>')
lx = x + 148
add(f'<text class="s" x="{lx}" y="{y + 38}">e.g.</text>')
lx += 38
for key, cls in (("claude", "logo-claude"), ("openai", "logo-mono"), ("grok", "logo-mono")):
    add(f'<g transform="translate({lx},{y + 18}) scale(0.95)"><path class="{cls}" fill-rule="evenodd" d="{LOGOS[key]}"/></g>')
    lx += 36

# The client, with a little chat window
box(CLIENT, 'Client <tspan class="tq">(harness / app)</tspan>', "the interaction layer")
cx, cy, cw, ch = CLIENT
fw, fh = 216, 136
fx, fy = cx + cw - fw - 20, cy + (ch - fh) / 2
add(f'<rect class="chat" x="{fx}" y="{fy}" width="{fw}" height="{fh}" rx="10"/>')
for i in range(3):
    add(f'<circle class="chat-dot" cx="{fx + 14 + i * 10}" cy="{fy + 13}" r="3"/>')
add(f'<line class="chat-rule" x1="{fx}" y1="{fy + 26}" x2="{fx + fw}" y2="{fy + 26}"/>')
# Your message, on the right
add(f'<rect class="bub-you" x="{fx + fw - 126}" y="{fy + 36}" width="112" height="22" rx="11"/>')
add(f'<rect class="bar-you" x="{fx + fw - 114}" y="{fy + 44}" width="74" height="6" rx="3"/>')
# The agent's reply, on the left
add(f'<rect class="bub-bot" x="{fx + 14}" y="{fy + 66}" width="140" height="34" rx="10"/>')
add(f'<rect class="bar-bot" x="{fx + 26}" y="{fy + 76}" width="112" height="6" rx="3"/>')
add(f'<rect class="bar-bot" x="{fx + 26}" y="{fy + 87}" width="76" height="6" rx="3"/>')
# The box you type into
add(f'<rect class="chat-in" x="{fx + 12}" y="{fy + fh - 28}" width="{fw - 24}" height="20" rx="10"/>')
add(f'<circle class="send" cx="{fx + fw - 22}" cy="{fy + fh - 18}" r="6"/>')

# The model underneath it
box(MODEL, "Model", "the LLM underneath.")
add(f'<text class="s" x="{MODEL[0] + 22}" y="{MODEL[1] + 94}">It decides what to do.</text>')

# A little neural network next to the model's title
mx, my, mw, mh = MODEL
layers = [3, 4, 4, 2]
nx0, nx1, ncy, gap = fx + 24, fx + fw - 24, my + mh / 2, 20
xs = [nx0 + i * (nx1 - nx0) / (len(layers) - 1) for i in range(len(layers))]
pts = [[(x, ncy + (j - (n - 1) / 2) * gap) for j in range(n)] for x, n in zip(xs, layers)]
for a, b in zip(pts, pts[1:]):
    for (x1, y1) in a:
        for (x2, y2) in b:
            add(f'<line class="nn-edge" x1="{x1}" y1="{y1:.1f}" x2="{x2}" y2="{y2:.1f}"/>')
for layer in pts:
    for (x, y) in layer:
        add(f'<circle class="nn-node" cx="{x}" cy="{y:.1f}" r="6"/>')

# The client sits on top of the model, and talks to your server
mid = cx + cw / 2
add(f'<line class="link" x1="{mid}" y1="{cy + ch + 8}" x2="{mid}" y2="{MODEL[1] - 8}" marker-start="url(#a)" marker-end="url(#a)"/>')
sy = cy + 52
add(f'<line class="link" x1="{cx + cw + 8}" y1="{sy}" x2="{SERVER[0] - 8}" y2="{sy}" marker-start="url(#a)" marker-end="url(#a)"/>')
add(f'<text class="lbl mono" x="{(cx + cw + SERVER[0]) / 2}" y="{sy - 14}" text-anchor="middle">MCP</text>')

# Your MCP server and its tools
box(SERVER, "Your MCP server", "its tools")
sx, sy, sw, sh = SERVER
for i, name in enumerate(("list_links", "shorten_link", "delete_link", "get_link_stats")):
    ry = sy + 104 + i * 60
    add(f'<rect class="row" x="{sx + 22}" y="{ry}" width="{sw - 44}" height="46" rx="8"/>')
    add(f'<text class="row-t mono" x="{sx + 40}" y="{ry + 29}">{name}</text>')

body = "\n  ".join(out)
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-labelledby="t d">
  <title id="t">An agent is two parts: the client and the model</title>
  <desc id="d">Your agent (for example Claude, ChatGPT or Codex, or Grok) is one app with two parts. On top is the client (the harness or app), the interaction layer: the chat window you type into. It talks to the model and to your MCP server. Underneath is the model, the LLM that decides what to do. Your MCP server sits next to the agent with its tools (list_links, shorten_link, delete_link, get_link_stats) and talks to the client, not to the model.</desc>
  <defs>
    <marker id="a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="arrow"/></marker>
  </defs>
  <style>
    svg {{
      --bg: #ffffff; --band: #f3f5f8; --box: #f8fafb; --ink: #15202b; --muted: #5a6774; --line: #cbd3db; --req: #2f5bd8;
    }}
    @media (prefers-color-scheme: dark) {{
      svg {{
        --bg: #0e141a; --band: #151d25; --box: #1b2530; --ink: #e4ebf1; --muted: #95a3b0; --line: #2c3845; --req: #7d9dff;
      }}
    }}
    text {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; fill: var(--ink); }}
    .mono {{ font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }}
    .bg {{ fill: var(--bg); }}
    .band {{ fill: var(--band); }}
    .agent {{ fill: none; stroke: var(--muted); stroke-width: 1.5; stroke-dasharray: 6 5; opacity: .7; }}
    .logo-claude {{ fill: #D97757; }}
    .logo-mono {{ fill: var(--ink); }}
    .cap-sm {{ font-size: 15px; font-weight: 700; letter-spacing: .08em; fill: var(--muted); }}
    .box {{ fill: var(--box); stroke: var(--line); stroke-width: 1; }}
    .t {{ font-size: 24px; font-weight: 600; }}
    .s {{ font-size: 18px; fill: var(--muted); }}
    .tq {{ font-size: 20px; font-weight: 400; fill: var(--muted); }}
    .chat {{ fill: var(--bg); stroke: var(--line); stroke-width: 1.5; }}
    .chat-dot {{ fill: var(--line); }}
    .chat-rule {{ stroke: var(--line); stroke-width: 1; }}
    .bub-you {{ fill: var(--req); }}
    .bar-you {{ fill: var(--bg); opacity: .8; }}
    .bub-bot {{ fill: var(--box); stroke: var(--line); stroke-width: 1; }}
    .bar-bot {{ fill: var(--muted); opacity: .45; }}
    .chat-in {{ fill: var(--box); stroke: var(--line); stroke-width: 1; }}
    .send {{ fill: var(--ink); }}
    .nn-edge {{ stroke: var(--muted); stroke-width: 1; opacity: .35; }}
    .nn-node {{ fill: var(--bg); stroke: var(--muted); stroke-width: 1.5; }}
    .link {{ stroke: var(--req); stroke-width: 3; stroke-linecap: round; }}
    .arrow {{ fill: var(--req); }}
    .lbl {{ font-size: 15px; font-weight: 700; fill: var(--req); letter-spacing: .05em; }}
    .row {{ fill: var(--bg); stroke: var(--line); stroke-width: 1; }}
    .row-t {{ font-size: 17px; }}
  </style>

  <rect class="bg" width="{W}" height="{H}" rx="14"/>
  <rect class="band" x="8" y="8" width="{W - 16}" height="{H - 16}" rx="10"/>
  {body}
</svg>
'''
open(sys.argv[1], "w").write(svg)
