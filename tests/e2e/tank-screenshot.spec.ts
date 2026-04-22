import { test } from "@playwright/test";

test("baseline screenshot of population tank running a scenario", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".deck-card");
  // Switch to directional-dark explicitly and let it run 10 gens.
  await page.evaluate(() => {
    // @ts-ignore
    window.__evosim.scenarioRunner.pause();
  });
  const card = page.locator(".deck-card", { hasText: "Selection against light coats" });
  await card.getByRole("button", { name: /Run/ }).click();
  await page.evaluate(() => {
    // @ts-ignore
    const r = window.__evosim.scenarioRunner;
    r.pause();
    for (let i = 0; i < 10; i++) r.step();
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/tank-view.png", fullPage: false });
});
