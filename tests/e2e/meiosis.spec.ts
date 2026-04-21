import { test, expect } from "@playwright/test";

test("meiosis theater shows parent + gamete after running meiosis", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("#chromosome-panel .locus-band");

  // Switch to meiosis view.
  await page.click(".view-btn[data-view='meiosis']");

  // Theater should be visible.
  const theater = page.locator("#meiosis-theater-mount");
  await expect(theater).toBeVisible();

  // Parent panel should have homolog pairs.
  const parentBands = theater.locator(".theater-block").nth(0).locator(".locus-band");
  expect(await parentBands.count()).toBeGreaterThan(5);

  // Run meiosis.
  await page.getByRole("button", { name: "Run meiosis" }).click();

  // Gamete panel should populate.
  const gameteBands = theater.locator(".theater-block").nth(1).locator(".locus-band");
  await expect(gameteBands.first()).toBeVisible();
});
