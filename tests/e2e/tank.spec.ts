import { test, expect } from "@playwright/test";

// Verifies the population tank: init population, step generations,
// observe stats + allele-freq chart updates.

test("init population N=50 and step neutral for 5 generations", async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto("/");

  // Wait for boot.
  await page.waitForSelector("#chromosome-panel .locus-band", { timeout: 10_000 });

  // Click Init N=50.
  await page.getByRole("button", { name: "Init N=50" }).click();

  // Tank view should be active.
  await expect(page.locator(".view-btn[data-view='tank']")).toHaveClass(/active/);

  // Stats should show N = 50.
  await expect(page.locator("#stats-readout")).toContainText("N: 50", { timeout: 5_000 });

  // Drive 5 steps directly through the engine to avoid UI-side
  // rebuild overhead per step. UI sync happens once at the end.
  await page.evaluate(() => {
    // @ts-ignore
    const ev = window.__evosim;
    for (let i = 0; i < 5; i++) ev.engine.stepNeutral(0);
  });

  // Force one UI sync after the 5 steps.
  await page.evaluate(() => {
    // @ts-ignore
    window.__evosim.stepOne();
  });

  await expect(page.locator("#generation-label")).toContainText("Generation 6");

  // Allele-freq chart canvas exists and is drawn.
  const canvas = page.locator("#allele-chart-mount canvas");
  await expect(canvas).toBeVisible();

  expect(errors).toEqual([]);
});

test("directional selection raises the favored allele over 15 generations", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await page.waitForSelector("#chromosome-panel .locus-band");

  await page.getByRole("button", { name: "Init N=200" }).click();
  await expect(page.locator("#stats-readout")).toContainText("N: 200", { timeout: 5_000 });

  await page.selectOption("#regime-select", "directional_dark");

  // Drive the simulation directly through the debug handle to avoid
  // per-click overhead. Steps 15 generations under the selected regime.
  const { before, after } = (await page.evaluate(async () => {
    // @ts-ignore
    const ev = window.__evosim;
    // @ts-ignore
    const engine = ev.engine;
    const readP = () => {
      const j = engine.statsJson();
      const s = JSON.parse(j);
      return s.allele0_freq_autosomes[0][0];
    };
    const before = readP();
    for (let i = 0; i < 15; i++) {
      engine.stepWithRegime("directional_dark", 0);
    }
    const after = readP();
    return { before, after };
  })) as { before: number; after: number };

  // directional_dark targets the high body_color_hue (value 0.82)
  // which maps to "bb" (allele 1 homozygous). So allele-0 frequency
  // should drop measurably over 15 generations.
  expect(after).toBeLessThan(before - 0.02);
});
