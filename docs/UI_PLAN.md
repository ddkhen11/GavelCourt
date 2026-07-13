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

## Design system — "arena night"
Define once in `client/src/styles/tokens.css`, import from `main.tsx`.
- **Palette:** near-black navy court `#0b1220` background, elevated panels `#141d31`,
  ink `#e8ecf5`, muted `#8b96ad`, hardwood orange `#ff7a1a` as the single action color.
- **Tier colors** (borders, badges, glows): S `#f5c542` gold · A `#c04dfa` violet ·
  B `#3d8bff` blue · C `#8b96ad` steel.
- **Type:** system stack; headings weight 800, tight letter-spacing; small uppercase
  ("SCOREBOARD" style) labels for HUD numbers; tabular numerals for credits/scores.
- **Shape & depth:** 12px radius panels, 1px inner borders (`#243049`), soft shadows;
  player cards get a tier-colored gradient border and feel like trading cards.
- **Motion:** 150–250ms ease-out transitions; one signature animation per phase (card
  flip on reveal, countdown bar during bidding, score count-up on results) — subtle,
  never blocking input.

---

## Phase 0 — Foundation
- [x] `tokens.css` (palette, type scale, spacing, radii, tier colors as custom
  properties) + global reset/base styles + app shell: centered column layout, top bar
  with logo-type "NBA AUCTION DRAFT" and the signed-in username — _gate: shell renders,
  tsc + both e2e gates green_
- [ ] `client/e2e/screenshot.mjs`: registers a throwaway player and captures named
  full-page shots (`lobby`, plus `--duel` mode that pairs two players, readies up, and
  shoots `board` mid-bid and `results` after an auto-played match) into
  `client/e2e/shots/` (gitignore it) — _gate: `node e2e/screenshot.mjs` writes lobby.png;
  `--duel` writes board.png + results.png_

## Phase 1 — Lobby
- [ ] Register screen: single centered panel, big name input, one primary button,
  one-line game explainer underneath — _gate: e2e green + lobby.png_
- [ ] Matchmaking panel: "Find Ranked Match" as the hero action (searching state with
  animated indicator), challenge create/join as a secondary card with a copyable join
  code; error states styled inline — _gate: e2e green + lobby.png_
- [ ] Leaderboard: ranked table with position medals for the top 3, elo as the big
  number, W/L record muted; current player's row highlighted — _gate: e2e green +
  lobby.png reviewed_
- [ ] 🚦 **Lobby review**: human looks at lobby.png / live app — _gate: human approves_

## Phase 2 — The duel board
- [ ] Player card component: trading-card layout (name, season, team, position badge),
  tier-colored gradient border + tier letter badge, flip-in animation on each new card
  (`prefers-reduced-motion`: fade) — _gate: e2e green + board.png_
- [ ] Bid HUD: both players' credits and roster as 5 slot-dots, you vs opponent framing;
  countdown bar animating across `duration_seconds` when the window opens; max-bid
  shown next to the input — _gate: e2e green + board.png_
- [ ] Bid controls: numeric input with +/- steppers, quick chips (min / half / max),
  distinct Pass button; disabled/full-roster states obvious — _gate: e2e green +
  board.png_
- [ ] Resolve + events feed: win/lose flash on resolution with the revealed LAKER score
  counting up, pass streak indicator, pity card gets a gold flare treatment, inline
  error toasts (from `duel-errors`) that auto-dismiss — _gate: e2e green + board.png_
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
