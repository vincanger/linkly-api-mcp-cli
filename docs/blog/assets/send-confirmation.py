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

def envelopes(pid, start, color, n=3, gap=0.2, dur=1.0):
    """A few envelopes flying off along a path, staggered."""
    s = ""
    for i in range(n):
        a = start + i * gap
        s += (f'<g opacity="0">{move(pid, a, a + dur)}{show(a, a + dur)}'
              f'<rect class="env" x="-11" y="-7.5" width="22" height="15" rx="2" style="stroke:var(--{color})"/>'
              f'<path class="env-flap" d="M-11 -7.5 L0 1.5 L11 -7.5" style="stroke:var(--{color})"/></g>')
    return s

def inboxes(x, y, a):
    return (f'<g opacity="1">{show(a)}'
            f'<text class="tag" x="{x}" y="{y}" text-anchor="end">→ 2,043 inboxes</text></g>')

# Panel geometry (local coordinates inside each panel)
YOU = (36, 52, 186, 54)       # x, y, w, h
CLI = (36, 180, 186, 54)
AGT = (262, 180, 154, 54)
SRV = (36, 308, 186, 54)
CX = CLI[0] + CLI[2] / 2      # spine x = 129
CY = CLI[1] + CLI[3] / 2      # client row y = 207

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

def panel(kind):
    api = kind == "api"
    p = "a" if api else "m"
    color = "rest" if api else "mcp"
    out = []
    out.append('<rect class="band" width="428" height="452" rx="10"/>')
    out.append(f'<rect width="428" height="5" rx="2.5" style="fill:var(--{color})"/>')
    out.append(f'<text class="h" x="18" y="34">{"With only an API" if api else "With MCP"}</text>')

    # Paths for the dots (drawn invisibly; wires are drawn separately)
    ax0 = AGT[0]
    out.append(f'<path id="{p}-a2s" fill="none" d="M{ax0} {CY} H{CX} V{SRV[1]}"/>')
    out.append(f'<path id="{p}-s2a" fill="none" d="M{CX} {SRV[1]} V{CY} H{ax0}"/>')
    out.append(f'<path id="{p}-s2c" fill="none" d="M{CX} {SRV[1]} V{CLI[1] + CLI[3]}"/>')
    out.append(f'<path id="{p}-c2y" fill="none" d="M{CX} {CLI[1]} V{YOU[1] + YOU[3]}"/>')
    out.append(f'<path id="{p}-y2s" fill="none" d="M{CX} {YOU[1] + YOU[3]} V{SRV[1]}"/>')
    sx, sy = SRV[0] + SRV[2], SRV[1] + SRV[3] / 2
    out.append(f'<path id="{p}-mail" fill="none" d="M{sx + 14} {sy} C{sx + 80} {sy}, {sx + 130} {sy - 10}, {sx + 186} {sy - 34}"/>')

    # Wires
    out.append(f'<path class="wire" d="M{CX} {YOU[1] + YOU[3]} V{CLI[1]}"/>')
    out.append(f'<path class="wire" d="M{CX} {CLI[1] + CLI[3]} V{SRV[1]}"/>')
    out.append(f'<path class="wire" d="M{CLI[0] + CLI[2]} {CY} H{AGT[0]}"/>')

    dots = []
    # Boxes
    out.append(box(YOU, "You", "the person who asked"))
    out.append(box(CLI, "Client app", "just relays replies" if api else "handles the question"))
    out.append(box(AGT, "Agent", "the model"))
    out.append(box(SRV, "Your API" if api else "Your MCP server",
                   "POST /campaigns/send" if api else "send_campaign tool", sub_mono=True, accent=color))

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
        # Dots
        dots.append(dot("a-a2s", 0.3, 2.0, "rest"))
        dots.append(dot("a-s2a", 2.2, 3.9, "ask"))
        dots.append(dot("a-a2s", 4.8, 6.5, "warn"))
        dots.append(envelopes("a-mail", 6.6, "rest"))
        out.append(inboxes(416, SRV[1] + SRV[3] + 4, 7.4))
        dots.append(dot("a-s2a", 7.8, 9.5, "rest"))
        caps = [
            (["The agent asks your API to email the", "mailing list about the community call."], 0, 2.2, "rest"),
            (["Your API wants a confirmation:", "“2,043 recipients. Resend with confirm=true.”"], 2.2, 4.6, "ask"),
            (["The question went to the agent,", "so the agent answers it: confirm=true."], 4.6, 6.6, "warn"),
            (["2,043 people get the old date.", "Nobody asked you, and you can't unsend it."], 6.6, None, "warn"),
        ]
    else:
        x, y, w, h = AGT
        out.append(f'<g opacity="1">{show(4.4)}<text class="tag" x="{x + w / 2}" y="{y + h + 20}" text-anchor="middle">never sees the question</text></g>')
        # The question, shown by the client, with a preview of the email
        dx, dy = 232, 40
        out.append(f'<g opacity="1">{show(4.4)}<g transform="translate({dx},{dy})">'
                   f'<rect class="dialog" width="186" height="104" rx="9"/>'
                   f'<text class="dq" x="12" y="21">Email 2,043 people?</text>'
                   f'<text class="dp" x="12" y="40">“Community call”</text>'
                   f'<rect class="hl" x="7" y="46" width="128" height="19" rx="4" opacity="1">{show(5.2)}</rect>'
                   f'<text class="dp" x="12" y="59.5">Thu, Nov 12 · 5pm</text>'
                   f'<rect class="btn-ghost" x="14" y="70" width="74" height="26" rx="6"/>'
                   f'<rect class="press" x="11" y="67" width="80" height="32" rx="8" opacity="1">{show(6.0)}</rect>'
                   f'<text class="bt" x="51" y="87.5" text-anchor="middle">Cancel</text>'
                   f'<rect class="btn" x="98" y="70" width="74" height="26" rx="6"/>'
                   f'<text class="bt bt-on" x="135" y="87.5" text-anchor="middle">Send</text>'
                   f'</g></g>')
        # Cursor glides onto Cancel and clicks as the press ring appears
        out.append(cursor(dx + 54, dy + 88, 5.3, 5.4, 5.9, 6.0))
        # You: caught it
        x, y, w, h = YOU
        out.append(f'<g opacity="1">{show(6.2)}'
                   f'<circle cx="{x + w - 22}" cy="{y + h / 2}" r="10" class="ok-bg"/>'
                   f'<path class="ck" d="M{x + w - 27} {y + h / 2} l4 4 l8 -8"/></g>')
        dots.append(dot("m-a2s", 0.3, 2.0, "mcp"))
        dots.append(dot("m-s2c", 2.2, 3.2, "ask"))
        dots.append(dot("m-c2y", 3.4, 4.4, "ask"))
        dots.append(dot("m-y2s", 6.6, 8.3, "warn"))
        # Server: send stopped
        sx, sy = SRV[0] + SRV[2] + 22, SRV[1] + SRV[3] / 2
        out.append(f'<g opacity="1">{show(8.3)}'
                   f'<circle cx="{sx}" cy="{sy}" r="10" class="bad-bg"/>'
                   f'<path class="x" d="M{sx - 4} {sy - 4} l8 8 M{sx + 4} {sy - 4} l-8 8"/></g>')
        dots.append(dot("m-s2a", 8.5, 10.2, "mcp"))
        caps = [
            (["The agent calls send_campaign for", "everyone on the mailing list."], 0, 2.2, "mcp"),
            (["Your server asks a question. It goes", "to the client, not to the agent."], 2.2, 4.6, "ask"),
            (["The client shows you what's about to go out.", "Wait: the call moved to Nov 19."], 4.6, 6.6, "ask"),
            (["You click Cancel, and the client sends", "your answer back to the server."], 6.6, 8.5, "warn"),
            (["Nothing was sent. The agent learns you", "cancelled, and you can fix the date."], 8.5, None, "ok"),
        ]

    boxes_at = out.index(next(s for s in out if 'Client app' in s)) - 1
    out[boxes_at:boxes_at] = dots
    out.append('<line class="sep" x1="16" y1="382" x2="412" y2="382"/>')
    for i, (lines, a, b, c) in enumerate(caps):
        out.append(caption(i + 1, lines, a, b, c, final=(b is None)))
    return "\n    ".join(out)

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 900 476" role="img" aria-labelledby="t d">
  <title id="t">Who answers "are you sure?": API vs. MCP</title>
  <desc id="d">Two panels side by side. An agent emails the mailing list about a community call, with a date that has since changed. With only an API, the API's request for confirmation goes back to the agent, which answers confirm=true by itself, and 2,043 people get the old date. With MCP, the server's question goes to the client app instead, which shows you the email: "Email 2,043 people? Community call, Thu, Nov 12, 5pm." You notice the date is wrong and click Cancel, nothing is sent, and the agent learns you cancelled.</desc>
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
    .pkt {{ stroke: var(--bg); stroke-width: 2.5; }}
    .glow-warn {{ fill: none; stroke: var(--warn); stroke-width: 3; }}
    .tag {{ font-size: 12.5px; fill: var(--muted); font-style: italic; }}
    .tag-warn {{ font-size: 12.5px; fill: var(--warn); font-weight: 600; }}
    .bad-bg {{ fill: var(--warn-bg); }}
    .ok-bg {{ fill: var(--ok-bg); }}
    .x {{ fill: none; stroke: var(--warn); stroke-width: 2.2; stroke-linecap: round; }}
    .ck {{ fill: none; stroke: var(--ok); stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }}
    .dialog {{ fill: var(--bg); stroke: var(--mcp); stroke-width: 1.5; }}
    .dq {{ font-size: 12.5px; font-weight: 600; }}
    .btn-ghost {{ fill: none; stroke: var(--line); stroke-width: 1; }}
    .btn {{ fill: var(--mcp); }}
    .press {{ fill: none; stroke: var(--mcp); stroke-width: 2; }}
    .bt {{ font-size: 12px; font-weight: 600; }}
    .bt-on {{ fill: var(--on); }}
    .sep {{ stroke: var(--line); stroke-width: 1; }}
    .env {{ fill: var(--box); stroke-width: 1.6; }}
    .dp {{ font-size: 12px; }}
    .hl {{ fill: var(--warn-bg); stroke: var(--warn); stroke-width: 1; }}
    .tag-ok {{ font-size: 12.5px; fill: var(--ok); font-weight: 600; }}
    .env-flap {{ fill: none; stroke-width: 1.6; stroke-linejoin: round; }}
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
