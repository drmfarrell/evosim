import { test } from "@playwright/test";

test("capture Firefox boot logs", async ({ page }) => {
  test.setTimeout(30_000);
  const logs: string[] = [];
  page.on("pageerror", (e) => logs.push(`PAGE ERR: ${e.message}\n${e.stack ?? ""}`));
  page.on("console", (m) => logs.push(`${m.type().toUpperCase()}: ${m.text()}`));
  page.on("requestfailed", (r) => logs.push(`REQ FAIL: ${r.url()} ${r.failure()?.errorText}`));

  await page.goto("/");
  await page.waitForTimeout(8000);
  console.log("---logs---");
  for (const l of logs) console.log(l);
});
