---
name: write-blog-section
description: |
  Write or finish one section of the Linkly blog post in docs/blog/draft.md, using the process we used for
  Steps 1 and 2: review the material, propose a structure, write in the author's voice, check every claim
  against the Linkly code, then update notes.md. Use when the user asks to write, finish, restructure, or
  trim a section of the draft (e.g. "write step 3", "what should we keep in step 4?").
argument-hint: "<section heading or step number>"
---

# Write a blog section

The post is `docs/blog/draft.md`. Its per-section plan is `docs/blog/notes.md`. The example app it
describes is Linkly, the code in this repo (`src/`, `cli/`). Work on one section at a time: $ARGUMENTS

The user edits the draft and notes between turns. Re-read both before every edit, never edit from memory.

## 1. Gather

- Read the section in `draft.md`, and the whole draft above it: you need to know what's already been said.
- Read the section's entry in `notes.md` (GOAL, COVER, SOURCES, MATERIAL, open checks).
- **Open every link under SOURCES** (`../GUIDE.md`, `../BLOG-POST-NOTES.md`, and others). The notes are
  a summary. The details, like the retrofit path in Step 1, are in the sources. Skipping them is how
  Step 1 missed points.
- Read the Linkly code the section will talk about. Find the real function, tool, and file names.

## 2. Review the existing material (checkpoint)

Go through every piece under the heading: each table, code block, placeholder, and pre-filled list. For
each one, say **keep**, **cut**, **move** (to which section), or **replace** (with what), and why:

- Does an earlier or later section already cover it? Point to where. Cut repeats.
- Is it true in Linkly? Pseudo-code and tables were pre-filled from `GUIDE.md` and often don't match the
  code: names differ, counts are off, claims are stronger than the code supports.
- Aim for one main visual per section (a table, a diagram, or a code block, plus at most one more).
- What does the notes' COVER ask for that has no material yet? That gap is often the most important part.

When the section has no material yet, or there are real choices to make, give 2–4 options instead, each
with pros and cons, and a recommendation. Either way, **stop and let the user choose.**

## 3. Skeleton (checkpoint, unless the user said to go straight to writing)

Restructure the section to the chosen plan. Keep the user's existing prose. Put
`(your writing here: <what goes here, with the key facts>)` where prose is needed, and keep
pre-filled material visible so the user can react to it. Summarize the skeleton and stop.

## 4. Write

Match the voice of the written sections (intro, "The short answer", "Why MCP", Steps 1–2):

- First person ("Here's where I've landed", "I'd hold any MCP server to"). Talk to the reader as "you".
- Plain, casual words, with contractions. A few "So," "And," "But" sentence openers are fine.
- Conversational, not punchy. No clipped aphorisms or slogan-style closers ("X, and you get Y without Z.",
  "That's the point."). Explain the idea in full, relaxed sentences, the way you'd say it to a colleague.
- Short paragraphs, one idea each. The example comes before the abstraction.
- Concrete Linkly examples: real tool names, real error codes, real numbers.
- Bulleted lists start with a **bold lead-in**. No `###` subheadings inside a section.
- No hedges ("In my opinion", "probably"). Put the concession in the same sentence as the claim.
- Honest about Linkly's gaps. If Linkly doesn't do something (e.g. the CLI uses a personal access token,
  discovery isn't built), say it's a recommendation, or flag it to the user.
- End with a one-line transition into the next section (the notes' TRANSITION).
- Don't dwell on how much OAuth code there is, or on code size in general. Agents can write it.
- Stay near the notes' WORDS budget, and report the count.

Code:

- Use real Linkly code, not pseudo-code. Trim it if needed and say so ("simplified").
- Link to GitHub as `https://github.com/vincanger/linkly-api-mcp-cli/blob/main/<path>#L<a>-L<b>`, with line
  numbers from the current file.
- TODOs for the author go in HTML comments: `<!-- TODO: ... -->`.

## 5. Verify every claim

Before finishing, check each factual claim in the section against the code: names, counts (e.g. tools,
endpoints, page sizes), which surface returns what, and what each step's code actually does. Fix wrong
pre-filled material, and list every correction for the user. Claims about clients, specs, and dates that
can't be checked in the code go into the notes as open checks.

## 6. Keep the rest of the post consistent

- Material moved to another section: put it under that section's heading, and add a line to that
  section's notes (COVER, SOURCES, MATERIAL).
- Heading renamed: update its anchor in the short-answer checklist, in its `[Notes](./notes.md#...)` link,
  and in the `[Back to draft](./draft.md#...)` link in notes.md.
- Something earlier in the draft now contradicts this section: tell the user, don't silently change it.

## 7. Update notes.md

Collapse the section's notes to the written format:

```
## <heading>

[Back to draft](./draft.md#<anchor>)

WRITTEN (~<n> words; planned ~<m>). Open checks:
  - [ ] <anything still unverified, any TODO left in the draft, anything planned but not used>
```

Keep REFERENCE material only if a later section needs it. Update the BUDGET line at the top if the
section ran long.

## 8. Report

Tell the user, briefly: what's in the section now (in order), the word count, every correction to earlier
material, and the open checks. Don't paste the section back.
