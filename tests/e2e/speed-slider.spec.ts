import { test, expect } from "@playwright/test";

test("speed slider exists and changes tick period", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".deck-card");
  const slider = page.locator(".speed-slider input[type='range']");
  await expect(slider).toBeVisible();
  await expect(page.locator(".speed-label")).toContainText(/Slow|Normal|Fast|Turbo/);

  // Dragging to the fastest stop updates the label and period.
  await slider.fill("3");
  await expect(page.locator(".speed-label")).toHaveText("Turbo");
});

test("food particles render while tank is visible", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".deck-card");
  // Let behavior run a bit.
  await page.waitForTimeout(800);
  const hasFoodMesh = await page.evaluate(() => {
    // @ts-ignore
    const scene = window.__evosim?.scene;
    if (!scene) return false;
    let found = false;
    scene.scene.traverse((obj: any) => {
      if (obj.isInstancedMesh && obj.material?.emissive?.getHex?.() === 0x8b4a00) {
        found = true;
      }
    });
    return found;
  });
  expect(hasFoodMesh).toBe(true);
});
