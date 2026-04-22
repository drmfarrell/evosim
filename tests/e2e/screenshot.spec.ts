// Takes a baseline screenshot for visual review. Produces a PNG under
// test-results/ that a human can inspect.

import { test } from "@playwright/test";

test("baseline screenshot of organism view", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".deck-card");
  // Stop the auto scenario and switch to organism view for a clean shot.
  await page.evaluate(() => {
    // @ts-ignore
    window.__evosim.scenarioRunner.pause();
  });
  await page.click(".view-btn[data-view='organism']");
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/organism-view.png", fullPage: false });
});
