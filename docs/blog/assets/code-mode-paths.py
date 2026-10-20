import re, sys

# Tagging 300 links through MCP tools, with and without code mode, styled like confirmation-paths.svg.
# Without it, every call and result goes through the model's context. With it, the model writes a loop,
# the client runs it in a sandbox, and only the last line comes back.
W, PH, GAP = 1100, 548, 16
H = 8 + PH + GAP + PH + 8

SRC = open(__file__.replace("code-mode-paths.py", "agent-two-parts.py")).read()
LOGOS = eval(re.search(r"^LOGOS = (\{.*\})$", SRC, re.M).group(1))

AGENT = (24, 56, 640, 472)
CLIENT = (48, 116, 592, 222)
MODEL = (48, 408, 592, 96)
SERVER = (820, 116, 256, 388)
CARD = (70, 178, 548, 140)

ax, ay, aw, ah = AGENT
cx, cy, cw, ch = CLIENT
mx, my, mw, mh = MODEL
sx, sy, sw, sh = SERVER
kx, ky, kw, kh = CARD

def box(b, title, sub, sub_cls="s", cls="box"):
    x, y, w, h = b
    return (f'<rect class="{cls}" x="{x}" y="{y}" width="{w}" height="{h}" rx="12"/>'
            f'<text class="t" x="{x + 22}" y="{y + 42}">{title}</text>'
            f'<text class="{sub_cls}" x="{x + 22}" y="{y + 70}">{sub}</text>')

def client(sub, sub_cls):
    return (f'<rect class="box" x="{cx}" y="{cy}" width="{cw}" height="{ch}" rx="12"/>'
            f'<text class="t" x="{cx + 22}" y="{cy + 42}">Client</text>'
            f'<text class="{sub_cls}" x="{cx + 110}" y="{cy + 41}">{sub}</text>')

def num(n, x, y, kind):
    return (f'<circle cx="{x}" cy="{y}" r="12" class="n-{kind}"/>'
            f'<text class="num" x="{x}" y="{y + 5}" text-anchor="middle">{n}</text>')

def round_trip(x1, x2, kind, n=None):
    # One call out to Linkly and one result back, repeated 300 times
    y1, y2, mid = ky + kh / 2 - 10, ky + kh / 2 + 10, (x1 + x2) / 2
    s = [f'<path class="w-{kind}" d="M{x1} {y1} H{x2 - 8}" marker-end="url(#a-{kind})"/>',
         f'<path class="w-{kind}" d="M{x2} {y2} H{x1 + 8}" marker-end="url(#a-{kind})"/>',
         f'<text class="lbl mono l-{kind}" x="{mid}" y="{y1 - 14}" text-anchor="middle">update_link</text>',
         f'<text class="x300 l-{kind}" x="{mid}" y="{y2 + 30}" text-anchor="middle">×300</text>']
    if n:
        s.append(num(n, mid - 66, y1 - 19, kind))
    return s

def vertical(x, up, kind, label, n=None, mono=False):
    # Between the client and the model
    d = f"M{x} {my - 4} V{cy + ch + 10}" if up else f"M{x} {cy + ch + 4} V{my - 10}"
    ly = (cy + ch + my) / 2
    s = [f'<path class="w-{kind}" d="{d}" marker-end="url(#a-{kind})"/>']
    tx = x + 18
    if n:
        s.append(num(n, x + 26, ly, kind))
        tx = x + 44
    s.append(f'<text class="lbl{" mono" if mono else ""} l-{kind}" x="{tx}" y="{ly + 5}">{label}</text>')
    return s

def agent():
    s = [f'<rect class="agent" x="{ax}" y="{ay}" width="{aw}" height="{ah}" rx="14"/>',
         f'<text class="cap-sm" x="{ax + 24}" y="{ay + 38}">YOUR AGENT</text>',
         f'<text class="s" x="{ax + 148}" y="{ay + 38}">e.g.</text>']
    lx = ax + 186
    for key, cls in (("claude", "logo-claude"), ("openai", "logo-mono"), ("grok", "logo-mono")):
        s.append(f'<g transform="translate({lx},{ay + 18}) scale(0.95)"><path class="{cls}" fill-rule="evenodd" d="{LOGOS[key]}"/></g>')
        lx += 36
    return s

def meter(fill, caption, kind):
    bx, bw = mx + mw - 262, 240
    return [f'<text class="cap-xs" x="{bx}" y="{my + 30}">CONTEXT</text>',
            f'<rect class="meter" x="{bx}" y="{my + 40}" width="{bw}" height="16" rx="8"/>',
            f'<rect class="fill-{kind}" x="{bx}" y="{my + 40}" width="{max(16, bw * fill):.0f}" height="16" rx="8"/>',
            f'<text class="cap-{kind}" x="{bx}" y="{my + 78}">{caption}</text>']

def server():
    return [box(SERVER, "Linkly", "your MCP server"),
            f'<rect class="row" x="{sx + 22}" y="{sy + 94}" width="{sw - 44}" height="46" rx="8"/>',
            f'<text class="row-t mono" x="{sx + 40}" y="{sy + 123}">list_links</text>',
            f'<rect class="row" x="{sx + 22}" y="{sy + 152}" width="{sw - 44}" height="46" rx="8"/>',
            f'<text class="row-t mono" x="{sx + 40}" y="{sy + 181}">update_link</text>',
            f'<rect class="ok-bg" x="{sx + 22}" y="{sy + sh - 100}" width="{sw - 44}" height="76" rx="10"/>',
            f'<text class="res-ok" x="{sx + sw / 2}" y="{sy + sh - 68}" text-anchor="middle">300 links</text>',
            f'<text class="res-ok" x="{sx + sw / 2}" y="{sy + sh - 42}" text-anchor="middle">tagged</text>']

def card_frame(label):
    return [f'<rect class="chat" x="{kx}" y="{ky}" width="{kw}" height="{kh}" rx="10"/>',
            *[f'<circle class="chat-dot" cx="{kx + 14 + i * 10}" cy="{ky + 13}" r="3"/>' for i in range(3)],
            f'<text class="cap-xs" x="{kx + 50}" y="{ky + 17}">{label}</text>',
            f'<line class="chat-rule" x1="{kx}" y1="{ky + 26}" x2="{kx + kw}" y2="{ky + 26}"/>']

CODE = '''const links = await list_links(…)
for (const link of links) {
  await update_link(link.id, …)
}
return "Tagged 300 links"'''

TOKEN = re.compile(r'("[^"]*"|`[^`]*`|\b(?:const|await|for|of|return)\b|\b(?:list_links|update_link)\b)')

def highlight(line):
    out = []
    for part in TOKEN.split(line):
        if not part:
            continue
        if part[0] in '"`':
            out.append(f'<tspan class="c-str">{part}</tspan>')
        elif part in ("list_links", "update_link"):
            out.append(f'<tspan class="c-fn">{part}</tspan>')
        elif TOKEN.fullmatch(part):
            out.append(f'<tspan class="c-kw">{part}</tspan>')
        else:
            out.append(part)
    return "".join(out)

def code():
    return [f'<text class="code mono" xml:space="preserve" x="{kx + 16}" y="{ky + 50 + i * 18}">{highlight(l)}</text>'
            for i, l in enumerate(CODE.split("\n"))]

def panel(y0, head, body):
    s = [f'<g transform="translate(0,{y0})">',
         f'<rect class="band" x="8" width="{W - 16}" height="{PH}" rx="10"/>',
         f'<text class="head" x="24" y="36">{head}</text>']
    s += agent() + body
    s.append('</g>')
    return "\n  ".join(s)

# Without code mode: the model calls update_link 300 times, and every result lands in its context
plain = [client("makes each call for the model", "s")]
plain += card_frame("chat")
plain += [f'<rect class="bub-you" x="{kx + kw - 330}" y="{ky + 40}" width="316" height="30" rx="15"/>',
          f'<text class="bub-t" x="{kx + kw - 172}" y="{ky + 60}" text-anchor="middle">Tag every example.com link as partner</text>']
for i, (t, op) in enumerate((("update_link  1/300", 1), ("update_link  2/300 …", .6))):
    plain.append(f'<text class="call mono" x="{kx + 16}" y="{ky + 94 + i * 22}" opacity="{op}">{t}</text>')
plain += [box(MODEL, "Model", "reads every result", "s-warn", "box box-warn")]
plain += meter(.94, "300 calls and 300 results", "warn")
plain += server()
plain += round_trip(cx + cw, sx, "warn")
plain += vertical(mx + 60, True, "req", "asks for the next call")
plain += vertical(mx + 330, False, "warn", "passes every result back")

# With code mode: the model writes the loop once, the client runs it, and one line comes back
a1x, a3x = mx + 60, mx + 330
cm = [client("runs the code in a sandbox", "s-req")]
cm += card_frame("sandbox")
cm += code()
cm += [box(MODEL, "Model", "writes the loop once"),
       *meter(.03, "just the last line", "ok")]
cm += server()
cm += round_trip(kx + kw, sx, "req", 2)
cm += vertical(a1x, True, "req", "writes the code", 1)
cm += vertical(a3x, False, "ok", '"Tagged 300 links"', 3, mono=True)

top = panel(8, "WITHOUT CODE MODE", plain)
bottom = panel(8 + PH + GAP, "WITH CODE MODE", cm)

markers = "".join(
    f'<marker id="a-{k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">'
    f'<path d="M0 0 L10 5 L0 10 z" style="fill:var(--{k})"/></marker>' for k in ("req", "warn", "ok"))


svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-labelledby="t d">
  <title id="t">Tagging 300 links through MCP, without and with code mode</title>
  <desc id="d">Two panels, one above the other. You ask your agent to tag every example.com link in Linkly as partner. Without code mode, the model asks the client for each call, the client calls update_link on Linkly 300 times, and passes every result back to the model, whose context fills up. With code mode, the model writes a short loop once: get the matching links with list_links, call update_link on each, and return "Tagged 300 links". The client runs that loop in a sandbox, the sandbox makes the 300 calls to Linkly's MCP server, and only the last line, "Tagged 300 links", goes back to the model. Either way, Linkly ends up with 300 links tagged.</desc>
  <defs>{markers}</defs>
  <style>
    svg {{
      --bg: #ffffff; --band: #f3f5f8; --box: #f8fafb; --ink: #15202b; --muted: #5a6774; --line: #cbd3db; --req: #2f5bd8;
      --warn: #c4382f; --warn-bg: #fbeaea; --ok: #23863a; --ok-bg: #e9f5ec; --on: #ffffff; --str: #a3551a;
    }}
    @media (prefers-color-scheme: dark) {{
      svg {{
        --bg: #0e141a; --band: #151d25; --box: #1b2530; --ink: #e4ebf1; --muted: #95a3b0; --line: #2c3845; --req: #7d9dff;
        --warn: #ff7b72; --warn-bg: #3a1d1d; --ok: #5ccb74; --ok-bg: #173323; --on: #0e141a; --str: #e3a76f;
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
    .cap-xs {{ font-size: 12px; font-weight: 700; letter-spacing: .08em; fill: var(--muted); }}
    .cap-warn {{ font-size: 15px; font-weight: 600; fill: var(--warn); }}
    .cap-ok {{ font-size: 15px; font-weight: 600; fill: var(--ok); }}
    .box {{ fill: var(--box); stroke: var(--line); stroke-width: 1; }}
    .box-warn {{ stroke: var(--warn); stroke-width: 2.5; }}
    .t {{ font-size: 24px; font-weight: 600; }}
    .s {{ font-size: 18px; fill: var(--muted); }}
    .s-warn {{ font-size: 18px; fill: var(--warn); font-weight: 600; }}
    .s-req {{ font-size: 18px; fill: var(--req); font-weight: 600; }}
    .chat {{ fill: var(--bg); stroke: var(--line); stroke-width: 1.5; }}
    .chat-dot {{ fill: var(--line); }}
    .chat-rule {{ stroke: var(--line); stroke-width: 1; }}
    .bub-you {{ fill: var(--req); }}
    .bub-t {{ font-size: 14px; font-weight: 500; fill: var(--on); }}
    .call {{ font-size: 14px; fill: var(--muted); }}
    .code {{ font-size: 15px; white-space: pre; }}
    .c-kw {{ fill: var(--req); }}
    .c-str {{ fill: var(--str); }}
    .c-fn {{ font-weight: 700; }}
    .meter {{ fill: var(--bg); stroke: var(--line); stroke-width: 1; }}
    .fill-warn {{ fill: var(--warn); }}
    .fill-ok {{ fill: var(--ok); }}
    .row {{ fill: var(--bg); stroke: var(--line); stroke-width: 1; }}
    .row-t {{ font-size: 17px; }}
    .w-req {{ fill: none; stroke: var(--req); stroke-width: 3; stroke-linecap: round; }}
    .w-warn {{ fill: none; stroke: var(--warn); stroke-width: 3; stroke-linecap: round; }}
    .w-ok {{ fill: none; stroke: var(--ok); stroke-width: 3; stroke-linecap: round; }}
    .lbl {{ font-size: 14px; font-weight: 700; }}
    .lbl.mono {{ font-size: 14px; }}
    .x300 {{ font-size: 20px; font-weight: 700; }}
    .l-req {{ fill: var(--req); }} .l-warn {{ fill: var(--warn); }} .l-ok {{ fill: var(--ok); }}
    .n-req {{ fill: var(--req); }} .n-warn {{ fill: var(--warn); }} .n-ok {{ fill: var(--ok); }}
    .num {{ font-size: 13px; font-weight: 700; fill: var(--on); }}
    .ok-bg {{ fill: var(--ok-bg); }}
    .res-ok {{ font-size: 19px; fill: var(--ok); font-weight: 700; }}
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
