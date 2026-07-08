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
  console.log(`[${name}] registered`);
  return page;
}

const browser = await chromium.launch();
try {
  // ── Ranked: two players click Find Ranked Match, must pair on one match id
  const p1 = await newPlayer(browser, "pw_alice");
  const p2 = await newPlayer(browser, "pw_bob");
  await p1.getByTestId("find-ranked").click();
  await p1.waitForTimeout(300); // p1 parks in the queue first
  await p2.getByTestId("find-ranked").click();
  await p1.getByTestId("match-id").waitFor({ timeout: 10000 });
  await p2.getByTestId("match-id").waitFor({ timeout: 10000 });
  const m1 = await p1.getByTestId("match-id").textContent();
  const m2 = await p2.getByTestId("match-id").textContent();
  if (!m1 || m1 !== m2) throw new Error(`ranked match ids differ: ${m1} vs ${m2}`);
  console.log(`RANKED OK match=${m1.slice(0, 8)}`);

  // ── Challenge: creator gets a code, joiner enters it
  const p3 = await newPlayer(browser, "pw_carol");
  const p4 = await newPlayer(browser, "pw_dave");
  await p3.getByTestId("create-challenge").click();
  await p3.getByTestId("challenge-code").waitFor({ timeout: 10000 });
  const cMatch = await p3.getByTestId("match-id").textContent();
  const cCode = await p3.getByTestId("challenge-code").textContent();
  console.log(`challenge created code=${cCode}`);
  await p4.getByTestId("join-match-id").fill(cMatch);
  await p4.getByTestId("join-code").fill(cCode);
  await p4.getByTestId("join-challenge").click();
  await p4.getByTestId("match-id").waitFor({ timeout: 10000 });
  const jMatch = await p4.getByTestId("match-id").textContent();
  if (jMatch !== cMatch) throw new Error(`challenge ids differ: ${cMatch} vs ${jMatch}`);
  console.log(`CHALLENGE OK match=${jMatch.slice(0, 8)}`);

  console.log("GATE PASS");
} finally {
  await browser.close();
}
