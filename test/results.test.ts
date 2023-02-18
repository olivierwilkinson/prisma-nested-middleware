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

describe("modifying results", () => {
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

  it("allows middleware to modify included results through include action", async () => {
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

  it("allows middleware to modify deeply included results through include action", async () => {
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

  it("allows middleware to modify selected results through select action", async () => {
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

  it("allows middleware to modify deeply selected results through select action", async () => {
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

  it("allows middleware to modify selected in nested include through select action", async () => {
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

  it("allows middleware to modify deeply included results in nested select through include action", async () => {
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

  it("allows middleware to modify results within nested results", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (typeof result === "undefined") return;

      if (params.model === "Profile") {
        return addReturnedDate(result);
      }

      // modify profile first to check it is not overwritten by other calls
      await wait(100);
      return addReturnedDate(result);
    });

    const params = createParams("Post", "create", {
      data: {
        title: faker.lorem.sentence(),
        author: {
          create: {
            email: faker.internet.email(),
            profile: {
              create: { bio: faker.lorem.sentence() },
            },
          },
        },
      },
    });
    const next = jest.fn(() =>
      Promise.resolve({
        id: faker.datatype.number(),
        title: params.args.data.title,
        author: {
          id: faker.datatype.number(),
          email: params.args.data.author.create.email,
          profile: {
            id: faker.datatype.number(),
            bio: params.args.data.author.create.profile.create.bio,
          },
        },
      })
    );
    const result = await nestedMiddleware(params, next);

    expect(result).toEqual({
      id: expect.any(Number),
      title: params.args.data.title,
      returned: expect.any(Date),
      author: {
        id: expect.any(Number),
        email: params.args.data.author.create.email,
        returned: expect.any(Date),
        profile: {
          id: expect.any(Number),
          bio: params.args.data.author.create.profile.create.bio,
          returned: expect.any(Date),
        },
      },
    });
  });

  it("allows middleware to modify results within nested list results", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (typeof result === "undefined") return;

      if (params.model === "User") {
        return addReturnedDate(result);
      }

      // modify author first to check it is not overwritten by other calls
      await wait(100);
      return addReturnedDate(result);
    });

    const params = createParams("Post", "create", {
      data: {
        title: faker.lorem.sentence(),
        authorId: faker.datatype.number(),
        comments: {
          create: {
            content: faker.lorem.sentence(),
            author: {
              create: {
                email: faker.internet.email(),
              },
            },
          },
        },
      },
    });
    const next = jest.fn(() =>
      Promise.resolve({
        id: faker.datatype.number(),
        title: params.args.data.title,
        authorId: params.args.data.authorId,
        comments: [
          {
            id: faker.datatype.number(),
            content: params.args.data.comments.create.content,
            author: {
              id: faker.datatype.number(),
              email: params.args.data.comments.create.author.create.email,
            },
          },
        ],
      })
    );
    const result = await nestedMiddleware(params, next);

    expect(result).toEqual({
      id: expect.any(Number),
      title: params.args.data.title,
      authorId: params.args.data.authorId,
      returned: expect.any(Date),
      comments: [
        {
          id: expect.any(Number),
          content: params.args.data.comments.create.content,
          returned: expect.any(Date),
          author: {
            id: expect.any(Number),
            email: params.args.data.comments.create.author.create.email,
            returned: expect.any(Date),
          },
        },
      ],
    });
  });

  it("allows middleware to modify results within doubly nested list results", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (typeof result === "undefined") return;

      if (params.model === "User") {
        return addReturnedDate(result);
      }

      // modify author first to check it is not overwritten by other calls
      await wait(100);
      return addReturnedDate(result);
    });

    const params = createParams("Post", "create", {
      data: {
        title: faker.lorem.sentence(),
        authorId: faker.datatype.number(),
        comments: {
          create: {
            content: faker.lorem.sentence(),
            authorId: faker.datatype.number(),
            replies: {
              create: {
                content: faker.lorem.sentence(),
                author: {
                  create: {
                    email: faker.internet.email(),
                  },
                },
              },
            },
          },
        },
      },
    });
    const next = jest.fn(() =>
      Promise.resolve({
        id: faker.datatype.number(),
        title: params.args.data.title,
        authorId: params.args.data.authorId,
        comments: [
          {
            id: faker.datatype.number(),
            content: params.args.data.comments.create.content,
            authorId: params.args.data.comments.create.authorId,
            replies: [
              {
                id: faker.datatype.number(),
                content:
                  params.args.data.comments.create.replies.create.content,
                author: {
                  id: faker.datatype.number(),
                  email:
                    params.args.data.comments.create.replies.create.author
                      .create.email,
                },
              },
            ],
          },
        ],
      })
    );
    const result = await nestedMiddleware(params, next);

    expect(result).toEqual({
      id: expect.any(Number),
      title: params.args.data.title,
      authorId: params.args.data.authorId,
      returned: expect.any(Date),
      comments: [
        {
          id: expect.any(Number),
          content: params.args.data.comments.create.content,
          authorId: params.args.data.comments.create.authorId,
          returned: expect.any(Date),
          replies: [
            {
              id: expect.any(Number),
              content: params.args.data.comments.create.replies.create.content,
              returned: expect.any(Date),
              author: {
                id: expect.any(Number),
                email:
                  params.args.data.comments.create.replies.create.author.create
                    .email,
                returned: expect.any(Date),
              },
            },
          ],
        },
      ],
    });
  });

  it("allows middleware to modify list results within nested results", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (typeof result === "undefined") return;

      if (params.model === "Post") {
        return addReturnedDate(result);
      }

      // modify posts first to check they are not overwritten by other calls
      await wait(100);
      return addReturnedDate(result);
    });

    const params = createParams("Profile", "create", {
      data: {
        bio: faker.lorem.sentence(),
        user: {
          create: {
            email: faker.internet.email(),
            posts: {
              create: {
                title: faker.lorem.sentence(),
              },
            },
          },
        },
      },
    });
    const next = jest.fn(() =>
      Promise.resolve({
        id: faker.datatype.number(),
        bio: params.args.data.bio,
        user: {
          id: faker.datatype.number(),
          email: params.args.data.user.create.email,
          posts: [
            {
              id: faker.datatype.number(),
              title: params.args.data.user.create.posts.create.title,
            },
          ],
        },
      })
    );
    const result = await nestedMiddleware(params, next);

    expect(result).toEqual({
      id: expect.any(Number),
      bio: params.args.data.bio,
      returned: expect.any(Date),
      user: {
        id: expect.any(Number),
        email: params.args.data.user.create.email,
        returned: expect.any(Date),
        posts: [
          {
            id: expect.any(Number),
            title: params.args.data.user.create.posts.create.title,
            returned: expect.any(Date),
          },
        ],
      },
    });
  });

  it("allows middleware to modify list results within nested list results", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      const result = await next(params);
      if (typeof result === "undefined") return;

      if (params.model === "Comment") {
        return addReturnedDate(result);
      }

      // modify comments first to check they are not overwritten by other calls
      await wait(100);
      return addReturnedDate(result);
    });

    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
        posts: {
          create: {
            title: faker.lorem.sentence(),
            comments: {
              create: [
                {
                  content: faker.lorem.sentence(),
                  authorId: faker.datatype.number(),
                },
                {
                  content: faker.lorem.sentence(),
                  authorId: faker.datatype.number(),
                },
              ],
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
            comments: params.args.data.posts.create.comments.create,
          },
        ],
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
          comments: params.args.data.posts.create.comments.create.map(
            (comment: any) => ({
              ...comment,
              returned: expect.any(Date),
            })
          ),
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
