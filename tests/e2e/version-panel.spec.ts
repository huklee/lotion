import { readFileSync } from "node:fs";
import { test, expect } from "./fixtures";
import { seed } from "./helpers";

const version = JSON.parse(readFileSync("package.json", "utf8")).version;

test("version button shows the running version and the changelog per pull request", async ({
  page,
}) => {
  await seed(page, "Version panel");
  await page.evaluate(() => localStorage.removeItem("lotion-seen-version"));
  await page.reload();
  const button = page.getByRole("button", {
    name: `Version ${version} — what's new`,
  });
  await expect(button).toHaveText(`v${version}`);
  await expect(button.locator(".version-dot")).toHaveCount(1);
  await button.click();
  const panel = page.getByRole("dialog", { name: "What's new" });
  await expect(panel.getByText(`Lotion ${version}`)).toBeVisible();
  const first = panel.locator(".version-release").first();
  await expect(first).toHaveAttribute("open", "");
  await expect(first.locator(".version-number")).toHaveText(version);
  await expect(first.getByText("current", { exact: true })).toBeVisible();
  // releases link to the pull request that shipped them
  await expect(
    panel.locator('a[href="https://github.com/huklee/lotion/pull/49"]'),
  ).toHaveText("#49");
  // search narrows the list
  await panel.getByLabel("Search changes").fill("Feed view for databases");
  await expect(panel.locator(".version-release")).toHaveCount(1);
  await expect(panel.locator(".version-number")).toHaveText("0.31.0");
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  // opened once: the dot goes away and stays away after a reload
  await expect(button.locator(".version-dot")).toHaveCount(0);
  await page.reload();
  await expect(
    page
      .getByRole("button", { name: `Version ${version} — what's new` })
      .locator(".version-dot"),
  ).toHaveCount(0);
});
