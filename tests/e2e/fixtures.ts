import {
  test as base,
  expect,
  type Page,
} from "@playwright/test";
import { startE2EServer } from "./server";

type WorkerFixtures = { workerBaseURL: string };

export const test = base.extend<object, WorkerFixtures>({
  workerBaseURL: [
    async ({ browserName: _browserName }, use) => {
      const server = await startE2EServer();
      try {
        await use(server.baseURL);
      } finally {
        await server.close();
      }
    },
    { scope: "worker" },
  ],
  baseURL: async ({ workerBaseURL }, use) => {
    await use(workerBaseURL);
  },
});

export { expect, type Page };
