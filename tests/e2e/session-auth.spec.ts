import { test, expect } from "@playwright/test";
import { startE2EServer } from "./server";

const TOKEN = "e2e-session-token";

test("the token is asked once per browser; new tabs, reloads and restarts stay signed in; sign out asks again", async ({
  browser,
}) => {
  const server = await startE2EServer({ token: TOKEN });
  try {
    const context = await browser.newContext({ baseURL: server.baseURL });
    const page = await context.newPage();
    await page.goto("/");
    const dialog = page.getByLabel("Workspace token");
    await expect(dialog).toBeVisible();
    await dialog.fill("wrong");
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page.getByText("That token is not correct.")).toBeVisible();
    await dialog.fill(TOKEN);
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(dialog).toHaveCount(0);
    // the token is not kept in the page; an HttpOnly cookie is
    expect(
      await page.evaluate(() => sessionStorage.getItem("lotion-token")),
    ).toBeNull();
    const cookie = (await context.cookies()).find(
      (c) => c.name === "lotion_session",
    );
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Strict" });
    // reload and a new tab: no prompt
    await page.reload();
    await expect(
      page.getByRole("button", { name: "New page" }).first(),
    ).toBeVisible();
    await expect(page.getByLabel("Workspace token")).toHaveCount(0);
    const second = await context.newPage();
    await second.goto("/");
    await expect(
      second.getByRole("button", { name: "New page" }).first(),
    ).toBeVisible();
    await expect(second.getByLabel("Workspace token")).toHaveCount(0);
    await second.close();
    // sign out from Control panel → asked again
    await page
      .getByRole("button", { name: "Control panel", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Sign out of this browser" })
      .click();
    await expect(page.getByLabel("Workspace token")).toBeVisible();
    await context.close();
  } finally {
    await server.close();
  }
});

test("a tab that still has the old per-tab token is upgraded to a session silently", async ({
  browser,
}) => {
  const server = await startE2EServer({ token: TOKEN });
  try {
    const context = await browser.newContext({ baseURL: server.baseURL });
    await context.addInitScript((token) => {
      if (!sessionStorage.getItem("upgraded")) {
        sessionStorage.setItem("lotion-token", token);
        sessionStorage.setItem("upgraded", "1");
      }
    }, TOKEN);
    const page = await context.newPage();
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "New page" }).first(),
    ).toBeVisible();
    await expect(page.getByLabel("Workspace token")).toHaveCount(0);
    await expect
      .poll(async () =>
        (await context.cookies()).some((c) => c.name === "lotion_session"),
      )
      .toBe(true);
    expect(
      await page.evaluate(() => sessionStorage.getItem("lotion-token")),
    ).toBeNull();
    await context.close();
  } finally {
    await server.close();
  }
});
