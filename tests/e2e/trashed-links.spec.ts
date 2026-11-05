import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";
import { seed } from "./helpers";

test("links to a page in the Trash say so, and look normal again after restore", async ({
  page,
}) => {
  const created = await page.request.post("/api/documents", {
    data: { title: "Old plan", mutationId: randomUUID() },
  });
  const target = await created.json();
  const other = await (
    await page.request.post("/api/documents", {
      data: { title: "Kept page", mutationId: randomUUID() },
    })
  ).json();
  await seed(page, "Links to pages", [
    {
      id: "link-mention",
      type: "paragraph",
      content: [
        { type: "text", text: "See ", styles: {} },
        {
          type: "mention",
          props: {
            kind: "page",
            href: `#/page/${target.id}`,
            label: "Old plan",
            icon: "📄",
            value: "",
          },
        },
        { type: "text", text: " and ", styles: {} },
        {
          type: "mention",
          props: {
            kind: "page",
            href: `#/page/${other.id}`,
            label: "Kept page",
            icon: "📄",
            value: "",
          },
        },
      ],
    },
    {
      id: "link-plain",
      type: "paragraph",
      content: [
        {
          type: "link",
          href: `#/page/${target.id}#block=abc`,
          content: [
            { type: "text", text: "a block in the old plan", styles: {} },
          ],
        },
      ],
    },
  ]);
  const mention = page.locator(
    `.bn-editor a.lotion-mention[href="#/page/${target.id}"]`,
  );
  const kept = page.locator(
    `.bn-editor a.lotion-mention[href="#/page/${other.id}"]`,
  );
  const plain = page.locator('[data-id="link-plain"] a[href*="#block=abc"]');
  const badge = (locator: typeof mention) =>
    locator.evaluate((el) => getComputedStyle(el, "::after").content);
  const strike = (locator: typeof mention) =>
    locator.evaluate((el) => {
      const label = el.classList.contains("lotion-mention")
        ? el.querySelector(":scope > span:not(.lotion-mention-icon)")!
        : el;
      return getComputedStyle(label).textDecorationLine;
    });
  await expect(mention).toBeVisible();
  expect(await badge(mention)).toBe("none");

  // trash the target page; the open page marks both links, not the other one
  const trashResponse = await page.request.post(
    `/api/documents/${target.id}/trash`,
    {
      headers: { "If-Match": String(target.revision) },
      data: {},
    },
  );
  expect(trashResponse.ok()).toBe(true);
  const trashed = await trashResponse.json();
  await page.reload();
  await expect(mention).toBeVisible();
  await expect.poll(() => badge(mention)).toBe('"In Trash"');
  expect(await strike(mention)).toContain("line-through");
  await expect.poll(() => badge(plain)).toBe('"In Trash"');
  expect(await strike(plain)).toContain("line-through");
  expect(await badge(kept)).toBe("none");
  expect(await strike(kept)).not.toContain("line-through");

  // restore: the links look normal again
  const restored = await page.request.post(
    `/api/documents/${target.id}/restore`,
    {
      headers: {
        "If-Match": String(trashed.revision ?? trashed.document?.revision),
      },
      data: {},
    },
  );
  expect(restored.ok()).toBe(true);
  await page.reload();
  await expect(mention).toBeVisible();
  await expect.poll(() => badge(mention)).toBe("none");
  expect(await strike(mention)).not.toContain("line-through");
});
