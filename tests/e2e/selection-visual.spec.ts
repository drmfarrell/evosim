import { test } from "@playwright/test";

test("visual: directional_dark tank darkens over 20 generations", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".deck-card");
  // Switch to directional_dark scenario
  await page.locator(".deck-card", { hasText: "Selection against light coats" })
    .getByRole("button", { name: /Run/ }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/sel-before.png", fullPage: false });

  // Step 20 gens synchronously
  await page.evaluate(() => {
    // @ts-ignore
    const r = window.__evosim.scenarioRunner;
    for (let i = 0; i < 20; i++) r.step();
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/sel-after.png", fullPage: false });
});
