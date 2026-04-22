import { test, expect } from "@playwright/test";

test("play HW for 3 seconds should not hang", async ({ page }) => {
  test.setTimeout(30_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`PAGE ERR: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`CONSOLE ERR: ${m.text()}`);
  });

  await page.goto("/");
  await page.waitForSelector(".deck-card");

  // Click Play on the currently loaded (HW) scenario.
  await page.click("#play-pause-btn");

  // Watch generation for 3 seconds.
  await page.waitForTimeout(3500);

  const genText = await page.locator("#generation-label").textContent();
  const gen = Number((genText ?? "").replace(/\D/g, ""));
  console.log(`[diag] HW ran to generation ${gen} in 3.5s`);
  console.log(`[diag] errors:`, errors);
  expect(gen).toBeGreaterThan(2);
  expect(errors).toEqual([]);
});

test("step many generations via engine synchronously", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await page.waitForSelector(".deck-card");

  const timings = (await page.evaluate(() => {
    // @ts-ignore
    const ev = window.__evosim;
    const out: number[] = [];
    for (const scen of ["neutral", "directional_dark", "heterozygote_advantage_metabolism"]) {
      ev.engine.initPopulationBiallelic(120, 0.5);
      const t0 = performance.now();
      for (let i = 0; i < 50; i++) {
        try {
          ev.engine.stepWithRegime(scen, 0);
        } catch (e: any) {
          return { error: `${scen} step ${i}: ${e.message || e}` };
        }
      }
      out.push(performance.now() - t0);
    }
    return { timings: out };
  })) as any;
  console.log("[diag] per-regime 50-step timings (ms):", timings);
});

test("run bottleneck scenario through the event", async ({ page }) => {
  test.setTimeout(30_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  await page.waitForSelector(".deck-card");

  const card = page.locator(".deck-card", { hasText: "Bottleneck" });
  await card.getByRole("button", { name: /Run/ }).click();
  // Let runner process 15 generations synchronously.
  await page.evaluate(() => {
    // @ts-ignore
    const r = window.__evosim.scenarioRunner;
    for (let i = 0; i < 15; i++) r.step();
  });
  const gen = await page.evaluate(() => {
    // @ts-ignore
    return window.__evosim.engine.generation();
  });
  console.log(`[diag] bottleneck reached gen ${gen}`);
  expect(errors).toEqual([]);
  expect(gen).toBeGreaterThanOrEqual(15);
});
