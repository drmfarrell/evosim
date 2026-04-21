import { test } from "@playwright/test";

test("baseline screenshot of population tank", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("#chromosome-panel .locus-band");
  await page.getByRole("button", { name: "Init N=200" }).click();
  await page.waitForTimeout(400);
  await page.selectOption("#regime-select", "directional_dark");
  await page.evaluate(() => {
    // @ts-ignore
    const ev = window.__evosim;
    for (let i = 0; i < 10; i++) ev.engine.stepWithRegime("directional_dark", 0);
    ev.stepOne();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/tank-view.png", fullPage: false });
});
