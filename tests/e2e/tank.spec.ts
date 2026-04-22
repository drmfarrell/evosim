import { test, expect } from "@playwright/test";

test("scenario runs and advances generation through the runner", async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto("/");
  await page.waitForSelector(".deck-card", { timeout: 10_000 });

  // Stop the auto-started scenario so we can observe a specific gen count.
  await page.evaluate(() => {
    // @ts-ignore
    window.__evosim.scenarioRunner.pause();
  });

  // Click Hardy-Weinberg card (auto-running will tick it).
  const hw = page.locator(".deck-card", { hasText: "Hardy-Weinberg" });
  await hw.getByRole("button", { name: /Run/ }).click();
  // Pause immediately so we can count.
  await page.evaluate(() => {
    // @ts-ignore
    window.__evosim.scenarioRunner.pause();
  });

  const genBefore = await page.evaluate(() => {
    // @ts-ignore
    return window.__evosim.engine.generation();
  });

  await page.evaluate(() => {
    // @ts-ignore
    const r = window.__evosim.scenarioRunner;
    for (let i = 0; i < 5; i++) r.step();
  });

  const genAfter = await page.evaluate(() => {
    // @ts-ignore
    return window.__evosim.engine.generation();
  });

  expect(genAfter - genBefore).toBe(5);
  expect(errors).toEqual([]);
});

test("directional selection scenario drops the favored light allele", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await page.waitForSelector(".deck-card");

  // Single evaluate that pauses, loads the scenario, steps 15 gens
  // directly on the engine, and reads allele frequencies. Avoids
  // racing with the auto-run timer.
  const result = (await page.evaluate(() => {
    // @ts-ignore
    const ev = window.__evosim;
    ev.scenarioRunner.pause();
    ev.engine.initPopulationBiallelic(200, 0.5);
    const before = JSON.parse(ev.engine.statsJson()).allele0_freq_autosomes[0][0];
    for (let i = 0; i < 15; i++) {
      ev.engine.stepWithRegime("directional_dark", 0);
    }
    const after = JSON.parse(ev.engine.statsJson()).allele0_freq_autosomes[0][0];
    return { before, after };
  })) as { before: number; after: number };

  expect(result.after).toBeLessThan(result.before - 0.02);
});
