import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { newPlayer, pairRanked } from "./helpers.mjs";

// Named full-page screenshots for the UI overhaul gates.
//   node e2e/screenshot.mjs          -> shots/lobby.png
//   node e2e/screenshot.mjs --duel   -> shots/board.png + shots/results.png
const SHOTS = fileURLToPath(new URL("./shots/", import.meta.url));
const DUEL = process.argv.includes("--duel");

const shot = async (page, name) => {
  await page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: true });
  console.log(`wrote ${name}.png`);
};

// Same deterministic auto-play as gate_components.mjs: fixed bid per window,
// keyed off the card number so one action lands per auction.
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

await mkdir(SHOTS, { recursive: true });
const browser = await chromium.launch();
try {
  if (!DUEL) {
    const p = await newPlayer(browser, `shot_${Date.now()}`);
    await shot(p, "lobby");
  } else {
    const p1 = await newPlayer(browser, `shot_a_${Date.now()}`);
    const p2 = await newPlayer(browser, `shot_b_${Date.now()}`);
    await pairRanked(p1, p2);

    await p1.getByTestId("ready").click();
    await p2.getByTestId("ready").click();

    // board.png mid-bid: window open with an amount typed in
    await p1.getByTestId("bid-window").waitFor({ timeout: 10000 });
    await p1.getByTestId("bid-amount").fill("3");
    await shot(p1, "board");

    const deadline = Date.now() + 90000;
    await Promise.all([
      playLoop(p1, "p1", 2, deadline),
      playLoop(p2, "p2", 1, deadline),
    ]);
    await p1.getByTestId("results").waitFor({ timeout: 10000 });
    await shot(p1, "results");
  }
} finally {
  await browser.close();
}
