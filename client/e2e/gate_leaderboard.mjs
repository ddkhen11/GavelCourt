import { chromium } from "playwright";

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.log(`pageerror: ${e}`));
  await page.goto("http://localhost:3000");
  await page.getByTestId("leaderboard").waitFor({ timeout: 10000 });
  await page.getByTestId("leaderboard-entry").first().waitFor({ timeout: 10000 });
  const rows = await page.getByTestId("leaderboard-entry").allTextContents();
  console.log(`entries: ${rows.length}`);
  rows.slice(0, 5).forEach((r) => console.log(`  ${r}`));
  const elos = rows.map((r) => Number(r.match(/— (\d+) \(/)[1]));
  for (let i = 1; i < elos.length; i++) {
    if (elos[i] > elos[i - 1]) throw new Error(`not ranked: ${elos.join(",")}`);
  }
  if (rows.length === 0) throw new Error("empty leaderboard");
  console.log("GATE PASS — ranked list rendered");
} finally {
  await browser.close();
}
