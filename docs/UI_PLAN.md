# UI_PLAN — NBA Auction Draft frontend overhaul

Durable task tracker for making the client beautiful, user-friendly, and fun to play.
Same protocol as [BUILD_PLAN.md](BUILD_PLAN.md): any session reads this file, does the
first unchecked task, satisfies its gate, checks it off, commits.

## The loop prompt
```
/loop  Read docs/UI_PLAN.md. Take the first unchecked [ ] task, implement it following
the design system and hard rules below, then satisfy its gate (typecheck, e2e, screenshots).
If green: mark it [x], commit with a descriptive message, continue to the next task.
If you hit a 🚦 gate, or a gate fails after 2 attempts, STOP and summarize for me.
```

## Hard rules (every task, non-negotiable)
- **Styling and markup only.** Do not change `useMatch`/`useDuel` logic, the proto, or
  the server. New presentational state (e.g. a countdown tick) lives in components.
- **Never remove or rename a `data-testid`.** The four e2e gates must stay green.
- **Gate ritual** after every task: `npx tsc --noEmit`, then with the dev stack up
  (`/devup`) run `node e2e/gate_usematch.mjs` and `node e2e/gate_components.mjs` from
  `client/`, then capture the task's named screenshots with `node e2e/screenshot.mjs`.
- **No new runtime dependencies.** Plain CSS with custom properties — no Tailwind, no
  component libraries, no external fonts (system font stack, offline-safe).
- Respect `prefers-reduced-motion` for every animation; keep text contrast ≥ 4.5:1;
  every interactive element needs visible hover and focus-visible states.
- Commit style: terse lowercase one-liners, no colons, imitate `git log`.

## Design system — "ticket stub" (70s ABA)
_v1 ("arena night", dark navy dashboard) was rejected at the first 🚦: it looked
AI-generated. This direction replaces it everywhere. Define once in
`client/src/styles/tokens.css`, import from `main.tsx`._
- **Palette — print inks on paper:** warm cream paper `#f4ecd9` background, warm ink
  `#26201a`, rust `#a63e15` as the single action color (bright rust `#c4551b` and navy
  `#22406e` for stripe bands and secondary blocks), muted warm gray `#665b4c`.
  Light theme only — there is no dark mode.
- **Tier inks** (card frames, badges — flat, printed): S gold `#c19017` · A violet
  `#6d4396` · B blue `#2c5c94` · C taupe `#6e6657`.
- **Type:** Helvetica/Arial everywhere (peak-70s grotesque): display type is weight
  900, UPPERCASE, tight tracking; `"American Typewriter", "Courier New"` slab/mono for
  ticket serials, join codes, and box-score numerals (tabular figures).
- **Shape & depth:** square corners (2px max), thick 2–3px ink borders, double rules,
  dashed "perforation" dividers; shadows are hard offsets (`4px 4px 0` ink), never
  blurred. Stripe bands (rust/navy/cream `repeating-linear-gradient`) as section
  accents. Halftone dot textures welcome, sparingly.
- **Motion:** 150–250ms ease-out; stamp/punch effects (scale + translate, no blur);
  one signature animation per phase (card flip on reveal, countdown bar during
  bidding, score count-up on results); `prefers-reduced-motion` swaps to plain fades.
- **Banned — the vibe-coded tells:** dark dashboard backgrounds, rounded glowing
  panels, soft/blurred drop shadows, radial-gradient glows, pill buttons and pill
  chips, emoji as UI, gradient hero cards, uniform 12px radii, cool gray-blue muted
  text.

---

## Phase 0 — Foundation
- [x] **(redo, ticket stub)** `tokens.css` (palette, type scale, spacing, radii, tier
  inks as custom properties) + global reset/base styles + app shell: centered column
  layout, masthead with stripe band, logo-type "NBA AUCTION DRAFT" and the signed-in
  username as a ticket stub — _gate: shell renders, tsc + both e2e gates green_
- [x] `client/e2e/screenshot.mjs`: registers a throwaway player and captures named
  full-page shots (`lobby`, plus `--duel` mode that pairs two players, readies up, and
  shoots `board` mid-bid and `results` after an auto-played match) into
  `client/e2e/shots/` (gitignore it) — _gate: `node e2e/screenshot.mjs` writes lobby.png;
  `--duel` writes board.png + results.png_

## Phase 1 — Lobby
- [x] **(redo, ticket stub)** Register screen: a ticket-booth panel ("ADMIT ONE"
  framing), big name input, one rust block button, one-line game explainer set like a
  ticket fine-print line — _gate: e2e green + lobby.png_
- [x] **(redo, ticket stub)** Matchmaking: "Find Ranked Match" as a marquee block
  (searching state with a typewriter-style indicator), challenge create/join as a
  "CHALLENGE BOOTH" block with a copyable join code set in typewriter caps; error
  states styled inline as print corrections — _gate: e2e green + lobby.png_
- [x] **(redo, ticket stub)** Leaderboard as "THE STANDINGS": box-score table with
  hairline rules, printed `no. 1/2/3` rank marks (no emoji medals), elo in slab
  numerals, W–L muted; current player's row highlighted like a highlighter stroke —
  _gate: e2e green + lobby.png reviewed_
- [x] 🚦 **Lobby review**: human approved the ticket-stub lobby (2026-07-13)

## Phase 2 — The duel board
- [x] Player card component: vintage trading-card layout (name, season, team, position
  badge), tier-inked double-rule frame + tier letter badge, flip-in animation on each
  new card (`prefers-reduced-motion`: fade) — _gate: e2e green + board.png_
- [ ] Bid HUD: both players' credits and roster as 5 slot-dots, you vs opponent framing;
  countdown bar animating across `duration_seconds` when the window opens; max-bid
  shown next to the input — _gate: e2e green + board.png_
- [ ] Bid controls: numeric input with +/- steppers, quick chips (min / half / max),
  distinct Pass button; disabled/full-roster states obvious — _gate: e2e green +
  board.png_
- [ ] Resolve + events feed: win/lose stamp on resolution with the revealed LAKER score
  counting up, pass streak indicator, pity card gets a gold-foil frame treatment,
  inline error slips (from `duel-errors`) that auto-dismiss — _gate: e2e green +
  board.png_
- [ ] 🚦 **Board review**: human plays a few auctions in the browser — _gate: human
  approves the game feel_

## Phase 3 — Lineup & results
- [ ] Lineup panel: 5 fixed slots that fill with mini-cards as you draft (empty slots
  show position hints), running impact total — _gate: e2e green + board.png_
- [ ] Results screen: verdict banner (win/lose/tie/forfeit), score breakdown bars
  (impact + bonus) counting up, side-by-side lineup comparison with per-player LAKER
  scores, elo delta chip, prominent "Back to lobby" — _gate: e2e green + results.png_
- [ ] 🚦 **Results review**: human finishes a full match — _gate: human approves_

## Phase 4 — Polish
- [ ] Responsive pass: playable at 1280px two-window side-by-side and at ~700px wide;
  no horizontal scroll anywhere — _gate: screenshots at 640px and 1280px, e2e green_
- [ ] States pass: connecting/waiting-for-opponent states styled, stream-lost banner,
  empty leaderboard copy; `<title>` + favicon; remove any remaining unstyled element —
  _gate: e2e green + all screenshots refreshed_
- [ ] 🚦 **Final visual playthrough**: two browsers, full match start→finish — _gate:
  human signs off_

---

_When every box is `[x]` and the three 🚦 reviews pass, the overhaul is done._
