import { test } from "@playwright/test";

test("time each step in bottleneck scenario", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await page.waitForSelector(".deck-card");
  const data = (await page.evaluate(async () => {
    // @ts-ignore
    const ev = window.__evosim;
    // Load bottleneck
    const card = Array.from(document.querySelectorAll<HTMLElement>(".deck-card")).find((c) =>
      c.textContent?.includes("Bottleneck")
    );
    card?.querySelector<HTMLButtonElement>(".deck-card-play")?.click();

    const timings: Array<{ gen: number; dt: number; n: number }> = [];
    for (let i = 0; i < 25; i++) {
      const t0 = performance.now();
      ev.scenarioRunner.step();
      const dt = performance.now() - t0;
      timings.push({ gen: ev.engine.generation(), dt: Math.round(dt), n: ev.engine.populationSize() });
    }
    return timings;
  })) as Array<{ gen: number; dt: number; n: number }>;
  console.log("[perf] bottleneck step timings:");
  for (const t of data) console.log(`  gen ${t.gen}: ${t.dt}ms  N=${t.n}`);
});
