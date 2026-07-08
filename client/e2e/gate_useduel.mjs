import { chromium } from "playwright";

const APP = "http://localhost:3000";

async function newPlayer(browser, name) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`[${name}] pageerror: ${e}`));
  await page.goto(APP);
  await page.getByTestId("username").fill(name);
  await page.getByTestId("register").click();
  await page.getByTestId("identity").waitFor({ timeout: 10000 });
  return page;
}

const browser = await chromium.launch();
try {
  const p1 = await newPlayer(browser, `duel_a_${Date.now()}`);
  const p2 = await newPlayer(browser, `duel_b_${Date.now()}`);

  await p1.getByTestId("find-ranked").click();
  await p1.waitForTimeout(300);
  await p2.getByTestId("find-ranked").click();
  await p1.getByTestId("match-id").waitFor({ timeout: 10000 });
  await p2.getByTestId("match-id").waitFor({ timeout: 10000 });
  console.log("matched");

  for (const [name, p] of [["p1", p1], ["p2", p2]]) {
    const conn = p.getByTestId("duel-connected");
    await conn.waitFor({ timeout: 10000 });
    if ((await conn.textContent()) !== "connected")
      throw new Error(`${name} stream not connected`);
  }
  console.log("both streams connected");

  await p1.getByTestId("ready").click();
  await p2.getByTestId("ready").click();

  for (const [name, p] of [["p1", p1], ["p2", p2]]) {
    await p.getByTestId("game-started").waitFor({ timeout: 10000 });
    await p.getByTestId("card-flipped").waitFor({ timeout: 15000 });
    const started = await p.getByTestId("game-started").textContent();
    const card = await p.getByTestId("card-flipped").textContent();
    console.log(`[${name}] GameStarted: ${started} | CardFlipped: ${card}`);
    if (!card || card.trim().length === 0) throw new Error(`${name} empty card`);
  }

  // Blind-board check: both players see the same identity-only card
  const c1 = await p1.getByTestId("card-flipped").textContent();
  const c2 = await p2.getByTestId("card-flipped").textContent();
  if (c1 !== c2) throw new Error(`cards differ: ${c1} vs ${c2}`);

  console.log("GATE PASS");
} finally {
  await browser.close();
}
