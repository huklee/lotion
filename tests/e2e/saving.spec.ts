import { test, expect } from "./fixtures";
import { randomUUID } from "node:crypto";
import { seed } from "./helpers";

test("create, edit, immediate sidebar title, auto-save and reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "New page", exact: true }).click();
  const title = `Browser ${randomUUID().slice(0, 6)}`;
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "Untitled",
  );
  await page.getByRole("textbox", { name: "Page title" }).fill(title);
  await expect(
    page
      .getByRole("navigation", { name: "Pages" })
      .getByText(title, { exact: true }),
  ).toBeVisible();
  const editor = page.locator(".tiptap");
  await editor.click();
  await page.keyboard.insertText("A thought worth keeping. English 🙂");
  await expect(page.locator(".save-status")).toHaveText("Saved", {
    timeout: 15000,
  });
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    title,
  );
  await expect(page.locator(".tiptap")).toContainText(
    "A thought worth keeping. English 🙂",
  );
  expect(errors).toEqual([]);
});
test("two tabs preserve conflicting drafts", async ({ page, context }) => {
  const doc = await seed(page, "Conflict source");
  const second = await context.newPage();
  await second.goto(`/#/page/${doc.id}`);
  await expect(second.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "Conflict source",
  );
  await page.getByRole("textbox", { name: "Page title" }).fill("First writer");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await second
    .getByRole("textbox", { name: "Page title" })
    .fill("Second writer draft");
  await second.keyboard.press("ControlOrMeta+s");
  await expect(second.locator(".save-status")).toHaveText("Conflict");
  await expect(second.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "Second writer draft",
  );
  await expect(
    second.getByRole("button", { name: "Save draft as a copy" }),
  ).toBeVisible();
  await second.reload();
  await expect(
    second.getByRole("button", { name: "Review latest versions" }),
  ).toBeVisible();
  await expect(
    second.getByRole("button", { name: "Use my draft" }),
  ).toBeVisible();
  second.once("dialog", (dialog) => dialog.accept());
  await second.getByRole("button", { name: "Use my draft" }).click();
  await expect(second.locator(".save-status")).toHaveText("Saved");
  await second.reload();
  await expect(second.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "Second writer draft",
  );
  expect(
    (await (await second.request.get(`/api/documents/${doc.id}`)).json()).title,
  ).toBe("Second writer draft");
  await second.close();
});
test("pending page A save cannot overwrite page B while navigating", async ({
  page,
}) => {
  const a = await seed(page, "Navigation A");
  const b = (
    await page.request.post("/api/documents", {
      data: { title: "Navigation B", mutationId: randomUUID() },
    })
  ).json();
  const next = await b;
  await page.route(`**/api/documents/${a.id}/content`, async (route) => {
    await new Promise((r) => setTimeout(r, 700));
    await route.continue();
  });
  await page
    .getByRole("textbox", { name: "Page title" })
    .fill("A saved in background");
  await page.keyboard.press("ControlOrMeta+s");
  await page.evaluate((id) => {
    location.hash = `#/page/${id}`;
  }, next.id);
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "Navigation B",
  );
  await expect
    .poll(async () =>
      (await page.request.get(`/api/documents/${a.id}`))
        .json()
        .then((d) => d.title),
    )
    .toBe("A saved in background");
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "Navigation B",
  );
});

test("reload restores an offline browser draft and reconnect saves it", async ({
  page,
}) => {
  await seed(page, "Offline original");
  await page.route("**/api/documents/*/content", (route) => route.abort());
  await page
    .getByRole("textbox", { name: "Page title" })
    .fill("Offline draft retained");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Offline draft");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "Offline draft retained",
  );
  await page.unroute("**/api/documents/*/content");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(
    "Offline draft retained",
  );
});
