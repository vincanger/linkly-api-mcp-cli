import re, sys

# Who answers "are you sure?" when the agent tries to delete the wrong link, styled like
# agent-two-parts-diagram.svg. With a flag, the question goes back to the model, which answers it.
# With MCP, it goes to the client (where you are), which shows you the page.
W, PH, GAP = 1000, 412, 16
H = 8 + PH + GAP + PH + 8

SRC = open(__file__.replace("confirmation-paths.py", "agent-two-parts.py")).read()
LOGOS = eval(re.search(r"^LOGOS = (\{.*\})$", SRC, re.M).group(1))

AGENT = (24, 56, 540, 340)
CLIENT = (48, 116, 492, 150)
MODEL = (48, 290, 492, 90)
SERVER = (730, 116, 246, 264)
CHAT = (310, 123, 216, 136)
LX = AGENT[0] + AGENT[2] + 18  # arrow numbers, just right of the agent

ax, ay, aw, ah = AGENT
cx, cy, cw, ch = CLIENT
mx, my, mw, mh = MODEL
sx, sy, sw, sh = SERVER
fx, fy, fw, fh = CHAT

def box(b, title, sub, sub_cls="s", cls="box"):
    x, y, w, h = b
    return (f'<rect class="{cls}" x="{x}" y="{y}" width="{w}" height="{h}" rx="12"/>'
            f'<text class="t" x="{x + 22}" y="{y + 42}">{title}</text>'
            f'<text class="{sub_cls}" x="{x + 22}" y="{y + 70}">{sub}</text>')

def arrow(d, kind, label, ly):
    return (f'<path class="w-{kind}" d="{d}" marker-end="url(#a-{kind})"/>'
            f'<text class="lbl mono l-{kind}" x="{LX + 18}" y="{ly}">{label}</text>')

def num(n, y, kind):
    return (f'<circle cx="{LX}" cy="{y}" r="12" class="n-{kind}"/>'
            f'<text class="num" x="{LX}" y="{y + 5}" text-anchor="middle">{n}</text>')

def agent():
    s = [f'<rect class="agent" x="{ax}" y="{ay}" width="{aw}" height="{ah}" rx="14"/>',
         f'<text class="cap-sm" x="{ax + 24}" y="{ay + 38}">YOUR AGENT</text>',
         f'<text class="s" x="{ax + 148}" y="{ay + 38}">e.g.</text>']
    lx = ax + 186
    for key, cls in (("claude", "logo-claude"), ("openai", "logo-mono"), ("grok", "logo-mono")):
        s.append(f'<g transform="translate({lx},{ay + 18}) scale(0.95)"><path class="{cls}" fill-rule="evenodd" d="{LOGOS[key]}"/></g>')
        lx += 36
    return s

def chat_frame():
    s = [f'<rect class="chat" x="{fx}" y="{fy}" width="{fw}" height="{fh}" rx="10"/>']
    for i in range(3):
        s.append(f'<circle class="chat-dot" cx="{fx + 14 + i * 10}" cy="{fy + 13}" r="3"/>')
    s.append(f'<line class="chat-rule" x1="{fx}" y1="{fy + 26}" x2="{fx + fw}" y2="{fy + 26}"/>')
    return s

def network():
    layers, gap = [3, 4, 4, 2], 16
    nx0, nx1, ncy = fx + 24, fx + fw - 24, my + mh / 2
    xs = [nx0 + i * (nx1 - nx0) / (len(layers) - 1) for i in range(len(layers))]
    pts = [[(x, ncy + (j - (n - 1) / 2) * gap) for j in range(n)] for x, n in zip(xs, layers)]
    s = []
    for a, b in zip(pts, pts[1:]):
        for (x1, y1) in a:
            for (x2, y2) in b:
                s.append(f'<line class="nn-edge" x1="{x1}" y1="{y1:.1f}" x2="{x2}" y2="{y2:.1f}"/>')
    for layer in pts:
        for (x, y) in layer:
            s.append(f'<circle class="nn-node" cx="{x}" cy="{y:.1f}" r="5.5"/>')
    return s

def server(sub, result, cls):
    a, b = result
    return [box(SERVER, "Linkly", sub),
            f'<rect class="row" x="{sx + 22}" y="{sy + 94}" width="{sw - 44}" height="46" rx="8"/>',
            f'<text class="row-t mono" x="{sx + 40}" y="{sy + 123}">delete_link</text>',
            f'<rect class="{cls}-bg" x="{sx + 22}" y="{sy + 164}" width="{sw - 44}" height="76" rx="10"/>',
            f'<text class="res-{cls}" x="{sx + sw / 2}" y="{sy + 196}" text-anchor="middle">{a}</text>',
            f'<text class="res-{cls}" x="{sx + sw / 2}" y="{sy + 222}" text-anchor="middle">{b}</text>']

CLIENT_T = 'Client <tspan class="tq">(where you are)</tspan>'

def panel(y0, head, body):
    s = [f'<g transform="translate(0,{y0})">',
         f'<rect class="band" x="8" width="{W - 16}" height="{PH}" rx="10"/>',
         f'<text class="head" x="24" y="36">{head}</text>']
    s += agent() + body
    s.append('</g>')
    return "\n  ".join(s)

# With a flag: the question goes back to the model, and the model answers it. Your chat carries on.
flag = ['<g opacity=".4">', box(CLIENT, CLIENT_T, "just passes the question on")]
flag += chat_frame()
flag += [f'<rect class="bub-you" x="{fx + fw - 126}" y="{fy + 38}" width="112" height="22" rx="11"/>',
         f'<rect class="bar-you" x="{fx + fw - 114}" y="{fy + 46}" width="74" height="6" rx="3"/>',
         f'<rect class="bub-bot" x="{fx + 14}" y="{fy + 70}" width="140" height="34" rx="10"/>',
         f'<rect class="bar-bot" x="{fx + 26}" y="{fy + 80}" width="112" height="6" rx="3"/>',
         f'<rect class="bar-bot" x="{fx + 26}" y="{fy + 91}" width="76" height="6" rx="3"/>',
         f'<rect class="chat-in" x="{fx + 12}" y="{fy + fh - 26}" width="{fw - 24}" height="18" rx="9"/>',
         f'<circle class="send" cx="{fx + fw - 22}" cy="{fy + fh - 17}" r="5.5"/>',
         f'<text class="s" x="{cx + 22}" y="{cy + 114}">you\'re never asked</text>',
         '</g>',
         box(MODEL, "Model", "answers it itself", "s-warn", "box box-warn")]
flag += network()
flag += server("your API or CLI", ("/r/wasp", "deleted"), "bad")
flag += [arrow(f"M{sx} {my + 28} H{mx + mw + 8}", "req", "confirm=true?", my + 16), num(1, my + 11, "req"),
         arrow(f"M{mx + mw} {my + 62} H{sx - 8}", "warn", "confirm=true", my + 88), num(2, my + 83, "warn")]

# With MCP: the question goes to the client, which shows you Linkly's page, and your answer goes back
dx, dy, dw, dh = fx + 12, fy + 38, fw - 24, 86
mcp = [box(CLIENT, CLIENT_T, "opens Linkly's page for you", "s-req")]
mcp += chat_frame()
mcp += [f'<rect class="dialog" x="{dx}" y="{dy}" width="{dw}" height="{dh}" rx="8"/>',
        f'<text class="dq" x="{dx + 14}" y="{dy + 28}">Delete /r/wasp?</text>',
        f'<rect class="btn-del" x="{dx + 14}" y="{dy + 44}" width="80" height="28" rx="6"/>',
        f'<text class="bt bt-on" x="{dx + 54}" y="{dy + 63}" text-anchor="middle">Delete</text>',
        f'<rect class="btn-ghost" x="{dx + 104}" y="{dy + 44}" width="80" height="28" rx="6"/>',
        f'<rect class="press" x="{dx + 101}" y="{dy + 41}" width="86" height="34" rx="8"/>',
        f'<text class="bt" x="{dx + 144}" y="{dy + 63}" text-anchor="middle">Cancel</text>',
        f'<g opacity=".4">{box(MODEL, "Model", "never sees the question")}' + "".join(network()) + '</g>']
mcp += server("your MCP server", ("nothing", "deleted"), "ok")
mcp += [arrow(f"M{sx} {cy + 36} H{cx + cw + 8}", "req", "are you sure?", cy + 24), num(1, cy + 19, "req"),
        arrow(f"M{dx + dw + 6} {dy + 58} H{sx - 8}", "ok", "Cancel", dy + 84), num(2, dy + 79, "ok")]

top = panel(8, "WITH A CONFIRM FLAG (API OR CLI)", flag)
bottom = panel(8 + PH + GAP, "WITH MCP", mcp)

markers = "".join(
    f'<marker id="a-{k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">'
    f'<path d="M0 0 L10 5 L0 10 z" style="fill:var(--{k})"/></marker>' for k in ("req", "warn", "ok"))

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-labelledby="t d">
  <title id="t">Who answers "are you sure?": a confirm flag vs. MCP</title>
  <desc id="d">Two panels, one above the other. Your agent tried to delete the wrong Linkly link, /r/wasp. With a confirm flag on an API or CLI, Linkly asks "confirm=true?", the client (where you are) just passes the question on to the model, the model answers confirm=true itself, and /r/wasp is deleted. You're never asked. With MCP, Linkly asks "are you sure?" and the question goes to the client, which opens Linkly's confirmation page right where you are: "Delete /r/wasp?" You click Cancel, the answer goes straight back to Linkly, and nothing is deleted. The model never sees the question.</desc>
  <defs>{markers}</defs>
  <style>
    svg {{
      --bg: #ffffff; --band: #f3f5f8; --box: #f8fafb; --ink: #15202b; --muted: #5a6774; --line: #cbd3db; --req: #2f5bd8;
      --warn: #c4382f; --warn-bg: #fbeaea; --ok: #23863a; --ok-bg: #e9f5ec; --on: #ffffff;
    }}
    @media (prefers-color-scheme: dark) {{
      svg {{
        --bg: #0e141a; --band: #151d25; --box: #1b2530; --ink: #e4ebf1; --muted: #95a3b0; --line: #2c3845; --req: #7d9dff;
        --warn: #ff7b72; --warn-bg: #3a1d1d; --ok: #5ccb74; --ok-bg: #173323; --on: #0e141a;
      }}
    }}
    text {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; fill: var(--ink); }}
    .mono {{ font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }}
    .bg {{ fill: var(--bg); }}
    .band {{ fill: var(--band); }}
    .head {{ font-size: 15px; font-weight: 700; letter-spacing: .08em; fill: var(--ink); }}
    .agent {{ fill: none; stroke: var(--muted); stroke-width: 1.5; stroke-dasharray: 6 5; opacity: .7; }}
    .logo-claude {{ fill: #D97757; }}
    .logo-mono {{ fill: var(--ink); }}
    .cap-sm {{ font-size: 15px; font-weight: 700; letter-spacing: .08em; fill: var(--muted); }}
    .box {{ fill: var(--box); stroke: var(--line); stroke-width: 1; }}
    .box-warn {{ stroke: var(--warn); stroke-width: 2.5; }}
    .t {{ font-size: 24px; font-weight: 600; }}
    .s {{ font-size: 18px; fill: var(--muted); }}
    .s-warn {{ font-size: 18px; fill: var(--warn); font-weight: 600; }}
    .s-req {{ font-size: 18px; fill: var(--req); font-weight: 600; }}
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
    .row {{ fill: var(--bg); stroke: var(--line); stroke-width: 1; }}
    .row-t {{ font-size: 17px; }}
    .w-req {{ fill: none; stroke: var(--req); stroke-width: 3; stroke-linecap: round; }}
    .w-warn {{ fill: none; stroke: var(--warn); stroke-width: 3; stroke-linecap: round; }}
    .w-ok {{ fill: none; stroke: var(--ok); stroke-width: 3; stroke-linecap: round; }}
    .lbl {{ font-size: 14px; font-weight: 700; }}
    .l-req {{ fill: var(--req); }} .l-warn {{ fill: var(--warn); }} .l-ok {{ fill: var(--ok); }}
    .n-req {{ fill: var(--req); }} .n-warn {{ fill: var(--warn); }} .n-ok {{ fill: var(--ok); }}
    .num {{ font-size: 13px; font-weight: 700; fill: var(--on); }}
    .bad-bg {{ fill: var(--warn-bg); }}
    .ok-bg {{ fill: var(--ok-bg); }}
    .x {{ fill: none; stroke: var(--warn); stroke-width: 2.4; stroke-linecap: round; }}
    .tag-warn {{ font-size: 18px; fill: var(--warn); font-weight: 600; }}
    .res-bad {{ font-size: 19px; fill: var(--warn); font-weight: 700; }}
    .res-ok {{ font-size: 19px; fill: var(--ok); font-weight: 700; }}
    .dialog {{ fill: var(--bg); stroke: var(--req); stroke-width: 1.5; }}
    .dq {{ font-size: 16px; font-weight: 600; }}
    .btn-ghost {{ fill: var(--bg); stroke: var(--line); stroke-width: 1; }}
    .btn-del {{ fill: var(--warn); }}
    .press {{ fill: none; stroke: var(--ok); stroke-width: 2.5; }}
    .bt {{ font-size: 14px; font-weight: 600; }}
    .bt-on {{ fill: var(--on); }}
  </style>

  <rect class="bg" width="{W}" height="{H}" rx="14"/>
  {top}
  {bottom}
</svg>
'''
open(sys.argv[1], "w").write(svg)
light = re.sub(r"\n    @media \(prefers-color-scheme: dark\) \{\{?.*?\n    \}\n", "\n", svg, flags=re.S)
assert "prefers-color-scheme" not in light
open(sys.argv[1].replace(".svg", "-light.svg"), "w").write(light)
