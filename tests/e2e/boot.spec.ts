import { test, expect } from "@playwright/test";

test("app boots and shows a creature in the scene", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto("/");

  // The canvas must exist and be sized.
  const canvas = page.locator("#scene-canvas");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveCount(1);

  // Wait for the engine to initialize and render stats.
  await expect(page.locator("#stats-readout")).toContainText("sex:", { timeout: 10_000 });
  await expect(page.locator("#scenario-label")).toContainText("generic_fish");
  await expect(page.locator("#generation-label")).toContainText("Generation 0");

  // Chromosome panel populated with bands.
  const bands = page.locator("#chromosome-panel .locus-band");
  await expect(bands.first()).toBeVisible();
  expect(await bands.count()).toBeGreaterThan(5);

  expect(errors).toEqual([]);
});

test("hovering a gene band sets a hover-locus on state", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("#chromosome-panel .locus-band");

  // Hover the first band and check a highlight outline appears (CSS class).
  const firstBand = page.locator("#chromosome-panel .locus-band").first();
  await firstBand.hover();
  await expect(firstBand).toHaveClass(/highlight/);
});
