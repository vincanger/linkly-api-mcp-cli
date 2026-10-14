import sys
T = 14.0  # loop length, seconds

def kt(x): return f"{x / T:.4f}"

def show(a, b=None, base_visible=False):
    """Visible from a to b (seconds); b=None means until the end of the loop."""
    if b is None:
        values, times = ("0;1", f"0;{kt(a)}") if a > 0 else ("1", "0")
    elif a == 0:
        values, times = "1;0", f"0;{kt(b)}"
    else:
        values, times = "0;1;0", f"0;{kt(a)};{kt(b)}"
    return (f'<animate attributeName="opacity" dur="{T:g}s" repeatCount="indefinite" '
            f'calcMode="discrete" values="{values}" keyTimes="{times}"/>')

def move(path_id, a, b):
    return (f'<animateMotion dur="{T:g}s" repeatCount="indefinite" calcMode="linear" '
            f'keyPoints="0;0;1;1" keyTimes="0;{kt(a)};{kt(b)};1"><mpath xlink:href="#{path_id}"/></animateMotion>')

def dot(pid, a, b, color):
    return (f'<circle class="pkt" r="7" opacity="0" style="fill:var(--{color})">'
            f'{move(pid, a, b)}{show(a, b)}</circle>')

# Panel geometry (local coordinates inside each panel)
YOU = (36, 52, 186, 54)       # x, y, w, h
CLI = (36, 180, 186, 54)
AGT = (262, 180, 154, 54)
SRV = (36, 308, 186, 54)
CX = CLI[0] + CLI[2] / 2      # spine x = 129
CY = CLI[1] + CLI[3] / 2      # client row y = 207
PAGE = (228, 28, 190, 142)    # your app's confirmation page, MCP panel only
GAP_X = 242                   # the gap between the client and agent columns

def box(b, title, sub, sub_mono=False, accent=None):
    x, y, w, h = b
    s = f'<g transform="translate({x},{y})"><rect class="box" width="{w}" height="{h}" rx="9"/>'
    if accent:
        s += f'<rect width="{w}" height="4" rx="2" style="fill:var(--{accent})"/>'
    s += f'<text class="t" x="14" y="25">{title}</text>'
    s += f'<text class="s{" mono" if sub_mono else ""}" x="14" y="43">{sub}</text></g>'
    return s

def cursor(x, y, appear, a, b, click, dx=44, dy=50):
    """Pointer that appears at (x+dx, y+dy), glides its tip to (x, y) from a to b, and clicks at `click`."""
    ease = "0.4 0 0.2 1"
    glide = (f'<animateTransform attributeName="transform" type="translate" dur="{T:g}s" repeatCount="indefinite" '
             f'calcMode="spline" keySplines="0 0 1 1; {ease}; 0 0 1 1" '
             f'values="{dx} {dy};{dx} {dy};0 0;0 0" keyTimes="0;{kt(a)};{kt(b)};1"/>')
    press = (f'<animateTransform attributeName="transform" type="scale" dur="{T:g}s" repeatCount="indefinite" '
             f'values="1;1;0.82;1;1" keyTimes="0;{kt(click - 0.06)};{kt(click)};{kt(click + 0.12)};1"/>')
    return (f'<g transform="translate({x},{y})"><g opacity="1">{show(appear)}<g>{glide}<g>{press}'
            f'<path class="cursor" d="M0 0 L0 17 L4.2 13.2 L7 19.6 L9.9 18.3 L7.2 12 L12.6 12 Z"/>'
            f'</g></g></g></g>')

def caption(n, lines, a, b, color, final=False):
    base = "1" if final else "0"
    s = f'<g opacity="{base}">{show(a, b)}'
    s += f'<circle cx="36" cy="410" r="12" style="fill:var(--{color})"/>'
    s += f'<text x="36" y="414.5" text-anchor="middle" class="num">{n}</text>'
    for i, line in enumerate(lines):
        s += f'<text class="cap" x="58" y="{405 + i * 20}">{line}</text>'
    return s + '</g>'

def mark_x(cx, cy):
    return (f'<circle cx="{cx}" cy="{cy}" r="10" class="bad-bg"/>'
            f'<path class="x" d="M{cx - 4} {cy - 4} l8 8 M{cx + 4} {cy - 4} l-8 8"/>')

def panel(kind):
    api = kind == "api"
    p = "a" if api else "m"
    color = "rest" if api else "mcp"
    out = []
    out.append('<rect class="band" width="428" height="452" rx="10"/>')
    out.append(f'<rect width="428" height="5" rx="2.5" style="fill:var(--{color})"/>')
    out.append(f'<text class="h" x="18" y="34">{"With a flag the agent can set" if api else "With MCP"}</text>')

    # Paths for the dots (drawn invisibly; wires are drawn separately)
    ax0 = AGT[0]
    sy = SRV[1] + SRV[3] / 2
    out.append(f'<path id="{p}-a2s" fill="none" d="M{ax0} {CY} H{CX} V{SRV[1]}"/>')
    out.append(f'<path id="{p}-s2a" fill="none" d="M{CX} {SRV[1]} V{CY} H{ax0}"/>')
    out.append(f'<path id="{p}-s2c" fill="none" d="M{CX} {SRV[1]} V{CLI[1] + CLI[3]}"/>')
    out.append(f'<path id="{p}-c2y" fill="none" d="M{CX} {CLI[1]} V{YOU[1] + YOU[3]}"/>')
    # The answer goes from your app's page straight to the server, past the client.
    page_exit = PAGE[1] + PAGE[3] - 18
    p2s = f"M{PAGE[0]} {page_exit} H{GAP_X} V{sy} H{SRV[0] + SRV[2]}"
    out.append(f'<path id="{p}-p2s" fill="none" d="{p2s}"/>')

    # Wires
    out.append(f'<path class="wire" d="M{CX} {YOU[1] + YOU[3]} V{CLI[1]}"/>')
    out.append(f'<path class="wire" d="M{CX} {CLI[1] + CLI[3]} V{SRV[1]}"/>')
    out.append(f'<path class="wire" d="M{CLI[0] + CLI[2]} {CY} H{AGT[0]}"/>')
    if not api:
        out.append(f'<g opacity="1">{show(6.4)}<path class="wire-ans" d="{p2s}"/></g>')

    dots = []
    # Boxes
    out.append(box(YOU, "You", "the person who asked"))
    out.append(box(CLI, "Client app", "just relays replies" if api else "opens your app's page"))
    out.append(box(AGT, "Agent", "the model"))
    out.append(box(SRV, "Your API" if api else "Your MCP server",
                   "DELETE /links/wasp" if api else "delete_link tool", sub_mono=True, accent=color))

    if api:
        # Agent glows while it "decides", then the tag stays
        x, y, w, h = AGT
        out.append(f'<rect class="glow-warn" x="{x}" y="{y}" width="{w}" height="{h}" rx="9" opacity="0">{show(3.9, 6.5)}</rect>')
        out.append(f'<g opacity="1">{show(4.2)}<text class="tag-warn" x="{x + w / 2}" y="{y + h + 20}" text-anchor="middle">answers for you</text></g>')
        # You: never asked
        x, y, w, h = YOU
        out.append(f'<g opacity="1">{show(9.5)}'
                   f'<circle cx="{x + w - 22}" cy="{y + h / 2}" r="10" class="bad-bg"/>'
                   f'<path class="x" d="M{x + w - 26} {y + h / 2 - 4} l8 8 M{x + w - 18} {y + h / 2 - 4} l-8 8"/>'
                   f'<text class="tag-warn" x="{x + w + 18}" y="{y + h / 2 + 5}">never asked</text></g>')
        # Server: the link is gone
        sx = SRV[0] + SRV[2]
        out.append(f'<g opacity="1">{show(6.8)}{mark_x(sx + 22, sy)}'
                   f'<text class="tag-warn" x="{sx + 40}" y="{sy - 2}">/r/wasp deleted</text>'
                   f'<text class="tag" x="{sx + 40}" y="{sy + 16}">your badges now 404</text></g>')
        # Dots
        dots.append(dot("a-a2s", 0.3, 2.0, "rest"))
        dots.append(dot("a-s2a", 2.2, 3.9, "ask"))
        dots.append(dot("a-a2s", 4.8, 6.5, "warn"))
        dots.append(dot("a-s2a", 7.8, 9.5, "rest"))
        caps = [
            (["The agent asks your API to delete the old", "wasp.sh link, and picks /r/wasp by mistake."], 0, 2.2, "rest"),
            (["Your API wants a confirmation:", "“Deleting /r/wasp. Resend with confirm=true.”"], 2.2, 4.6, "ask"),
            (["The question went to the agent,", "so the agent answers it: confirm=true."], 4.6, 6.6, "warn"),
            (["/r/wasp is gone, and your badges 404.", "Nobody asked you, and you can't undo it."], 6.6, None, "warn"),
        ]
    else:
        x, y, w, h = AGT
        out.append(f'<g opacity="1">{show(4.4)}<text class="tag" x="{x + w / 2}" y="{y + h + 20}" text-anchor="middle">never sees the question</text></g>')
        # Your app's confirmation page, opened by the client in your browser
        dx, dy, dw, dh = PAGE
        out.append(f'<g opacity="1">{show(4.4)}<g transform="translate({dx},{dy})">'
                   f'<rect class="dialog" width="{dw}" height="{dh}" rx="9"/>'
                   f'<text class="dq" x="16" y="30">Delete this link?</text>'
                   f'<rect class="hl" x="11" y="40" width="62" height="19" rx="4" opacity="1">{show(5.2)}</rect>'
                   f'<text class="dp mono" x="16" y="53.5">/r/wasp</text>'
                   f'<text class="dp dm" x="16" y="74">→ wasp.sh</text>'
                   f'<text class="dp dm" x="16" y="92">Requested by Claude Code</text>'
                   f'<rect class="btn-ghost" x="16" y="102" width="60" height="24" rx="6"/>'
                   f'<rect class="press" x="13" y="99" width="66" height="30" rx="8" opacity="1">{show(6.0)}</rect>'
                   f'<text class="bt" x="46" y="118.5" text-anchor="middle">Cancel</text>'
                   f'<rect class="btn-del" x="82" y="102" width="92" height="24" rx="6"/>'
                   f'<text class="bt bt-on" x="128" y="118.5" text-anchor="middle">Confirm delete</text>'
                   f'</g></g>')
        # Cursor glides onto Cancel and clicks as the press ring appears
        out.append(cursor(dx + 46, dy + 116, 5.3, 5.4, 5.9, 6.0))
        # You: caught it
        x, y, w, h = YOU
        out.append(f'<g opacity="1">{show(6.2)}'
                   f'<circle cx="{x + w - 22}" cy="{y + h / 2}" r="10" class="ok-bg"/>'
                   f'<path class="ck" d="M{x + w - 27} {y + h / 2} l4 4 l8 -8"/></g>')
        dots.append(dot("m-a2s", 0.3, 2.0, "mcp"))
        dots.append(dot("m-s2c", 2.2, 3.2, "ask"))
        dots.append(dot("m-c2y", 3.4, 4.4, "ask"))
        dots.append(dot("m-p2s", 6.6, 8.3, "warn"))
        # Server: nothing deleted (the mirror of "/r/wasp deleted" on the left)
        out.append(f'<g opacity="1">{show(8.3)}<text class="tag-ok" x="{GAP_X + 12}" y="{sy - 2}">/r/wasp kept</text>'
                   f'<text class="tag" x="{GAP_X + 12}" y="{sy + 16}">nothing was deleted</text></g>')
        dots.append(dot("m-s2a", 8.5, 10.2, "mcp"))
        caps = [
            (["The agent calls delete_link for the old", "wasp.sh link, and picks /r/wasp by mistake."], 0, 2.2, "mcp"),
            (["Your server asks the client to open a", "confirmation page. The agent isn't asked."], 2.2, 4.6, "ask"),
            (["Your page shows the link it would delete.", "Wait: /r/wasp is the one on your badges."], 4.6, 6.6, "ask"),
            (["You click Cancel. The answer goes from the", "page to your server, not through the client."], 6.6, 8.5, "warn"),
            (["Nothing was deleted. The agent learns you", "cancelled, and can find the right link."], 8.5, None, "ok"),
        ]

    boxes_at = out.index(next(s for s in out if 'Client app' in s)) - 1
    out[boxes_at:boxes_at] = dots
    out.append('<line class="sep" x1="16" y1="382" x2="412" y2="382"/>')
    for i, (lines, a, b, c) in enumerate(caps):
        out.append(caption(i + 1, lines, a, b, c, final=(b is None)))
    return "\n    ".join(out)

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="900" height="476" viewBox="0 0 900 476" role="img" aria-labelledby="t d">
  <title id="t">Who answers "are you sure?": a confirm flag vs. MCP</title>
  <desc id="d">Two panels side by side. You have two links to wasp.sh, an old one and /r/wasp, which is printed on your conference badges. You ask an agent to delete the old one, and it picks /r/wasp by mistake. With a flag the agent can set, your API asks for confirm=true, the question goes back to the agent, the agent sets the flag itself, and /r/wasp is deleted without anyone asking you. With MCP, the server asks the client to open your app's confirmation page, which shows "Delete this link? /r/wasp, goes to wasp.sh, requested by Claude Code." You see it's the link on your badges and click Cancel. The answer goes from the page to the server, nothing is deleted, and the agent learns you cancelled.</desc>
  <style>
    svg {{
      --bg: #ffffff; --band: #f3f5f8; --box: #f8fafb; --ink: #15202b; --muted: #5a6774; --line: #cbd3db;
      --mcp: #8b3fcf; --rest: #0f8577; --ask: #b06a00; --warn: #c4382f; --warn-bg: #fbeaea; --ok: #23863a; --ok-bg: #e9f5ec; --on: #ffffff;
    }}
    @media (prefers-color-scheme: dark) {{
      svg {{
        --bg: #0e141a; --band: #151d25; --box: #1b2530; --ink: #e4ebf1; --muted: #95a3b0; --line: #2c3845;
        --mcp: #c18bf2; --rest: #3fc1ae; --ask: #f0a63a; --warn: #ff7b72; --warn-bg: #3a1d1d; --ok: #5ccb74; --ok-bg: #173323; --on: #0e141a;
      }}
    }}
    text {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; fill: var(--ink); }}
    .mono {{ font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }}
    .bg {{ fill: var(--bg); }}
    .band {{ fill: var(--band); }}
    .h {{ font-size: 16px; font-weight: 700; }}
    .box {{ fill: var(--box); stroke: var(--line); stroke-width: 1; }}
    .t {{ font-size: 15px; font-weight: 600; }}
    .s {{ font-size: 12px; fill: var(--muted); }}
    .wire {{ fill: none; stroke: var(--line); stroke-width: 2.5; stroke-linecap: round; }}
    .wire-ans {{ fill: none; stroke: var(--warn); stroke-width: 2; stroke-dasharray: 5 4; stroke-linecap: round; opacity: .55; }}
    .pkt {{ stroke: var(--bg); stroke-width: 2.5; }}
    .glow-warn {{ fill: none; stroke: var(--warn); stroke-width: 3; }}
    .tag {{ font-size: 12.5px; fill: var(--muted); font-style: italic; }}
    .tag-warn {{ font-size: 12.5px; fill: var(--warn); font-weight: 600; }}
    .tag-ok {{ font-size: 12.5px; fill: var(--ok); font-weight: 600; }}
    .bad-bg {{ fill: var(--warn-bg); }}
    .ok-bg {{ fill: var(--ok-bg); }}
    .x {{ fill: none; stroke: var(--warn); stroke-width: 2.2; stroke-linecap: round; }}
    .ck {{ fill: none; stroke: var(--ok); stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }}
    .dialog {{ fill: var(--bg); stroke: var(--mcp); stroke-width: 1.5; }}
    .dq {{ font-size: 12.5px; font-weight: 600; }}
    .btn-ghost {{ fill: none; stroke: var(--line); stroke-width: 1; }}
    .btn-del {{ fill: var(--warn); }}
    .press {{ fill: none; stroke: var(--mcp); stroke-width: 2; }}
    .bt {{ font-size: 11.5px; font-weight: 600; }}
    .bt-on {{ fill: var(--on); }}
    .sep {{ stroke: var(--line); stroke-width: 1; }}
    .dp {{ font-size: 12px; }}
    .dm {{ fill: var(--muted); }}
    .hl {{ fill: var(--warn-bg); stroke: var(--warn); stroke-width: 1; }}
    .num {{ font-size: 12px; font-weight: 700; fill: var(--on); }}
    .cap {{ font-size: 14px; }}
    .cursor {{ fill: #15202b; stroke: #ffffff; stroke-width: 1.3; stroke-linejoin: round; }}
  </style>

  <rect class="bg" width="900" height="476" rx="14"/>

  <g transform="translate(12,12)">
    {panel("api")}
  </g>

  <g transform="translate(460,12)">
    {panel("mcp")}
  </g>
</svg>
'''
open(sys.argv[1], "w").write(svg)
