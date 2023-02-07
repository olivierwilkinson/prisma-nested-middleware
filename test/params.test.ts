import faker from "faker";

import { createNestedMiddleware } from "../src";
import { createParams } from "./utils/createParams";
import { wait } from "./utils/wait";

describe("params", () => {
  it("allows middleware to modify root params", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      return next({
        ...params,
        args: {
          ...params.args,
          data: {
            ...params.args.data,
            name: params.args.data.name || "Default Name",
          },
        },
      });
    });

    const next = jest.fn((params: any) => params);
    const params = createParams("User", "create", {
      data: { email: faker.internet.email() },
    });
    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith({
      ...params,
      args: {
        ...params.args,
        data: {
          ...params.args.data,
          name: "Default Name",
        },
      },
    });
  });

  it("allows middleware to modify root params asynchronously", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      return next({
        ...params,
        args: {
          ...params.args,
          data: {
            ...params.args.data,
            name: params.args.data.name || "Default Name",
          },
        },
      });
    });

    const next = jest.fn((params: any) => params);
    const params = createParams("User", "create", {
      data: { email: faker.internet.email() },
    });
    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith({
      ...params,
      args: {
        ...params.args,
        data: {
          ...params.args.data,
          name: "Default Name",
        },
      },
    });
  });

  it("allows middleware to modify nested params", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.model === "Post") {
        return next({
          ...params,
          args: {
            data: {
              ...params.args.data,
              number: faker.datatype.number(),
            },
          },
        });
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
    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith({
      ...params,
      args: {
        ...params.args,
        data: {
          ...params.args.data,
          posts: {
            create: {
              title: params.args.data.posts.create.title,
              number: expect.any(Number),
            },
          },
        },
      },
    });
  });

  it("allows middleware to modify nested params asynchronously", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      if (params.model === "Post") {
        await wait(100);
        return next({
          ...params,
          args: {
            data: {
              ...params.args.data,
              number: faker.datatype.number(),
            },
          },
        });
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
    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith({
      ...params,
      args: {
        ...params.args,
        data: {
          ...params.args.data,
          posts: {
            create: {
              title: params.args.data.posts.create.title,
              number: expect.any(Number),
            },
          },
        },
      },
    });
  });

  it("allows middleware to modify nested create list params", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.model === "Post") {
        return next({
          ...params,
          args: {
            data: {
              ...params.args.data,
              number: params.args.data.title === "first" ? 1 : 2,
            },
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((params: any) => params);
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
        posts: {
          create: [{ title: "first" }, { title: "second" }],
        },
      },
    });
    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith({
      ...params,
      args: {
        ...params.args,
        data: {
          ...params.args.data,
          posts: {
            create: [
              { title: "first", number: 1 },
              { title: "second", number: 2 },
            ],
          },
        },
      },
    });
  });

  it("allows middleware to modify nested update list params", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.model === "Post") {
        return next({
          ...params,
          args: {
            ...params.args,
            data: {
              ...params.args.data,
              number: params.args.data.title === "first" ? 1 : 2,
            },
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((params: any) => params);
    const params = createParams("User", "update", {
      where: { id: faker.datatype.number() },
      data: {
        email: faker.internet.email(),
        posts: {
          update: [
            {
              where: { id: faker.datatype.number() },
              data: { title: "first" },
            },
            {
              where: { id: faker.datatype.number() },
              data: { title: "second" },
            },
          ],
        },
      },
    });
    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith({
      ...params,
      args: {
        ...params.args,
        data: {
          ...params.args.data,
          posts: {
            update: [
              {
                where: params.args.data.posts.update[0].where,
                data: { title: "first", number: 1 },
              },
              {
                where: params.args.data.posts.update[1].where,
                data: { title: "second", number: 2 },
              },
            ],
          },
        },
      },
    });
  });

  it("allows middleware to modify nested delete list params", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.action === "delete" && params.model === "Post") {
        return next({
          ...params,
          args: { id: params.args.id + 1 },
        });
      }
      return next(params);
    });

    const next = jest.fn((params: any) => params);
    const params = createParams("User", "update", {
      where: { id: faker.datatype.number() },
      data: {
        email: faker.internet.email(),
        posts: {
          delete: [{ id: 1 }, { id: 2 }],
        },
      },
    });
    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith({
      ...params,
      args: {
        ...params.args,
        data: {
          ...params.args.data,
          posts: {
            delete: [{ id: 2 }, { id: 3 }],
          },
        },
      },
    });
  });

  it("allows middleware to modify params of operations nested in list", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.action === "create" && params.model === "Comment") {
        return next({
          ...params,
          args: {
            data: {
              ...params.args.data,
              number: params.args.data.content === "first post comment" ? 1 : 2,
            },
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((params: any) => params);
    const params = createParams("User", "update", {
      where: { id: faker.datatype.number() },
      data: {
        email: faker.internet.email(),
        posts: {
          update: [
            {
              where: { id: faker.datatype.number() },
              data: {
                title: "first",
                comments: {
                  create: {
                    content: "first post comment",
                    authorId: faker.datatype.number(),
                  },
                },
              },
            },
            {
              where: { id: faker.datatype.number() },
              data: {
                title: "second",
                comments: {
                  create: {
                    content: "second post comment",
                    authorId: faker.datatype.number(),
                  },
                },
              },
            },
          ],
        },
      },
    });
    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith({
      ...params,
      args: {
        ...params.args,
        data: {
          ...params.args.data,
          posts: {
            update: [
              {
                where: params.args.data.posts.update[0].where,
                data: {
                  title: "first",
                  comments: {
                    create: {
                      content: "first post comment",
                      authorId: expect.any(Number),
                      number: 1,
                    },
                  },
                },
              },
              {
                where: params.args.data.posts.update[1].where,
                data: {
                  title: "second",
                  comments: {
                    create: {
                      content: "second post comment",
                      authorId: expect.any(Number),
                      number: 2,
                    },
                  },
                },
              },
            ],
          },
        },
      },
    });
  });

  it("allows middleware to modify params of deeply nested lists of create operations", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.action === "create" && params.model === "Comment") {
        return next({
          ...params,
          args: {
            data: {
              ...params.args.data,
              number: params.args.data.content === "first post comment" ? 1 : 2,
            },
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((params: any) => params);
    const params = createParams("User", "update", {
      where: { id: faker.datatype.number() },
      data: {
        email: faker.internet.email(),
        posts: {
          create: [
            {
              title: "first",
              comments: {
                create: [
                  {
                    content: "first post comment",
                    authorId: faker.datatype.number(),
                  },
                  {
                    content: "second post comment",
                    authorId: faker.datatype.number(),
                  },
                ],
              },
            },
            {
              title: "second",
              comments: {
                create: [
                  {
                    content: "first post comment",
                    authorId: faker.datatype.number(),
                  },
                  {
                    content: "second post comment",
                    authorId: faker.datatype.number(),
                  },
                ],
              },
            },
          ],
        },
      },
    });
    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith({
      ...params,
      args: {
        ...params.args,
        data: {
          ...params.args.data,
          posts: {
            create: [
              {
                title: "first",
                comments: {
                  create: [
                    {
                      content: "first post comment",
                      authorId: expect.any(Number),
                      number: 1,
                    },
                    {
                      content: "second post comment",
                      authorId: expect.any(Number),
                      number: 2,
                    },
                  ],
                },
              },
              {
                title: "second",
                comments: {
                  create: [
                    {
                      content: "first post comment",
                      authorId: expect.any(Number),
                      number: 1,
                    },
                    {
                      content: "second post comment",
                      authorId: expect.any(Number),
                      number: 2,
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    });
  });

  it("allows middleware to modify include params", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.action === "create" && params.model === "User") {
        return next({
          ...params,
          args: {
            ...params.args,
            include: {
              posts: params.args.include.posts && {
                include: {
                  comments: true,
                },
              },
            },
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((params: any) => params);
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
      },
      include: {
        posts: true,
      },
    });
    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith({
      ...params,
      args: {
        ...params.args,
        include: {
          posts: {
            include: {
              comments: true,
            },
          },
        },
      },
    });
  });

  it("allows middleware to modify include params through include actions", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.action === "include" && params.model === "Post") {
        return next({
          ...params,
          args: {
            orderBy: { createdAt: "desc" },
            comments: true,
            skip: params.args.skip + 1,
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((params: any) => params);
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
      },
      include: {
        posts: {
          orderBy: { createdAt: "asc" },
          skip: 10,
        },
      },
    });
    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith({
      ...params,
      args: {
        ...params.args,
        include: {
          ...params.args.include,
          posts: {
            ...params.args.include.posts,
            orderBy: { createdAt: "desc" },
            comments: true,
            skip: 11,
          },
        },
      },
    });
  });

  it("allows middleware to modify deeply nested include params through include action", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.action === "include" && params.model === "Comment") {
        if (params.args.skip) {
          params.args.skip += 1;
        }
        return next({
          ...params,
          args: {
            ...params.args,
            orderBy: { createdAt: "desc" },
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((params: any) => params);
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
      },
      include: {
        posts: {
          include: {
            comments: {
              include: { replies: { skip: 10 } },
            },
          },
        },
      },
    });
    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith({
      ...params,
      args: {
        ...params.args,
        include: {
          posts: {
            include: {
              comments: {
                orderBy: { createdAt: "desc" },
                include: {
                  replies: {
                    orderBy: { createdAt: "desc" },
                    skip: 11,
                  },
                },
              },
            },
          },
        },
      },
    });
  });

  it("allows middleware to modify select params", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.action === "create" && params.model === "User") {
        return next({
          ...params,
          args: {
            ...params.args,
            select: {
              email: true,
              posts: params.args.select.posts && {
                select: {
                  title: true,
                },
              },
            },
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((params: any) => params);
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
      },
      select: { posts: true },
    });
    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith({
      ...params,
      args: {
        ...params.args,
        select: {
          email: true,
          posts: {
            select: {
              title: true,
            },
          },
        },
      },
    });
  });

  it("allows middleware to modify select params through select action", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.action === "select" && params.model === "Post") {
        return next({
          ...params,
          args: {
            ...params.args,
            select: {
              title: true,
              comments: params.args.select.comments && {
                select: {
                  content: true,
                },
              },
            },
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((params: any) => params);
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
      },
      select: {
        posts: {
          select: {
            comments: true,
          },
        },
      },
    });

    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith({
      ...params,
      args: {
        ...params.args,
        select: {
          posts: {
            select: {
              title: true,
              comments: {
                select: {
                  content: true,
                },
              },
            },
          },
        },
      },
    });
  });

  it("allows middleware to modify deeply nested select params through select action", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.action === "select" && params.model === "Comment") {
        return next({
          ...params,
          args: {
            ...params.args,
            select: {
              ...(typeof params.args.select === "boolean"
                ? {}
                : params.args.select),
              content: true,
            },
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((params: any) => params);
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
      },
      select: {
        posts: {
          select: {
            comments: {
              select: { replies: true },
            },
          },
        },
      },
    });

    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith({
      ...params,
      args: {
        ...params.args,
        select: {
          posts: {
            select: {
              comments: {
                select: {
                  content: true,
                  replies: {
                    select: {
                      content: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  });

  it("waits for all middleware to finish before calling next", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      if (params.model === "Post") {
        await wait(100);
        return next({
          ...params,
          args: {
            data: {
              ...params.args.data,
              number: faker.datatype.number(),
            },
          },
        });
      }

      if (params.model === "Comment") {
        await wait(200);
        return next({
          ...params,
          args: {
            data: {
              ...params.args.data,
              number: faker.datatype.number(),
            },
          },
        });
      }

      return next(params);
    });

    const next = jest.fn((params: any) => params);
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
    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith({
      ...params,
      args: {
        ...params.args,
        data: {
          ...params.args.data,
          posts: {
            create: {
              title: params.args.data.posts.create.title,
              number: expect.any(Number),
              comments: {
                create: {
                  ...params.args.data.posts.create.comments.create,
                  number: expect.any(Number),
                },
              },
            },
          },
        },
      },
    });
  });
});
