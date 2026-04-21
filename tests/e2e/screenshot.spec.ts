// Takes a baseline screenshot for visual review. Produces a PNG under
// playwright-report/ that a human can inspect. Not a regression test
// yet; we will stabilize a reference after the Phase-2 checkpoint.

import { test } from "@playwright/test";

test("baseline screenshot of organism view", async ({ page }) => {
  await page.goto("/");
  // Wait for engine boot and stats to appear.
  await page.waitForSelector("#scene-canvas");
  await page.locator("#stats-readout").getByText("sex:").waitFor({ timeout: 10_000 });
  // Give the scene a moment to render.
  await page.waitForTimeout(600);
  await page.screenshot({
    path: "test-results/organism-view.png",
    fullPage: false,
  });
});
