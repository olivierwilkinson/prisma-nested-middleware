import faker from "faker";

import { createNestedMiddleware } from "../src";
import { createParams } from "./utils/createParams";
import { wait } from "./utils/wait";

function addReturnedDate(result: any) {
  if (typeof result === "undefined") return;
  const returned = new Date();

  if (Array.isArray(result)) {
    return result.map((item) => ({ ...item, returned }));
  }

  return { ...result, returned };
}

describe("results", () => {
  it("allows middleware to modify root result", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      return addReturnedDate(result);
    });

    const params = createParams("User", "create", {
      data: { email: faker.internet.email() },
    });
    const next = jest.fn(() =>
      Promise.resolve({
        id: faker.datatype.number(),
        email: params.args.data.email,
      })
    );
    const result = await nestedMiddleware(params, next);

    expect(result).toEqual({
      id: expect.any(Number),
      email: params.args.data.email,
      returned: expect.any(Date),
    });
  });

  it("allows middleware to modify root result asynchronously", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      await wait(100);
      return addReturnedDate(result);
    });

    const params = createParams("User", "create", {
      data: { email: faker.internet.email() },
    });
    const next = jest.fn(() =>
      Promise.resolve({
        id: faker.datatype.number(),
        email: params.args.data.email,
      })
    );
    const result = await nestedMiddleware(params, next);

    expect(result).toEqual({
      id: expect.any(Number),
      email: params.args.data.email,
      returned: expect.any(Date),
    });
  });

  it("allows middleware to modify nested results", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (!result) return;

      if (params.model === "Post") {
        return addReturnedDate(result);
      }

      return result;
    });

    const next = jest.fn(() =>
      Promise.resolve({
        id: faker.datatype.number(),
        email: params.args.data.email,
        posts: [
          {
            id: faker.datatype.number(),
            title: params.args.data.posts.create.title,
          },
        ],
      })
    );
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
        posts: { create: { title: faker.lorem.sentence() } },
      },
    });
    const result = await nestedMiddleware(params, next);

    expect(result).toEqual({
      id: expect.any(Number),
      email: params.args.data.email,
      posts: [
        {
          id: expect.any(Number),
          title: params.args.data.posts.create.title,
          returned: expect.any(Date),
        },
      ],
    });
  });

  it("allows middleware to modify nested results asynchronously", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (!result) return;

      if (params.model === "Post") {
        await wait(100);
        return addReturnedDate(result);
      }

      return result;
    });

    const next = jest.fn(() =>
      Promise.resolve({
        id: faker.datatype.number(),
        email: params.args.data.email,
        posts: [
          {
            id: faker.datatype.number(),
            title: params.args.data.posts.create.title,
          },
        ],
      })
    );
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
        posts: { create: { title: faker.lorem.sentence() } },
      },
    });
    const result = await nestedMiddleware(params, next);

    expect(result).toEqual({
      id: expect.any(Number),
      email: params.args.data.email,
      posts: [
        {
          id: expect.any(Number),
          title: params.args.data.posts.create.title,
          returned: expect.any(Date),
        },
      ],
    });
  });

  it.failing("allows middleware to modify deeply nested results", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (typeof result === "undefined") return;

      if (params.model === "Comment") {
        await wait(100);
      }
      // modify Post result last to make sure comments are not overwritten
      if (params.model === "Post") {
        await wait(200);
      }

      return result;
    });

    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
        posts: {
          create: {
            title: faker.lorem.sentence(),
            comments: {
              create: {
                content: faker.lorem.sentence(),
                authorId: faker.datatype.number(),
              },
            },
          },
        },
      },
    });
    const next = jest.fn(() =>
      Promise.resolve({
        id: faker.datatype.number(),
        email: params.args.data.email,
        posts: [
          {
            id: faker.datatype.number(),
            title: params.args.data.posts.create.title,
            comments: [
              {
                id: faker.datatype.number(),
                content: params.args.data.posts.create.comments.create.content,
              },
            ],
          },
        ],
      })
    );
    const result = await nestedMiddleware(params, next);

    expect(result).toEqual({
      id: expect.any(Number),
      email: params.args.data.email,
      posts: [
        {
          id: expect.any(Number),
          title: params.args.data.posts.create.title,
          comments: [
            {
              id: expect.any(Number),
              content: params.args.data.posts.create.comments.create.content,
              returned: expect.any(Date),
            },
          ],
        },
      ],
    });
  });

  it("waits for all middleware to finish modifying result before resolving", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (typeof result === "undefined") return;

      if (params.model === "Post") {
        await wait(100);
      }
      if (params.model === "Profile") {
        await wait(200);
      }
      return addReturnedDate(result);
    });

    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
        posts: {
          create: {
            title: faker.lorem.sentence(),
          },
        },
        profile: {
          create: {
            bio: faker.lorem.sentence(),
          },
        },
      },
    });
    const next = jest.fn(() =>
      Promise.resolve({
        id: faker.datatype.number(),
        email: params.args.data.email,
        posts: [
          {
            id: faker.datatype.number(),
            title: params.args.data.posts.create.title,
          },
        ],
        profile: {
          id: faker.datatype.number(),
          bio: params.args.data.profile.create.bio,
        },
      })
    );
    const result = await nestedMiddleware(params, next);

    expect(result).toEqual({
      id: expect.any(Number),
      email: params.args.data.email,
      returned: expect.any(Date),
      posts: [
        {
          id: expect.any(Number),
          title: params.args.data.posts.create.title,
          returned: expect.any(Date),
        },
      ],
      profile: {
        id: expect.any(Number),
        bio: params.args.data.profile.create.bio,
        returned: expect.any(Date),
      },
    });
  });

  it("nested middleware next functions return undefined when nested model is not included", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (typeof result === "undefined") return;

      if (params.model === "Post") {
        const returned = new Date();

        if (Array.isArray(result)) {
          return result.map((post) => ({ ...post, returned }));
        }

        return { ...result, returned };
      }

      return result;
    });

    const next = jest.fn(() =>
      Promise.resolve({
        id: faker.datatype.number(),
        email: params.args.data.email,
      })
    );
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
        posts: { create: { title: faker.lorem.sentence() } },
      },
    });
    const result = await nestedMiddleware(params, next);

    expect(result).toEqual({
      id: expect.any(Number),
      email: params.args.data.email,
    });
  });
});
