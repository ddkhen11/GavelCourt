import { chromium } from "playwright";
import { newPlayer, pairRanked } from "./helpers.mjs";

const browser = await chromium.launch();
try {
  // ── Ranked: two players click Find Ranked Match, must pair on one match id
  const p1 = await newPlayer(browser, "pw_alice");
  const p2 = await newPlayer(browser, "pw_bob");
  const matchId = await pairRanked(p1, p2);
  console.log(`RANKED OK match=${matchId.slice(0, 8)}`);

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
