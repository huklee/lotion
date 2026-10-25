import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";

// Workers share one server per worker; every test uses its own titles.
test("issue board: create with c, drag to another status, notes, and CLI/API changes appear live", async ({
  page,
}) => {
  const title = `Board ${randomUUID().slice(0, 6)}`;
  await page.goto("/#/home");
  await page.getByRole("button", { name: "Issues", exact: true }).click();
  await expect(page).toHaveURL(/#\/issues$/);
  await expect(page.getByRole("heading", { name: "Issues" })).toBeVisible();

  // c opens the quick-add in the first column
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("c");
  const input = page.getByRole("textbox", {
    name: "New issue title in Backlog",
  });
  await expect(input).toBeFocused();
  await input.fill(title);
  await input.press("Enter");
  const backlog = page.getByRole("listitem", { name: "Backlog" });
  const card = page.locator(".issue-card").filter({ hasText: title });
  await expect(
    backlog.locator(".issue-card").filter({ hasText: title }),
  ).toBeVisible();
  await input.press("Escape");
  const number = Number(await card.getAttribute("data-issue"));
  // other tests in this worker fill the shared board: show only this card so
  // the drag never has to travel past a long column
  await page.getByRole("textbox", { name: "Filter issues" }).fill(title);
  await page.locator("body").click({ position: { x: 5, y: 5 } });

  // drag to In progress
  const doing = page.getByRole("listitem", { name: "In progress" });
  await card.dragTo(doing);
  await expect(
    doing.locator(".issue-card").filter({ hasText: title }),
  ).toBeVisible();
  await expect
    .poll(
      async () =>
        (await (await page.request.get(`/api/issues/${number}`)).json()).status,
    )
    .toBe("doing");

  // open it: status note from the drag, then add a note
  await card.click();
  await expect(page).toHaveURL(new RegExp(`#/issues/${number}$`));
  const panel = page.getByRole("complementary", { name: `Issue #${number}` });
  await expect(panel.getByRole("textbox", { name: "Title" })).toHaveValue(
    title,
  );
  await expect(panel.getByRole("list", { name: "Status notes" })).toContainText(
    "Backlog → In progress",
  );
  const note = panel.getByRole("textbox", { name: "Add a status note" });
  await note.fill("원인 찾음, 수정 중");
  await note.press("Enter");
  await expect(panel.getByRole("list", { name: "Status notes" })).toContainText(
    "원인 찾음, 수정 중",
  );
  // created + status + note: two notes after creation
  await expect(card.locator(".issue-notes-count")).toHaveText("2");

  // an agent (CLI) moves it to Done: the open board follows within a poll
  await page.request.post(`/api/issues/${number}/move`, {
    headers: { "X-Lotion-Author": "codex" },
    data: { status: "done" },
  });
  const done = page.getByRole("listitem", { name: "Done" });
  await expect(
    done.locator(".issue-card").filter({ hasText: title }),
  ).toBeVisible({
    timeout: 12000,
  });
  await expect(panel.getByRole("combobox", { name: "Status" })).toHaveValue(
    "done",
  );
  await expect(panel.getByRole("list", { name: "Status notes" })).toContainText(
    "codex",
  );

  // Escape closes the panel; a deep link opens it again
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/#\/issues$/);
  await expect(panel).toBeHidden();
  await page.goto(`/#/issues/${number}`);
  await page.reload();
  await expect(panel.getByRole("textbox", { name: "Title" })).toHaveValue(
    title,
  );
});

test("issue panel edits title and labels, refuses stale edits, deletes", async ({
  page,
}) => {
  const title = `Edit ${randomUUID().slice(0, 6)}`;
  const created = await (
    await page.request.post("/api/issues", { data: { title } })
  ).json();
  await page.goto(`/#/issues/${created.number}`);
  const panel = page.getByRole("complementary", {
    name: `Issue #${created.number}`,
  });
  const titleBox = panel.getByRole("textbox", { name: "Title" });
  await expect(titleBox).toHaveValue(title);
  await titleBox.fill(`${title} renamed`);
  await titleBox.press("Enter");
  await expect(
    page.locator(".issue-card").filter({ hasText: `${title} renamed` }),
  ).toBeVisible();
  const labels = panel.getByRole("textbox", { name: "Labels" });
  await labels.fill("bug, ui");
  await labels.press("Enter");
  await expect(
    page.locator(".issue-card").filter({ hasText: `${title} renamed` }),
  ).toContainText("bug");

  // you type, someone else saves before you leave the field: your edit is not
  // saved over theirs; you choose (whether a refresh or the save notices first)
  await panel.getByRole("button", { name: /Add a description/ }).click();
  const body = panel.getByRole("textbox", { name: "Description" });
  await body.fill("from the browser");
  const current = await (
    await page.request.get(`/api/issues/${created.number}`)
  ).json();
  await page.request.patch(`/api/issues/${created.number}`, {
    headers: { "If-Match": `"${current.version}"`, "X-Lotion-Author": "cli" },
    data: { body: "from the CLI" },
  });
  await body.blur();
  const conflict = panel.getByRole("alert");
  await expect(conflict).toContainText("cli changed this issue");
  await conflict.getByRole("button", { name: "Use theirs" }).click();
  await expect(panel.getByRole("region", { name: "Description" })).toHaveText(
    "from the CLI",
  );
  await expect(conflict).toBeHidden();

  await panel.getByRole("button", { name: "Delete issue" }).click();
  await panel.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(/#\/issues$/);
  await expect(
    page.locator(".issue-card").filter({ hasText: `${title} renamed` }),
  ).toHaveCount(0);
});

test("descriptions and notes render Markdown; click to edit the source", async ({
  page,
}) => {
  const created = await (
    await page.request.post("/api/issues", {
      data: {
        title: `Markdown ${randomUUID().slice(0, 6)}`,
        body: "## Steps\n**Repro** in [docs](https://example.com)\n- [ ] add a test\n- ship it\n\n```ts\nconst x = 1;\n```\n<script>window.hacked = 1</script>",
      },
    })
  ).json();
  await page.goto(`/#/issues/${created.number}`);
  const panel = page.getByRole("complementary", {
    name: `Issue #${created.number}`,
  });
  const view = panel.getByRole("region", { name: "Description" });
  await expect(view.locator("h2")).toHaveText("Steps");
  await expect(view.locator("strong")).toHaveText("Repro");
  await expect(view.getByRole("link", { name: "docs" })).toHaveAttribute(
    "target",
    "_blank",
  );
  await expect(view.locator('input[type="checkbox"]')).toHaveCount(1);
  await expect(view.locator("pre code")).toHaveText("const x = 1;");
  await expect(view).toContainText("<script>window.hacked = 1</script>");
  expect(await page.evaluate(() => (window as any).hacked)).toBeUndefined();

  // click to edit the Markdown source; leaving the field renders it again
  await view.locator("h2").click();
  const source = panel.getByRole("textbox", { name: "Description" });
  await expect(source).toBeFocused();
  await expect(source).toHaveValue(/^## Steps/);
  await source.press("End");
  await source.press("ControlOrMeta+End");
  await page.keyboard.type("\n\n_added later_");
  await source.blur();
  await expect(view.locator("em")).toHaveText("added later");
  await expect
    .poll(
      async () =>
        (await (await page.request.get(`/api/issues/${created.number}`)).json())
          .body,
    )
    .toContain("_added later_");

  // notes render Markdown too
  const note = panel.getByRole("textbox", { name: "Add a status note" });
  await note.fill("**done**: `npm test` green");
  await note.press("Enter");
  const notes = panel.getByRole("list", { name: "Status notes" });
  await expect(notes.locator("strong")).toHaveText("done");
  await expect(notes.locator("code")).toHaveText("npm test");
});

test("columns share the window width and scroll sideways when it is too narrow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 800 });
  await page.goto("/#/issues");
  const board = page.getByRole("list", { name: "Issue board" });
  await expect(board).toBeVisible();
  const widths = async () =>
    board
      .getByRole("listitem")
      .evaluateAll((cols) => cols.map((c) => c.getBoundingClientRect().width));
  const wide = await widths();
  expect(wide).toHaveLength(4);
  // equal shares, wider than the old fixed 272 px, and no horizontal scroll
  expect(Math.min(...wide)).toBeGreaterThan(272);
  expect(Math.max(...wide) - Math.min(...wide)).toBeLessThan(2);
  expect(await board.evaluate((b) => b.scrollWidth <= b.clientWidth + 1)).toBe(
    true,
  );

  await page.setViewportSize({ width: 820, height: 800 });
  const narrow = await widths();
  expect(Math.min(...narrow)).toBeGreaterThanOrEqual(239.5);
  expect(await board.evaluate((b) => b.scrollWidth > b.clientWidth)).toBe(true);
});

test("description checkboxes tick in place and strike the item; Enter adds a note, Shift+Enter breaks the line", async ({
  page,
}) => {
  const created = await (
    await page.request.post("/api/issues", {
      data: {
        title: `Tasks ${randomUUID().slice(0, 6)}`,
        body: "Checklist\n\n- [ ] write the test\n  - [ ] nested step\n- [x] read the code",
      },
    })
  ).json();
  await page.goto(`/#/issues/${created.number}`);
  const panel = page.getByRole("complementary", {
    name: `Issue #${created.number}`,
  });
  const view = panel.getByRole("region", { name: "Description" });
  const boxes = view.locator('input[type="checkbox"]');
  await expect(boxes).toHaveCount(3);
  await expect(boxes.nth(2)).toBeChecked();
  await expect(
    view.locator("li.task-item.checked > .task-text").first(),
  ).toHaveCSS("text-decoration-line", "line-through");

  // tick the first: it is struck at once, the nested step is not, and the
  // Markdown source is saved; no editor opens
  await boxes.nth(0).click();
  await expect(boxes.nth(0)).toBeChecked();
  const first = view.locator("li.task-item").first();
  await expect(first).toHaveClass(/checked/);
  await expect(first.locator("> .task-text")).toHaveCSS(
    "text-decoration-line",
    "line-through",
  );
  await expect(first.locator("li.task-item .task-text")).toHaveCSS(
    "text-decoration-line",
    "none",
  );
  await expect(panel.getByRole("textbox", { name: "Description" })).toHaveCount(
    0,
  );
  await expect
    .poll(
      async () =>
        (await (await page.request.get(`/api/issues/${created.number}`)).json())
          .body,
    )
    .toBe(
      "Checklist\n\n- [x] write the test\n  - [ ] nested step\n- [x] read the code",
    );

  // untick the done one
  await boxes.nth(2).click();
  await expect(boxes.nth(2)).not.toBeChecked();
  await expect
    .poll(
      async () =>
        (await (await page.request.get(`/api/issues/${created.number}`)).json())
          .body,
    )
    .toContain("- [ ] read the code");

  // notes: Shift+Enter is a new line, Enter adds
  const note = panel.getByRole("textbox", { name: "Add a status note" });
  await note.click();
  await page.keyboard.type("line one");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("line two");
  await expect(note).toHaveValue("line one\nline two");
  await page.keyboard.press("Enter");
  await expect(note).toHaveValue("");
  await expect(panel.getByRole("list", { name: "Status notes" })).toContainText(
    "line two",
  );
  const notes = (
    await (await page.request.get(`/api/issues/${created.number}`)).json()
  ).notes;
  expect(notes.at(-1).text).toBe("line one\nline two");
});

test("written status notes can be edited and deleted; automatic ones cannot", async ({
  page,
}) => {
  const created = await (
    await page.request.post("/api/issues", {
      data: { title: `Edit notes ${randomUUID().slice(0, 6)}` },
    })
  ).json();
  await page.request.post(`/api/issues/${created.number}/notes`, {
    data: { text: "first draft" },
  });
  await page.goto(`/#/issues/${created.number}`);
  const panel = page.getByRole("complementary", {
    name: `Issue #${created.number}`,
  });
  const notes = panel.getByRole("list", { name: "Status notes" });
  const written = notes.locator(".issue-note.kind-note");
  await expect(written).toContainText("first draft");
  // the automatic "Created" entry has no edit button
  await expect(
    notes.locator(".issue-note.kind-created").getByRole("button"),
  ).toHaveCount(0);

  await written.hover();
  await written.getByRole("button", { name: "Edit note" }).click();
  const box = written.getByRole("textbox", { name: "Edit note text" });
  await expect(box).toBeFocused();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("**final** text");
  await page.keyboard.press("Enter");
  await expect(written.locator("strong")).toHaveText("final");
  await expect(written).toContainText("edited");

  // Esc cancels an edit and keeps the panel open
  await written.hover();
  await written.getByRole("button", { name: "Edit note" }).click();
  await page.keyboard.type(" discarded");
  await page.keyboard.press("Escape");
  await expect(panel).toBeVisible();
  await expect(written).not.toContainText("discarded");
  expect(
    (
      await (await page.request.get(`/api/issues/${created.number}`)).json()
    ).notes.at(-1).text,
  ).toBe("**final** text");

  // delete asks first
  await written.hover();
  await written.getByRole("button", { name: "Delete note" }).click();
  await written.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(notes.locator(".issue-note.kind-note")).toHaveCount(0);
  expect(
    (await (await page.request.get(`/api/issues/${created.number}`)).json())
      .notes,
  ).toHaveLength(1);
});
