import { test } from "@playwright/test";

test("baseline screenshot of meiosis theater", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("#chromosome-panel .locus-band");
  await page.click(".view-btn[data-view='meiosis']");
  await page.getByRole("button", { name: "Run meiosis" }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/meiosis-view.png", fullPage: false });
});
