import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { newPlayer, pairRanked } from "./helpers.mjs";

// Named full-page screenshots for the UI overhaul gates.
//   node e2e/screenshot.mjs                -> shots/lobby.png
//   node e2e/screenshot.mjs --duel         -> shots/board.png + shots/results.png
//   add --width=640 for a narrow viewport  -> shots/<name>-640.png
const SHOTS = fileURLToPath(new URL("./shots/", import.meta.url));
const DUEL = process.argv.includes("--duel");
const widthArg = process.argv.find((a) => a.startsWith("--width="));
const WIDTH = widthArg ? Number(widthArg.split("=")[1]) : null;
const SUFFIX = WIDTH ? `-${WIDTH}` : "";

const sizePage = async (page) => {
  if (WIDTH) await page.setViewportSize({ width: WIDTH, height: 900 });
};

const shot = async (page, name) => {
  // the responsive gate: no horizontal scroll at any width
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  if (overflow > 0)
    throw new Error(`${name}: horizontal overflow of ${overflow}px`);
  await page.screenshot({ path: `${SHOTS}${name}${SUFFIX}.png`, fullPage: true });
  console.log(`wrote ${name}${SUFFIX}.png`);
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
    await sizePage(p);
    await shot(p, "lobby");
  } else {
    const p1 = await newPlayer(browser, `shot_a_${Date.now()}`);
    const p2 = await newPlayer(browser, `shot_b_${Date.now()}`);
    await sizePage(p1);
    await pairRanked(p1, p2);

    await p1.getByTestId("ready").click();
    await p2.getByTestId("ready").click();

    // board.png mid-bid: window open with an amount typed in
    await p1.getByTestId("bid-window").waitFor({ timeout: 10000 });
    await p1.getByTestId("bid-amount").fill("3");
    await p1.waitForTimeout(400); // let the card flip-in settle
    await shot(p1, "board");

    const deadline = Date.now() + 90000;
    await Promise.all([
      playLoop(p1, "p1", 2, deadline),
      playLoop(p2, "p2", 1, deadline),
    ]);
    await p1.getByTestId("results").waitFor({ timeout: 10000 });
    await p1.waitForTimeout(1200); // let bars and count-ups finish
    await shot(p1, "results");
  }
} finally {
  await browser.close();
}
