import { chromium } from "playwright";
import { newPlayer, pairRanked } from "./helpers.mjs";

// Deterministic auto-play through the real UI: fixed bid each window.
// p1 bids 2, p2 bids 1 -> p1 drafts the first five, then p2 fills
// uncontested. No passes, so the match ends in exactly ten auctions.
// The bid-window element persists across auctions (the close + reopen
// happens in one React render), so key each action off the card number.
async function playLoop(page, name, bidValue, deadline) {
  let lastCard = null;
  while (Date.now() < deadline) {
    if (await page.getByTestId("results").isVisible().catch(() => false)) return;
    const windowOpen = await page
      .getByTestId("bid-window")
      .isVisible()
      .catch(() => false);
    if (windowOpen) {
      const cardNo = await page
        .getByTestId("card-number")
        .textContent()
        .catch(() => null);
      if (cardNo && cardNo !== lastCard) {
        lastCard = cardNo;
        await page.getByTestId("bid-amount").fill(String(bidValue));
        await page.getByTestId("place-bid").click();
      }
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`${name}: match did not finish before deadline`);
}

const browser = await chromium.launch();
try {
  const p1 = await newPlayer(browser, `cmp_a_${Date.now()}`);
  const p2 = await newPlayer(browser, `cmp_b_${Date.now()}`);

  // Lobby renders + ranked match
  await pairRanked(p1, p2);
  console.log("lobby + matchmaking OK");

  // Board renders pre-game, both ready up
  await p1.getByTestId("ready").click();
  await p2.getByTestId("ready").click();
  await p1.getByTestId("card-flipped").waitFor({ timeout: 10000 });
  await p2.getByTestId("card-flipped").waitFor({ timeout: 10000 });
  const tier = await p1.getByTestId("card-tier").textContent();
  if (!["S", "A", "B", "C"].includes(tier ?? ""))
    throw new Error(`bad tier render: ${tier}`);
  console.log(`board OK (first card tier=${tier})`);

  // Play to completion through the Board UI
  const deadline = Date.now() + 90000;
  await Promise.all([
    playLoop(p1, "p1", 2, deadline),
    playLoop(p2, "p2", 1, deadline),
  ]);
  console.log("match played to completion via UI");

  // Results + Lineup render with final data on both sides
  for (const [name, p] of [["p1", p1], ["p2", p2]]) {
    await p.getByTestId("results").waitFor({ timeout: 10000 });
    const result = await p.getByTestId("result").textContent();
    const scores = await p.getByTestId("scores").textContent();
    const elo = await p.getByTestId("elo-change").textContent();
    const mine = await p.getByTestId("lineup-player").count();
    const theirs = await p.getByTestId("opp-lineup-player").count();
    console.log(`[${name}] ${result} | ${scores} | ${elo} | lineups ${mine}+${theirs}`);
    if (mine !== 5 || theirs !== 5)
      throw new Error(`${name}: expected 5+5 drafted, got ${mine}+${theirs}`);
    if (!result || !elo) throw new Error(`${name}: missing results fields`);
  }

  const r1 = await p1.getByTestId("result").textContent();
  const r2 = await p2.getByTestId("result").textContent();
  const outcomes = new Set([r1, r2]);
  const validSplit =
    (outcomes.has("You win!") && outcomes.has("You lose")) ||
    (r1 === "Tie" && r2 === "Tie");
  if (!validSplit) throw new Error(`inconsistent results: ${r1} / ${r2}`);

  // Back to lobby: Results must not be a dead end
  await p1.getByTestId("play-again").click();
  await p1.getByTestId("find-ranked").waitFor({ timeout: 10000 });
  console.log("play-again returns to lobby");

  console.log("GATE PASS");
} finally {
  await browser.close();
}
