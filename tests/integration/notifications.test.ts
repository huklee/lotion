import { afterEach, beforeEach, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createApp } from "../../apps/server/app";
import { NotificationService } from "../../apps/server/notifications";
import { SummaryService } from "../../apps/server/summaries";
import { Repository } from "../../packages/persistence/repository";

let dir: string;
let repo: Repository;
let notifications: NotificationService;
let app: Awaited<ReturnType<typeof createApp>>;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "lotion-notify-"));
  repo = await new Repository(dir).init();
  notifications = new NotificationService(dir);
  const summaries = new SummaryService(repo, {
    dataDir: dir,
    runner: async () => "## 결정 사항\n\n- 출시",
    events: (event) => notifications.add(event),
  });
  app = await createApp(repo, { summaries, notifications });
});
afterEach(async () => {
  await app.close();
  await fs.rm(dir, { recursive: true, force: true });
});

it("records events newest first, counts unread, marks them read and persists", async () => {
  for (const title of ["first", "second"]) {
    const r = await app.inject({
      method: "POST",
      url: "/api/notifications",
      payload: { kind: "meeting.created", title, pageId: "page-1" },
    });
    expect(r.statusCode).toBe(201);
  }
  let list = (await app.inject({ url: "/api/notifications" })).json();
  expect(list.items.map((i: any) => i.title)).toEqual(["second", "first"]);
  expect(list.unread).toBe(2);
  list = (
    await app.inject({
      method: "POST",
      url: "/api/notifications/seen",
      payload: {},
    })
  ).json();
  expect(list.unread).toBe(0);
  // persisted across a restart
  const reopened = new NotificationService(dir);
  expect((await reopened.list()).items).toHaveLength(2);
  expect((await reopened.list()).unread).toBe(0);
  // invalid input rejected
  for (const payload of [
    { kind: "nope", title: "x" },
    { kind: "info", title: "" },
    { kind: "info", title: "x", pageId: "../etc" },
  ])
    expect(
      (await app.inject({ method: "POST", url: "/api/notifications", payload }))
        .statusCode,
    ).toBe(400);
});

it("a finished summary adds a 'summary.done' event pointing at the summary page", async () => {
  const doc = await repo.create("10-16 회의", null, randomUUID());
  await repo.save(
    doc.id,
    doc.revision,
    {
      title: "10-16 회의",
      blocks: [
        {
          id: "a",
          type: "paragraph",
          content: [{ type: "text", text: "raw", styles: {} }],
          children: [],
        },
      ],
      linkPreviews: {},
    } as any,
    randomUUID(),
  );
  await app.inject({
    method: "PUT",
    url: "/api/summary/settings",
    payload: { skill: "" },
  });
  const job = (
    await app.inject({
      method: "POST",
      url: "/api/summary/jobs",
      payload: { pages: [{ id: doc.id }], parentId: doc.id },
    })
  ).json();
  let done: any;
  for (let i = 0; i < 100 && done?.status !== "done"; i++) {
    await new Promise((r) => setTimeout(r, 20));
    done = (await app.inject({ url: `/api/summary/jobs/${job.id}` })).json();
  }
  await new Promise((r) => setTimeout(r, 50));
  const [event] = (await app.inject({ url: "/api/notifications" })).json()
    .items;
  expect(event).toMatchObject({
    kind: "summary.done",
    title: "요약 · 10-16 회의",
    pageId: done.summaryId,
  });
});

it("keeps at most 500 events", async () => {
  for (let i = 0; i < 505; i++)
    await notifications.add({ kind: "info", title: `e${i}` });
  const list = await notifications.list(1000);
  expect(list.items).toHaveLength(500);
  expect(list.items[0].title).toBe("e504");
});
