import faker from "faker";

import { createNestedMiddleware } from "../src";
import { createParams } from "./utils/createParams";
import { wait } from "./utils/wait";

async function createAsyncError() {
  await wait(100);
  throw new Error("oops")
}

describe("errors", () => {
  it("throws when error encountered while modifying root params", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      await createAsyncError();
      return next(params);
    });

    const next = jest.fn((params: any) => params);
    const params = createParams("User", "create", {
      data: { email: faker.internet.email() },
    });
    await expect(() => nestedMiddleware(params, next)).rejects.toThrow("oops");
  });

  it("throws when error encountered while modifying nested params", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      if (params.model === "Post") {
        await createAsyncError();
      }
      return next(params);
    });

    const next = jest.fn((params: any) => params);
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
        posts: {
          create: { title: faker.lorem.sentence() },
        },
      },
    });

    await expect(() => nestedMiddleware(params, next)).rejects.toThrow("oops");
  });

  it("throws if next encounters an error", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      return next(params);
    });

    const next = jest.fn(() => {
      return createAsyncError();
    });
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
        posts: {
          create: { title: faker.lorem.sentence() },
        },
      },
    });

    await expect(() => nestedMiddleware(params, next)).rejects.toThrow("oops");
  });

  it("throws if error encountered modifying root result", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      await createAsyncError();
      return result;
    });

    const next = jest.fn((params) => params);
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
      },
    });

    await expect(() => nestedMiddleware(params, next)).rejects.toThrow("oops");
  });

  it("throws if error encountered modifying nested result", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (params.model === "Post") {
        await createAsyncError();
      }
      return result;
    });

    const next = jest.fn((params) => params);
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
        posts: {
          create: { title: faker.lorem.sentence() },
        },
      },
    });

    await expect(() => nestedMiddleware(params, next)).rejects.toThrow("oops");
  });
});
