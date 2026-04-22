import { test } from "@playwright/test";

test("landing screenshot: scenario deck + commentary + running experiment", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".deck-card");
  // Let the auto-running scenario tick a few generations so the chart
  // has some data.
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "test-results/landing.png", fullPage: false });
});
