import { test, expect } from "@playwright/test";

test("app auto-starts a scenario on landing", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto("/");

  // Scenario deck should be visible with at least 4 cards.
  const cards = page.locator(".deck-card");
  await expect(cards.first()).toBeVisible({ timeout: 10_000 });
  expect(await cards.count()).toBeGreaterThanOrEqual(4);

  // One of the cards should be active (the auto-started one).
  await expect(page.locator(".deck-card.active")).toHaveCount(1);

  // Commentary banner should be visible.
  await expect(page.locator(".commentary")).toBeVisible();

  // Stats should show a population.
  await expect(page.locator("#stats-readout")).toContainText("population N:", {
    timeout: 5_000,
  });

  // Tank view should be active.
  await expect(page.locator(".view-btn[data-view='tank']")).toHaveClass(/active/);

  expect(errors).toEqual([]);
});

test("hovering a gene band highlights fish trait", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("#chromosome-panel .locus-band", { timeout: 10_000 });
  // Pause the auto-running scenario so the chromosome panel stops
  // re-rendering under the cursor.
  await page.evaluate(() => {
    // @ts-ignore
    window.__evosim.scenarioRunner.pause();
  });
  const firstBand = page.locator("#chromosome-panel .locus-band").first();
  await firstBand.hover();
  await expect(firstBand).toHaveClass(/highlight/);
});

test("clicking a scenario card swaps the active experiment", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".deck-card", { timeout: 10_000 });

  // Click the directional-selection card specifically.
  const targetCard = page.locator(".deck-card", {
    hasText: "Selection against light coats",
  });
  await targetCard.getByRole("button", { name: /Run/ }).click();

  await expect(targetCard).toHaveClass(/active/);
  await expect(page.locator(".commentary-headline")).toContainText(
    "directional selection",
    { timeout: 5_000 }
  );
});
