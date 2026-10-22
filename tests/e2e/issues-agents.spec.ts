import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";

// Workers share one server; every test uses its own titles.
test("agent changes show a badge and a bell entry that opens the issue", async ({
  page,
}) => {
  const title = `Agent ${randomUUID().slice(0, 6)}`;
  await page.goto("/#/issues");
  await expect(page.getByRole("heading", { name: "Issues" })).toBeVisible();
  const created = await (
    await page.request.post("/api/issues", {
      headers: { "X-Lotion-Author": "codex" },
      data: { title },
    })
  ).json();
  await page.request.post(`/api/issues/${created.number}/move`, {
    headers: { "X-Lotion-Author": "codex" },
    data: { status: "doing" },
  });
  const card = page.locator(`.issue-card[data-issue="${created.number}"]`);
  await expect(card.locator(".issue-author")).toHaveText("codex", {
    timeout: 12000,
  });

  const bell = page.getByRole("button", { name: /^Notifications/ });
  await expect(bell).toHaveAccessibleName(/unread/);
  await bell.click();
  const entry = page
    .getByRole("dialog", { name: "Notifications" })
    .getByRole("button")
    .filter({ hasText: `#${created.number} ${title}` })
    .filter({ hasText: "codex moved it to In progress" });
  await entry.click();
  await expect(page).toHaveURL(new RegExp(`#/issues/${created.number}$`));
  const panel = page.getByRole("complementary", {
    name: `Issue #${created.number}`,
  });
  await expect(panel.locator(".issue-author-name.agent").first()).toHaveText(
    "codex",
  );
});

test("an agent's change during your edit asks before overwriting; Keep mine saves yours", async ({
  page,
}) => {
  const created = await (
    await page.request.post("/api/issues", {
      data: { title: `Clash ${randomUUID().slice(0, 6)}` },
    })
  ).json();
  await page.goto(`/#/issues/${created.number}`);
  const panel = page.getByRole("complementary", {
    name: `Issue #${created.number}`,
  });
  await panel.getByRole("button", { name: /Add a description/ }).click();
  const body = panel.getByRole("textbox", { name: "Description" });
  await body.fill("my steps");
  // the agent writes while the field is still being edited
  await page.request.patch(`/api/issues/${created.number}`, {
    headers: { "X-Lotion-Author": "claude" },
    data: { body: "claude's steps" },
  });
  const conflict = panel.getByRole("alert");
  await expect(conflict).toContainText("claude changed this issue", {
    timeout: 12000,
  });
  await expect(body).toHaveValue("my steps");
  await conflict.getByRole("button", { name: "Keep mine" }).click();
  await expect(conflict).toBeHidden();
  await expect
    .poll(
      async () =>
        (await (await page.request.get(`/api/issues/${created.number}`)).json())
          .body,
    )
    .toBe("my steps");
});
