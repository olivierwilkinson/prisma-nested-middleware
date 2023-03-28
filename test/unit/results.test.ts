import faker from "faker";

import { createNestedMiddleware } from "../../src";
import { createParams } from "./helpers/createParams";
import { wait } from "./helpers/wait";

function addReturnedDate(result: any) {
  if (typeof result === "undefined") return;
  const returned = new Date();

  if (Array.isArray(result)) {
    return result.map((item) => ({ ...item, returned }));
  }

  return { ...result, returned };
}

describe("modifying results", () => {
  it("returns null successfully", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      return next(params);
    });

    const params = createParams("User", "findUnique", {
      where: { id: faker.datatype.number() },
    });
    const next = jest.fn(() => Promise.resolve(null));
    const result = await nestedMiddleware(params, next);

    expect(result).toBeNull();
  });

  it("returns count successfully", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      return next(params);
    });

    const params = createParams("User", "count", {});
    const next = jest.fn(() => Promise.resolve(1));
    const result = await nestedMiddleware(params, next);

    expect(result).toEqual(1);
  });

  it("returns correct result by default", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      return next(params);
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
    });
  });

  it("returns correct result when relations are included", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      return next(params);
    });

    const params = createParams("Post", "findMany", {
      where: { title: faker.lorem.sentence() },
      include: {
        author: { include: { profile: true, posts: true } },
        comments: { include: { author: true } },
      },
    });
    const clientResult = [
      {
        id: faker.datatype.number(),
        title: faker.lorem.sentence(),
        author: {
          id: faker.datatype.number(),
          email: faker.internet.email(),
          profile: null,
          posts: [
            {
              id: faker.datatype.number(),
              title: faker.lorem.sentence(),
              comments: [
                { id: faker.datatype.number(), content: faker.lorem.text() },
                { id: faker.datatype.number(), content: faker.lorem.text() },
                { id: faker.datatype.number(), content: faker.lorem.text() },
              ],
            },
            {
              id: faker.datatype.number(),
              title: faker.lorem.sentence(),
              comments: null,
            },
          ],
        },
        comments: [
          {
            id: faker.datatype.number(),
            content: faker.lorem.paragraph(),
            author: {
              id: faker.datatype.number(),
              email: faker.internet.email(),
            },
          },
          {
            id: faker.datatype.number(),
            content: faker.lorem.paragraph(),
            author: null,
          },
        ],
      },
      {
        id: faker.datatype.number(),
        title: faker.lorem.sentence(),
        author: null,
        comments: null,
      },
    ];
    const next = jest.fn(() => Promise.resolve(clientResult));
    const result = await nestedMiddleware(params, next);

    expect(result).toEqual(clientResult);
  });

  it("returns correct result when relations are selected", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      return next(params);
    });

    const params = createParams("Post", "findMany", {
      where: { title: faker.lorem.sentence() },
      select: {
        content: true,
        author: {
          select: {
            email: true,
            profile: { select: { bio: true } },
            posts: {
              select: {
                title: true,
                comments: {
                  select: { content: true },
                },
              },
            },
          },
        },
        comments: {
          select: { author: true },
        },
      },
    });

    const clientResult = [
      {
        title: faker.lorem.sentence(),
        author: {
          email: faker.internet.email(),
          profile: null,
          posts: [
            {
              title: faker.lorem.sentence(),
              comments: [
                { content: faker.lorem.text() },
                { content: faker.lorem.text() },
                { content: faker.lorem.text() },
              ],
            },
            { title: faker.lorem.sentence(), comments: null },
          ],
        },
        comments: [
          {
            author: {
              id: faker.datatype.number(),
              email: faker.internet.email(),
            },
          },
          { author: null },
        ],
      },
      {
        title: faker.lorem.sentence(),
        author: null,
        comments: null,
      },
    ];
    const next = jest.fn(() => Promise.resolve(clientResult));
    const result = await nestedMiddleware(params, next);

    expect(result).toEqual(clientResult);
  });

  it("returns correct result when relations are included and selected", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      return next(params);
    });

    const params = createParams("Post", "findMany", {
      where: { title: faker.lorem.sentence() },
      include: {
        author: {
          select: {
            email: true,
            profile: { select: { bio: true } },
            posts: {
              include: {
                comments: true,
              },
            },
          },
        },
        comments: {
          select: { author: true },
        },
      },
    });

    const clientResult = [
      {
        id: faker.datatype.number(),
        title: faker.lorem.sentence(),
        author: {
          email: faker.internet.email(),
          profile: null,
          posts: [
            {
              id: faker.datatype.number(),
              title: faker.lorem.sentence(),
              comments: [
                { content: faker.lorem.text() },
                { content: faker.lorem.text() },
                { content: faker.lorem.text() },
              ],
            },
            {
              id: faker.datatype.number(),
              title: faker.lorem.sentence(),
              comments: null,
            },
          ],
        },
        comments: [
          {
            id: faker.datatype.number(),
            content: faker.lorem.text(),
            author: {
              id: faker.datatype.number(),
              email: faker.internet.email(),
            },
          },
          {
            id: faker.datatype.number(),
            content: faker.lorem.text(),
            author: null,
          },
        ],
      },
      {
        id: faker.datatype.number(),
        title: faker.lorem.sentence(),
        author: null,
        comments: null,
      },
    ];
    const next = jest.fn(() => Promise.resolve(clientResult));
    const result = await nestedMiddleware(params, next);

    expect(result).toEqual(clientResult);
  });

  it("supports modifying root result", async () => {
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

  it("supports modifying root result asynchronously", async () => {
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

  it("supports modifying included results", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (!result) return;

      if (params.action === "include" && params.model === "Post") {
        return addReturnedDate(result);
      }

      return result;
    });

    const next = jest.fn((params) =>
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
      include: {
        posts: true,
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

  it("supports modifying included results asynchronously", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (!result) return;

      if (params.action === "include" && params.model === "Post") {
        await wait(100);
        return addReturnedDate(result);
      }

      return result;
    });

    const next = jest.fn((params) =>
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
      include: {
        posts: true,
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

  it("supports modifying selected results", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (!result) return;

      if (params.action === "select" && params.model === "Post") {
        return addReturnedDate(result);
      }

      return result;
    });

    const next = jest.fn((params) =>
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
      select: {
        posts: true,
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

  it("supports modifying selected results asynchronously", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (!result) return;

      if (params.action === "select" && params.model === "Post") {
        await wait(100);
        return addReturnedDate(result);
      }

      return result;
    });

    const next = jest.fn((params) =>
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
      select: {
        posts: true,
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

  it("supports modifying multiple included relations", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (!result || !params.model) return;

      if (
        params.action === "include" &&
        ["Post", "Profile"].includes(params.model)
      ) {
        return addReturnedDate(result);
      }

      return result;
    });

    const next = jest.fn(() =>
      Promise.resolve({
        id: faker.datatype.number(),
        email: faker.internet.email(),
        profile: {
          id: faker.datatype.number(),
          bio: faker.lorem.text(),
        },
        posts: [
          {
            id: faker.datatype.number(),
            title: faker.lorem.sentence(),
          },
          {
            id: faker.datatype.number(),
            title: faker.lorem.sentence(),
          },
        ],
      })
    );
    const params = createParams("User", "findUnique", {
      where: { id: faker.datatype.number() },
      include: {
        profile: true,
        posts: true,
      },
    });
    const result = await nestedMiddleware(params, next);

    expect(result).toEqual({
      id: expect.any(Number),
      email: expect.any(String),
      profile: {
        id: expect.any(Number),
        bio: expect.any(String),
        returned: expect.any(Date),
      },
      posts: [
        {
          id: expect.any(Number),
          title: expect.any(String),
          returned: expect.any(Date),
        },
        {
          id: expect.any(Number),
          title: expect.any(String),
          returned: expect.any(Date),
        },
      ],
    });
  });

  it("supports modifying multiple included relations asynchronously", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (!result || !params.model) return;

      if (
        params.action === "include" &&
        ["Post", "Profile"].includes(params.model)
      ) {
        await wait(100);
        return addReturnedDate(result);
      }

      return result;
    });

    const next = jest.fn(() =>
      Promise.resolve({
        id: faker.datatype.number(),
        email: faker.internet.email(),
        profile: {
          id: faker.datatype.number(),
          bio: faker.lorem.text(),
        },
        posts: [
          {
            id: faker.datatype.number(),
            title: faker.lorem.sentence(),
          },
          {
            id: faker.datatype.number(),
            title: faker.lorem.sentence(),
          },
        ],
      })
    );
    const params = createParams("User", "findUnique", {
      where: { id: faker.datatype.number() },
      include: {
        profile: true,
        posts: true,
      },
    });
    const result = await nestedMiddleware(params, next);

    expect(result).toEqual({
      id: expect.any(Number),
      email: expect.any(String),
      profile: {
        id: expect.any(Number),
        bio: expect.any(String),
        returned: expect.any(Date),
      },
      posts: [
        {
          id: expect.any(Number),
          title: expect.any(String),
          returned: expect.any(Date),
        },
        {
          id: expect.any(Number),
          title: expect.any(String),
          returned: expect.any(Date),
        },
      ],
    });
  });

  it("supports modifying multiple selected relations", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (!result || !params.model) return;

      if (
        params.action === "select" &&
        ["Post", "Profile"].includes(params.model)
      ) {
        return addReturnedDate(result);
      }

      return result;
    });

    const next = jest.fn(() =>
      Promise.resolve({
        id: faker.datatype.number(),
        email: faker.internet.email(),
        profile: {
          id: faker.datatype.number(),
          bio: faker.lorem.text(),
        },
        posts: [
          {
            id: faker.datatype.number(),
            title: faker.lorem.sentence(),
          },
          {
            id: faker.datatype.number(),
            title: faker.lorem.sentence(),
          },
        ],
      })
    );
    const params = createParams("User", "findUnique", {
      where: { id: faker.datatype.number() },
      select: {
        profile: true,
        posts: true,
      },
    });
    const result = await nestedMiddleware(params, next);

    expect(result).toEqual({
      id: expect.any(Number),
      email: expect.any(String),
      profile: {
        id: expect.any(Number),
        bio: expect.any(String),
        returned: expect.any(Date),
      },
      posts: [
        {
          id: expect.any(Number),
          title: expect.any(String),
          returned: expect.any(Date),
        },
        {
          id: expect.any(Number),
          title: expect.any(String),
          returned: expect.any(Date),
        },
      ],
    });
  });

  it("supports modifying multiple selected relations asynchronously", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (!result || !params.model) return;

      if (
        params.action === "select" &&
        ["Post", "Profile"].includes(params.model)
      ) {
        await wait(100);
        return addReturnedDate(result);
      }

      return result;
    });

    const next = jest.fn(() =>
      Promise.resolve({
        id: faker.datatype.number(),
        email: faker.internet.email(),
        profile: {
          id: faker.datatype.number(),
          bio: faker.lorem.text(),
        },
        posts: [
          {
            id: faker.datatype.number(),
            title: faker.lorem.sentence(),
          },
          {
            id: faker.datatype.number(),
            title: faker.lorem.sentence(),
          },
        ],
      })
    );
    const params = createParams("User", "findUnique", {
      where: { id: faker.datatype.number() },
      select: {
        profile: true,
        posts: true,
      },
    });
    const result = await nestedMiddleware(params, next);

    expect(result).toEqual({
      id: expect.any(Number),
      email: expect.any(String),
      profile: {
        id: expect.any(Number),
        bio: expect.any(String),
        returned: expect.any(Date),
      },
      posts: [
        {
          id: expect.any(Number),
          title: expect.any(String),
          returned: expect.any(Date),
        },
        {
          id: expect.any(Number),
          title: expect.any(String),
          returned: expect.any(Date),
        },
      ],
    });
  });

  it("supports modifying deeply included results", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (!result) return;

      if (params.action === "include" && params.model === "Comment") {
        return addReturnedDate(result);
      }

      return result;
    });

    const next = jest.fn((params) =>
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
                content: faker.lorem.sentence(),
                replies: [
                  {
                    id: faker.datatype.number(),
                    content: faker.lorem.sentence(),
                  },
                  {
                    id: faker.datatype.number(),
                    content: faker.lorem.sentence(),
                  },
                ],
              },
            ],
          },
        ],
      })
    );
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
        posts: { create: { title: faker.lorem.sentence() } },
      },
      include: {
        posts: {
          include: {
            comments: {
              include: {
                replies: true,
              },
            },
          },
        },
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
          comments: [
            {
              id: expect.any(Number),
              content: expect.any(String),
              returned: expect.any(Date),
              replies: [
                {
                  id: expect.any(Number),
                  content: expect.any(String),
                  returned: expect.any(Date),
                },
                {
                  id: expect.any(Number),
                  content: expect.any(String),
                  returned: expect.any(Date),
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("supports modifying deeply included results asynchronously", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (!result) return;

      if (params.action === "include" && params.model === "Comment") {
        await wait(100);
        return addReturnedDate(result);
      }

      return result;
    });

    const next = jest.fn((params) =>
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
                content: faker.lorem.sentence(),
                replies: [
                  {
                    id: faker.datatype.number(),
                    content: faker.lorem.sentence(),
                  },
                  {
                    id: faker.datatype.number(),
                    content: faker.lorem.sentence(),
                  },
                ],
              },
            ],
          },
        ],
      })
    );
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
        posts: { create: { title: faker.lorem.sentence() } },
      },
      include: {
        posts: {
          include: {
            comments: {
              include: {
                replies: true,
              },
            },
          },
        },
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
          comments: [
            {
              id: expect.any(Number),
              content: expect.any(String),
              returned: expect.any(Date),
              replies: [
                {
                  id: expect.any(Number),
                  content: expect.any(String),
                  returned: expect.any(Date),
                },
                {
                  id: expect.any(Number),
                  content: expect.any(String),
                  returned: expect.any(Date),
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("supports modifying deeply selected results", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (!result) return;

      if (params.action === "select" && params.model === "Comment") {
        return addReturnedDate(result);
      }

      return result;
    });

    const next = jest.fn((params) =>
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
                content: faker.lorem.sentence(),
                replies: [
                  {
                    id: faker.datatype.number(),
                    content: faker.lorem.sentence(),
                  },
                  {
                    id: faker.datatype.number(),
                    content: faker.lorem.sentence(),
                  },
                ],
              },
            ],
          },
        ],
      })
    );
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
        posts: { create: { title: faker.lorem.sentence() } },
      },
      include: {
        posts: {
          select: {
            comments: {
              select: {
                replies: true,
              },
            },
          },
        },
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
          comments: [
            {
              id: expect.any(Number),
              content: expect.any(String),
              returned: expect.any(Date),
              replies: [
                {
                  id: expect.any(Number),
                  content: expect.any(String),
                  returned: expect.any(Date),
                },
                {
                  id: expect.any(Number),
                  content: expect.any(String),
                  returned: expect.any(Date),
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("supports modifying deeply selected results asynchronously", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (!result) return;

      if (params.action === "select" && params.model === "Comment") {
        await wait(100);
        return addReturnedDate(result);
      }

      return result;
    });

    const next = jest.fn((params) =>
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
                content: faker.lorem.sentence(),
                replies: [
                  {
                    id: faker.datatype.number(),
                    content: faker.lorem.sentence(),
                  },
                  {
                    id: faker.datatype.number(),
                    content: faker.lorem.sentence(),
                  },
                ],
              },
            ],
          },
        ],
      })
    );
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
        posts: { create: { title: faker.lorem.sentence() } },
      },
      include: {
        posts: {
          select: {
            comments: {
              select: {
                replies: true,
              },
            },
          },
        },
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
          comments: [
            {
              id: expect.any(Number),
              content: expect.any(String),
              returned: expect.any(Date),
              replies: [
                {
                  id: expect.any(Number),
                  content: expect.any(String),
                  returned: expect.any(Date),
                },
                {
                  id: expect.any(Number),
                  content: expect.any(String),
                  returned: expect.any(Date),
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("supports modifying deeply included results through multiple relations", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (!result || !params.model) return;

      if (
        params.action === "include" &&
        ["Post", "Profile", "Comment"].includes(params.model)
      ) {
        return addReturnedDate(result);
      }

      return result;
    });

    const next = jest.fn(() =>
      Promise.resolve({
        id: faker.datatype.number(),
        email: faker.internet.email(),
        profile: {
          id: faker.datatype.number(),
          bio: faker.lorem.text(),
          user: {
            id: faker.datatype.number(),
            email: faker.internet.email(),
            comments: [
              {
                id: faker.datatype.number(),
                content: faker.lorem.sentence(),
              },
              {
                id: faker.datatype.number(),
                content: faker.lorem.sentence(),
              },
            ],
          },
        },
        posts: [
          {
            id: faker.datatype.number(),
            title: faker.lorem.sentence(),
            comments: [
              {
                id: faker.datatype.number(),
                content: faker.lorem.sentence(),
                replies: [
                  {
                    id: faker.datatype.number(),
                    content: faker.lorem.sentence(),
                  },
                  {
                    id: faker.datatype.number(),
                    content: faker.lorem.sentence(),
                  },
                ],
              },
            ],
          },
        ],
      })
    );
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
        posts: { create: { title: faker.lorem.sentence() } },
      },
      include: {
        profile: {
          include: {
            user: {
              include: {
                comments: true,
              },
            },
          },
        },
        posts: {
          include: {
            comments: {
              include: {
                replies: true,
              },
            },
          },
        },
      },
    });
    const result = await nestedMiddleware(params, next);

    expect(result).toEqual({
      id: expect.any(Number),
      email: expect.any(String),
      profile: {
        id: expect.any(Number),
        bio: expect.any(String),
        returned: expect.any(Date),
        user: {
          id: expect.any(Number),
          email: expect.any(String),
          comments: [
            {
              id: expect.any(Number),
              content: expect.any(String),
              returned: expect.any(Date),
            },
            {
              id: expect.any(Number),
              content: expect.any(String),
              returned: expect.any(Date),
            },
          ],
        },
      },
      posts: [
        {
          id: expect.any(Number),
          title: expect.any(String),
          returned: expect.any(Date),
          comments: [
            {
              id: expect.any(Number),
              content: expect.any(String),
              returned: expect.any(Date),
              replies: [
                {
                  id: expect.any(Number),
                  content: expect.any(String),
                  returned: expect.any(Date),
                },
                {
                  id: expect.any(Number),
                  content: expect.any(String),
                  returned: expect.any(Date),
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("supports modifying deeply included results through multiple relations asynchronously", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (!result || !params.model) return;

      if (
        params.action === "include" &&
        ["Post", "Profile", "Comment"].includes(params.model)
      ) {
        await wait(100);
        return addReturnedDate(result);
      }

      return result;
    });

    const next = jest.fn(() =>
      Promise.resolve({
        id: faker.datatype.number(),
        email: faker.internet.email(),
        profile: {
          id: faker.datatype.number(),
          bio: faker.lorem.text(),
          user: {
            id: faker.datatype.number(),
            email: faker.internet.email(),
            comments: [
              {
                id: faker.datatype.number(),
                content: faker.lorem.sentence(),
              },
              {
                id: faker.datatype.number(),
                content: faker.lorem.sentence(),
              },
            ],
          },
        },
        posts: [
          {
            id: faker.datatype.number(),
            title: faker.lorem.sentence(),
            comments: [
              {
                id: faker.datatype.number(),
                content: faker.lorem.sentence(),
                replies: [
                  {
                    id: faker.datatype.number(),
                    content: faker.lorem.sentence(),
                  },
                  {
                    id: faker.datatype.number(),
                    content: faker.lorem.sentence(),
                  },
                ],
              },
            ],
          },
        ],
      })
    );
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
        posts: { create: { title: faker.lorem.sentence() } },
      },
      include: {
        profile: {
          include: {
            user: {
              include: {
                comments: true,
              },
            },
          },
        },
        posts: {
          include: {
            comments: {
              include: {
                replies: true,
              },
            },
          },
        },
      },
    });
    const result = await nestedMiddleware(params, next);

    expect(result).toEqual({
      id: expect.any(Number),
      email: expect.any(String),
      profile: {
        id: expect.any(Number),
        bio: expect.any(String),
        returned: expect.any(Date),
        user: {
          id: expect.any(Number),
          email: expect.any(String),
          comments: [
            {
              id: expect.any(Number),
              content: expect.any(String),
              returned: expect.any(Date),
            },
            {
              id: expect.any(Number),
              content: expect.any(String),
              returned: expect.any(Date),
            },
          ],
        },
      },
      posts: [
        {
          id: expect.any(Number),
          title: expect.any(String),
          returned: expect.any(Date),
          comments: [
            {
              id: expect.any(Number),
              content: expect.any(String),
              returned: expect.any(Date),
              replies: [
                {
                  id: expect.any(Number),
                  content: expect.any(String),
                  returned: expect.any(Date),
                },
                {
                  id: expect.any(Number),
                  content: expect.any(String),
                  returned: expect.any(Date),
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("supports modifying deeply selected results through multiple relations", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (!result || !params.model) return;

      if (
        params.action === "select" &&
        ["Post", "Profile", "Comment"].includes(params.model)
      ) {
        return addReturnedDate(result);
      }

      return result;
    });

    const next = jest.fn(() =>
      Promise.resolve({
        id: faker.datatype.number(),
        email: faker.internet.email(),
        profile: {
          id: faker.datatype.number(),
          bio: faker.lorem.text(),
          user: {
            id: faker.datatype.number(),
            email: faker.internet.email(),
            comments: [
              {
                id: faker.datatype.number(),
                content: faker.lorem.sentence(),
              },
              {
                id: faker.datatype.number(),
                content: faker.lorem.sentence(),
              },
            ],
          },
        },
        posts: [
          {
            id: faker.datatype.number(),
            title: faker.lorem.sentence(),
            comments: [
              {
                id: faker.datatype.number(),
                content: faker.lorem.sentence(),
                replies: [
                  {
                    id: faker.datatype.number(),
                    content: faker.lorem.sentence(),
                  },
                  {
                    id: faker.datatype.number(),
                    content: faker.lorem.sentence(),
                  },
                ],
              },
            ],
          },
        ],
      })
    );
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
        posts: { create: { title: faker.lorem.sentence() } },
      },
      select: {
        profile: {
          select: {
            user: {
              select: {
                comments: true,
              },
            },
          },
        },
        posts: {
          select: {
            comments: {
              select: {
                replies: true,
              },
            },
          },
        },
      },
    });
    const result = await nestedMiddleware(params, next);

    expect(result).toEqual({
      id: expect.any(Number),
      email: expect.any(String),
      profile: {
        id: expect.any(Number),
        bio: expect.any(String),
        returned: expect.any(Date),
        user: {
          id: expect.any(Number),
          email: expect.any(String),
          comments: [
            {
              id: expect.any(Number),
              content: expect.any(String),
              returned: expect.any(Date),
            },
            {
              id: expect.any(Number),
              content: expect.any(String),
              returned: expect.any(Date),
            },
          ],
        },
      },
      posts: [
        {
          id: expect.any(Number),
          title: expect.any(String),
          returned: expect.any(Date),
          comments: [
            {
              id: expect.any(Number),
              content: expect.any(String),
              returned: expect.any(Date),
              replies: [
                {
                  id: expect.any(Number),
                  content: expect.any(String),
                  returned: expect.any(Date),
                },
                {
                  id: expect.any(Number),
                  content: expect.any(String),
                  returned: expect.any(Date),
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("supports modifying deeply selected results through multiple relations asynchronously", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (!result || !params.model) return;

      if (
        params.action === "select" &&
        ["Post", "Profile", "Comment"].includes(params.model)
      ) {
        await wait(100);
        return addReturnedDate(result);
      }

      return result;
    });

    const next = jest.fn(() =>
      Promise.resolve({
        id: faker.datatype.number(),
        email: faker.internet.email(),
        profile: {
          id: faker.datatype.number(),
          bio: faker.lorem.text(),
          user: {
            id: faker.datatype.number(),
            email: faker.internet.email(),
            comments: [
              {
                id: faker.datatype.number(),
                content: faker.lorem.sentence(),
              },
              {
                id: faker.datatype.number(),
                content: faker.lorem.sentence(),
              },
            ],
          },
        },
        posts: [
          {
            id: faker.datatype.number(),
            title: faker.lorem.sentence(),
            comments: [
              {
                id: faker.datatype.number(),
                content: faker.lorem.sentence(),
                replies: [
                  {
                    id: faker.datatype.number(),
                    content: faker.lorem.sentence(),
                  },
                  {
                    id: faker.datatype.number(),
                    content: faker.lorem.sentence(),
                  },
                ],
              },
            ],
          },
        ],
      })
    );
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
        posts: { create: { title: faker.lorem.sentence() } },
      },
      select: {
        profile: {
          select: {
            user: {
              select: {
                comments: true,
              },
            },
          },
        },
        posts: {
          select: {
            comments: {
              select: {
                replies: true,
              },
            },
          },
        },
      },
    });
    const result = await nestedMiddleware(params, next);

    expect(result).toEqual({
      id: expect.any(Number),
      email: expect.any(String),
      profile: {
        id: expect.any(Number),
        bio: expect.any(String),
        returned: expect.any(Date),
        user: {
          id: expect.any(Number),
          email: expect.any(String),
          comments: [
            {
              id: expect.any(Number),
              content: expect.any(String),
              returned: expect.any(Date),
            },
            {
              id: expect.any(Number),
              content: expect.any(String),
              returned: expect.any(Date),
            },
          ],
        },
      },
      posts: [
        {
          id: expect.any(Number),
          title: expect.any(String),
          returned: expect.any(Date),
          comments: [
            {
              id: expect.any(Number),
              content: expect.any(String),
              returned: expect.any(Date),
              replies: [
                {
                  id: expect.any(Number),
                  content: expect.any(String),
                  returned: expect.any(Date),
                },
                {
                  id: expect.any(Number),
                  content: expect.any(String),
                  returned: expect.any(Date),
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("supports modifying selected results in nested include", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (!result) return;

      if (params.action === "select" && params.model === "Comment") {
        return addReturnedDate(result);
      }

      return result;
    });

    const next = jest.fn((params) =>
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
                content: faker.lorem.sentence(),
              },
            ],
          },
        ],
      })
    );
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
        posts: { create: { title: faker.lorem.sentence() } },
      },
      include: {
        posts: {
          select: {
            comments: true,
          },
        },
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
          comments: [
            {
              id: expect.any(Number),
              content: expect.any(String),
              returned: expect.any(Date),
            },
          ],
        },
      ],
    });
  });

  it("supports modifying selected results in nested include asynchronously", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (!result) return;

      if (params.action === "select" && params.model === "Comment") {
        return addReturnedDate(result);
      }

      return result;
    });

    const next = jest.fn((params) =>
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
                content: faker.lorem.sentence(),
              },
            ],
          },
        ],
      })
    );
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
        posts: { create: { title: faker.lorem.sentence() } },
      },
      include: {
        posts: {
          select: {
            comments: true,
          },
        },
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
          comments: [
            {
              id: expect.any(Number),
              content: expect.any(String),
              returned: expect.any(Date),
            },
          ],
        },
      ],
    });
  });

  it("supports modifying deeply included results in nested select", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (!result) return;

      if (params.action === "include" && params.model === "Comment") {
        return addReturnedDate(result);
      }

      return result;
    });

    const next = jest.fn((params) =>
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
                content: faker.lorem.sentence(),
                replies: [
                  {
                    id: faker.datatype.number(),
                    content: faker.lorem.sentence(),
                  },
                ],
              },
            ],
          },
        ],
      })
    );
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
        posts: { create: { title: faker.lorem.sentence() } },
      },
      include: {
        posts: {
          select: {
            comments: {
              include: {
                replies: true,
              },
            },
          },
        },
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
          comments: [
            {
              id: expect.any(Number),
              content: expect.any(String),
              replies: [
                {
                  id: expect.any(Number),
                  content: expect.any(String),
                  returned: expect.any(Date),
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("supports modifying deeply included results in nested select asynchronously", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (!result) return;

      if (params.action === "include" && params.model === "Comment") {
        await wait(100);
        return addReturnedDate(result);
      }

      return result;
    });

    const next = jest.fn((params) =>
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
                content: faker.lorem.sentence(),
                replies: [
                  {
                    id: faker.datatype.number(),
                    content: faker.lorem.sentence(),
                  },
                ],
              },
            ],
          },
        ],
      })
    );
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
        posts: { create: { title: faker.lorem.sentence() } },
      },
      include: {
        posts: {
          select: {
            comments: {
              include: {
                replies: true,
              },
            },
          },
        },
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
          comments: [
            {
              id: expect.any(Number),
              content: expect.any(String),
              replies: [
                {
                  id: expect.any(Number),
                  content: expect.any(String),
                  returned: expect.any(Date),
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("supports filtering nested toOne relations", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      if (params.model === "User" && !params.scope?.relations.to.isList) {
        await next(params);
        return null;
      }
      return next(params);
    });

    const params = createParams("Post", "findFirst", {
      where: { id: faker.datatype.number() },
      include: { author: true },
    });

    const next = jest.fn(() =>
      Promise.resolve({
        id: faker.datatype.number(),
        title: faker.lorem.sentence(),
        author: {
          id: faker.datatype.number(),
          email: faker.internet.email(),
        },
      })
    );

    const result = await nestedMiddleware(params, next);

    expect(result).toEqual({
      id: expect.any(Number),
      title: expect.any(String),
      author: null,
    });
  });

  it("supports filtering nested toOne relations in list results", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      if (params.model === "User" && !params.scope?.relations.to.isList) {
        const results = await next(params);
        return results.filter((result: any) => !result?.deleted);
      }
      return next(params);
    });

    const params = createParams("Post", "findMany", {
      where: { id: faker.datatype.number() },
      include: { author: true },
    });

    const next = jest.fn(() =>
      Promise.resolve([
        {
          id: faker.datatype.number(),
          title: faker.lorem.sentence(),
          author: {
            id: faker.datatype.number(),
            email: faker.internet.email(),
            deleted: true,
          },
        },
        {
          id: faker.datatype.number(),
          title: faker.lorem.sentence(),
          author: {
            id: faker.datatype.number(),
            email: faker.internet.email(),
          },
        },
        {
          id: faker.datatype.number(),
          title: faker.lorem.sentence(),
          author: null,
        },
      ])
    );

    const result = await nestedMiddleware(params, next);

    expect(result).toEqual([
      {
        id: expect.any(Number),
        title: expect.any(String),
        author: null,
      },
      {
        id: expect.any(Number),
        title: expect.any(String),
        author: {
          id: expect.any(Number),
          email: expect.any(String),
        },
      },
      {
        id: expect.any(Number),
        title: expect.any(String),
        author: null,
      },
    ]);
  });

  it("supports filtering nested toOne relations nested in toOne result", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      if (params.model === "Profile") {
        await next(params);
        return [];
      }
      return next(params);
    });

    const params = createParams("Post", "findMany", {
      where: { id: faker.datatype.number() },
      include: {
        author: {
          include: { profile: true },
        },
      },
    });

    const next = jest.fn(() =>
      Promise.resolve([
        {
          id: faker.datatype.number(),
          title: faker.lorem.sentence(),
          author: {
            id: faker.datatype.number(),
            email: faker.internet.email(),
            profile: {
              id: faker.datatype.number(),
              bio: faker.lorem.paragraph(),
            },
          },
        },
      ])
    );

    const result = await nestedMiddleware(params, next);

    expect(result).toEqual([
      {
        id: expect.any(Number),
        title: expect.any(String),
        author: {
          id: expect.any(Number),
          email: expect.any(String),
          profile: null,
        },
      },
    ]);
  });

  it("supports filtering nested toOne relations nested in toMany results", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      if (params.model === "User" && !params.scope?.relations.to.isList) {
        await next(params);
        return [];
      }
      return next(params);
    });

    const params = createParams("Post", "findUnique", {
      where: { id: faker.datatype.number() },
      include: {
        comments: {
          include: { author: true },
        },
      },
    });

    const next = jest.fn(() =>
      Promise.resolve({
        id: faker.datatype.number(),
        title: faker.lorem.sentence(),
        comments: [
          {
            id: faker.datatype.number(),
            content: faker.lorem.paragraph(),
            author: {
              id: faker.datatype.number(),
              email: faker.internet.email(),
            },
          },
          {
            id: faker.datatype.number(),
            content: faker.lorem.paragraph(),
            author: {
              id: faker.datatype.number(),
              email: faker.internet.email(),
            },
          },
        ],
      })
    );

    const result = await nestedMiddleware(params, next);

    expect(result).toEqual({
      id: expect.any(Number),
      title: expect.any(String),
      comments: [
        {
          id: expect.any(Number),
          content: expect.any(String),
          author: null,
        },
        {
          id: expect.any(Number),
          content: expect.any(String),
          author: null,
        },
      ],
    });
  });

  it("supports filtering nested toOne result with nested results", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      if (params.model === "User" && !params.scope?.relations.to.isList) {
        const result = await next(params);
        if (result.deleted) {
          return null;
        }
        return result;
      }
      return next(params);
    });

    const params = createParams("Post", "update", {
      where: { id: 1 },
      data: { content: "foo" },
      include: {
        author: {
          include: {
            comments: true,
            profile: true,
          },
        },
      },
    });

    const next = jest.fn(() =>
      Promise.resolve({
        author: {
          deleted: true,
          comments: [],
          profile: {
            id: 1,
            bio: "foo",
          },
        },
      })
    );
    const result = await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith(params);
    expect(result).toEqual({ author: null });
  });

  it("supports filtering nested toMany results", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      if (params.model === "Comment" && params.scope?.relations.to.isList) {
        const result = await next(params);
        return result.filter((item: any) => !item.deleted);
      }
      return next(params);
    });

    const params = createParams("Post", "update", {
      where: { id: 1 },
      data: { content: "foo" },
      include: {
        comments: true,
      },
    });

    const next = jest.fn(() =>
      Promise.resolve({
        comments: [
          { deleted: true, id: 1, content: "foo" },
          { id: 2, content: "bar" },
        ],
      })
    );
    const result = await nestedMiddleware(params, next);

    expect(result).toEqual({
      comments: [{ id: 2, content: "bar" }],
    });
  });

  it("supports filtering nested toMany results in list results", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      if (params.model === "Comment" && params.scope?.relations.to.isList) {
        const result = await next(params);
        return result.filter((item: any) => !item.deleted);
      }
      return next(params);
    });

    const params = createParams("Post", "findMany", {
      where: { id: 1 },
      include: {
        comments: true,
      },
    });

    const next = jest.fn(() =>
      Promise.resolve([
        {
          id: 1,
          comments: [
            { deleted: true, id: 3, content: "foo" },
            { id: 4, content: "bar" },
          ],
        },
        {
          id: 2,
          comments: [
            { deleted: true, id: 5, content: "baz" },
            { id: 6, content: "qux" },
          ],
        },
      ])
    );
    const result = await nestedMiddleware(params, next);

    expect(result).toEqual([
      { id: 1, comments: [{ id: 4, content: "bar" }] },
      { id: 2, comments: [{ id: 6, content: "qux" }] },
    ]);
  });

  it("supports filtering nested toMany results in nested toOne result", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      if (params.scope && params.model === "Comment") {
        const result = await next(params);
        return result.filter((item: any) => !item.deleted);
      }
      return next(params);
    });

    const params = createParams("Comment", "findUnique", {
      where: { id: 1 },
      include: {
        author: {
          include: {
            comments: true,
          },
        },
      },
    });

    const next = jest.fn(() =>
      Promise.resolve({
        id: 1,
        content: "foo",
        author: {
          id: 2,
          comments: [
            { id: 3, content: "bar" },
            { deleted: true, id: 1, content: "baz" },
          ],
        },
      })
    );
    const result = await nestedMiddleware(params, next);

    expect(result).toEqual({
      id: 1,
      content: "foo",
      author: {
        id: 2,
        comments: [{ id: 3, content: "bar" }],
      },
    });
  });

  it("supports filtering nested toMany results in nested toMany result", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      if (params.scope && params.model === "Comment") {
        const result = await next(params);
        return result.filter((item: any) => !item.deleted);
      }
      return next(params);
    });

    const params = createParams("Post", "findUnique", {
      where: { id: 1 },
      include: {
        comments: {
          include: {
            replies: true,
          },
        },
      },
    });

    const next = jest.fn(() =>
      Promise.resolve({
        id: 1,
        content: "foo",
        comments: [
          {
            id: 2,
            content: "bar",
            replies: [
              { id: 3, content: "baz" },
              { deleted: true, id: 4, content: "qux" },
            ],
          },
          {
            id: 5,
            content: "quux",
            replies: [
              { id: 6, content: "corge" },
              { deleted: true, id: 7, content: "grault" },
            ],
          },
        ],
      })
    );

    const result = await nestedMiddleware(params, next);

    expect(result).toEqual({
      id: 1,
      content: "foo",
      comments: [
        {
          id: 2,
          content: "bar",
          replies: [{ id: 3, content: "baz" }],
        },
        {
          id: 5,
          content: "quux",
          replies: [{ id: 6, content: "corge" }],
        },
      ],
    });
  });

  it("supports filtering nested toMany results with nested results", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      if (params.model === "Comment" && params.scope?.relations.to.isList) {
        const result = await next(params);
        return result.filter((item: any) => !item.deleted);
      }
      return next(params);
    });

    const params = createParams("Post", "findUnique", {
      where: { id: 1 },
      include: {
        comments: {
          include: {
            author: true,
            replies: true,
          },
        },
      },
    });

    const next = jest.fn(() =>
      Promise.resolve({
        id: 1,
        comments: [
          {
            deleted: true,
            id: 2,
            content: "foo",
            author: { id: 3, email: "test@test.com" },
            replies: [
              { id: 4, content: "bar" },
              { id: 5, content: "baz" },
            ],
          },
          {
            id: 6,
            content: "qux",
            author: { id: 7, email: "test2@test.com" },
            replies: [],
          },
        ],
      })
    );

    const result = await nestedMiddleware(params, next);

    expect(result).toEqual({
      id: 1,
      comments: [
        {
          id: 6,
          content: "qux",
          author: { id: 7, email: "test2@test.com" },
          replies: [],
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
        return addReturnedDate(result);
      }
      if (params.model === "Profile") {
        await wait(200);
        return addReturnedDate(result);
      }
      await wait(300);
      return addReturnedDate(result);
    });

    const params = createParams("User", "findFirst", {
      where: { id: 1 },
      include: {
        posts: true,
        profile: true,
      },
    });
    const next = jest.fn(() =>
      Promise.resolve({
        id: faker.datatype.number(),
        email: faker.internet.email(),
        posts: [
          {
            id: faker.datatype.number(),
            title: faker.lorem.sentence(),
          },
        ],
        profile: {
          id: faker.datatype.number(),
          bio: faker.lorem.sentence(),
        },
      })
    );
    const result = await nestedMiddleware(params, next);

    expect(result).toEqual({
      id: expect.any(Number),
      email: expect.any(String),
      returned: expect.any(Date),
      posts: [
        {
          id: expect.any(Number),
          title: expect.any(String),
          returned: expect.any(Date),
        },
      ],
      profile: {
        id: expect.any(Number),
        bio: expect.any(String),
        returned: expect.any(Date),
      },
    });
  });
});
