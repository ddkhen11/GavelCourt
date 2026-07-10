export const APP = "http://localhost:3000";

/** Fresh browser context + registered player; returns the page. */
export async function newPlayer(browser, name) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`[${name}] pageerror: ${e}`));
  await page.goto(APP);
  await page.getByTestId("username").fill(name);
  await page.getByTestId("register").click();
  await page.getByTestId("identity").waitFor({ timeout: 10000 });
  return page;
}

/** Both pages click Find Ranked Match (first parks in the queue) and wait
 *  until each shows the shared match id. Returns that match id. */
export async function pairRanked(p1, p2) {
  await p1.getByTestId("find-ranked").click();
  await p1.waitForTimeout(300); // p1 parks in the queue first
  await p2.getByTestId("find-ranked").click();
  await p1.getByTestId("match-id").waitFor({ timeout: 10000 });
  await p2.getByTestId("match-id").waitFor({ timeout: 10000 });
  const m1 = await p1.getByTestId("match-id").textContent();
  const m2 = await p2.getByTestId("match-id").textContent();
  if (!m1 || m1 !== m2) throw new Error(`ranked match ids differ: ${m1} vs ${m2}`);
  return m1;
}
