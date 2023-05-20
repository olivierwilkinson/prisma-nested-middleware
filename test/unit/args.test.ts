import { Prisma } from "@prisma/client";
import faker from "faker";
import { set } from "lodash";

import { createNestedMiddleware } from "../../src";
import { createParams } from "./helpers/createParams";
import { wait } from "./helpers/wait";

describe("params", () => {
  it("does not mutate passed params object", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      params.args.test = "test";
      return next(params);
    });

    const next = jest.fn((_: any) => Promise.resolve(null));
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
        posts: {
          create: { title: faker.lorem.sentence() },
        },
      },
    });
    await nestedMiddleware(params, next);

    expect(params.args).not.toHaveProperty("test");
    expect(params.args.data.posts.create).not.toHaveProperty("test");
  });

  it("passes through instances of Prisma.NullTypes to next", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      return next(params);
    });

    const next = jest.fn((_: any) => Promise.resolve(null));
    const params = createParams("Profile", "findFirst", {
      where: {
        OR: [
          { meta: { equals: Prisma.JsonNull } },
          { meta: { equals: Prisma.DbNull } },
          { meta: { equals: Prisma.AnyNull } },
        ],
      },
    });
    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith(params);
    expect(next.mock.calls[0][0].args.where.OR).toHaveLength(3);
    next.mock.calls[0][0].args.where.OR.forEach(
      ({ meta }: any, index: number) => {
        expect(meta.equals).toBe(params.args.where.OR[index].meta.equals);
      }
    );
  });

  it("allows middleware to modify root args", async () => {
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

    const next = jest.fn((_: any) => Promise.resolve(null));
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

  it("allows middleware to modify root args asynchronously", async () => {
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

    const next = jest.fn((_: any) => Promise.resolve(null));
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

  it("allows middleware to modify nested args", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.model === "Post") {
        return next({
          ...params,
          args: {
            ...params.args,
            number: faker.datatype.number(),
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((_: any) => Promise.resolve(null));
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

  it("allows middleware to modify nested args asynchronously", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      if (params.model === "Post") {
        await wait(100);
        return next({
          ...params,
          args: {
            ...params.args,
            number: faker.datatype.number(),
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((_: any) => Promise.resolve(null));
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

  it("allows middleware to modify nested create list args", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.model === "Post") {
        return next({
          ...params,
          args: {
            ...params.args,
            number: params.args.title === "first" ? 1 : 2,
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((_: any) => Promise.resolve(null));
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

  it("allows middleware to modify deeply nested toOne update args", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.model === "Comment") {
        if (params.scope && !params.scope.relations.to.isList) {
          return next({
            ...params,
            args: { ...params.args, number: parseInt(params.args.content, 10) },
          });
        }

        return next({
          ...params,
          args: {
            ...params.args,
            data: {
              ...params.args.data,
              number: parseInt(params.args.data.content, 10),
            },
          },
        });
      }

      return next(params);
    });

    const next = jest.fn((_: any) => Promise.resolve(null));
    const params = createParams("User", "update", {
      where: { id: faker.datatype.number() },
      data: {
        email: faker.internet.email(),
        comments: {
          update: {
            where: { id: faker.datatype.number() },
            data: {
              content: "1",
              repliedTo: {
                update: {
                  content: "2",
                  repliedTo: {
                    update: {
                      content: "3",
                    },
                  },
                },
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
          comments: {
            update: {
              where: params.args.data.comments.update.where,
              data: {
                content: "1",
                number: 1,
                repliedTo: {
                  update: {
                    content: "2",
                    number: 2,
                    repliedTo: {
                      update: {
                        content: "3",
                        number: 3,
                      },
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

  it("allows middleware to modify nested update list args", async () => {
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

    const next = jest.fn((_: any) => Promise.resolve(null));
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

  it("allows middleware to modify nested delete list args", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.action === "delete" && params.model === "Post") {
        return next({
          ...params,
          args: { id: params.args.id + 1 },
        });
      }
      return next(params);
    });

    const next = jest.fn((_: any) => Promise.resolve(null));
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

  it("allows middleware to modify args of operations nested in list", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.action === "create" && params.model === "Comment") {
        return next({
          ...params,
          args: {
            ...params.args,
            number: params.args.content === "first post comment" ? 1 : 2,
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((_: any) => Promise.resolve(null));
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

  it("allows middleware to modify args of deeply nested lists of create operations", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.action === "create" && params.model === "Comment") {
        if (params.scope) {
          return next({
            ...params,
            args: {
              ...params.args,
              number: params.args.content === "first post comment" ? 1 : 2,
            },
          });
        }

        return next({
          ...params,
          args: {
            ...params.args,
            data: {
              ...params.args.data,
              number: params.args.data.content === "first post comment" ? 1 : 2,
            },
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((_: any) => Promise.resolve(null));
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

  it("allows middleware to modify include args", async () => {
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

    const next = jest.fn((_: any) => Promise.resolve(null));
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

  it("allows middleware to modify include args through include actions", async () => {
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

    const next = jest.fn((_: any) => Promise.resolve(null));
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

  it("allows middleware to modify deeply nested include args through include action", async () => {
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

    const next = jest.fn((_: any) => Promise.resolve(null));
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

  it("allows middleware to modify select args", async () => {
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

    const next = jest.fn((_: any) => Promise.resolve(null));
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

  it("allows middleware to modify select args through select action", async () => {
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
      if (params.action === "select" && params.model === "Comment") {
        return next({
          ...params,
          args: {
            ...params.args,
            select: {
              content: true,
            },
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((_: any) => Promise.resolve(null));
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

  it("allows middleware to modify deeply nested select args through select action", async () => {
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

    const next = jest.fn((_: any) => Promise.resolve(null));
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

  it("allows middleware to add data to nested createMany args", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.action === "createMany") {
        return next({
          ...params,
          args: {
            ...params.args,
            data: [
              ...params.args.data.map((data: any) => ({
                ...data,
                number: faker.datatype.number(),
              })),
              {
                content: faker.lorem.sentence(),
                number: faker.datatype.number(),
              },
            ],
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((_: any) => Promise.resolve(null));
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
        comments: {
          createMany: { data: [{ content: faker.lorem.sentence() }] },
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
          comments: {
            createMany: {
              data: [
                {
                  content: params.args.data.comments.createMany.data[0].content,
                  number: expect.any(Number),
                },
                { content: expect.any(String), number: expect.any(Number) },
              ],
            },
          },
        },
      },
    });
  });

  it("allows user to reorder nested createMany args", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.action === "createMany") {
        return next({
          ...params,
          args: {
            ...params.args,
            data: [...params.args.data].reverse(),
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((_: any) => Promise.resolve(null));
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
        comments: {
          createMany: {
            data: [{ content: "first" }, { content: "second" }],
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
          comments: {
            createMany: {
              data: [{ content: "second" }, { content: "first" }],
            },
          },
        },
      },
    });
  });

  it("allows user to add data to nested createMany args", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.action === "createMany") {
        return next({
          ...params,
          args: {
            ...params.args,
            data: [
              ...params.args.data.map((data: any) => ({
                ...data,
                number: faker.datatype.number(),
              })),
              {
                content: faker.lorem.sentence(),
                number: faker.datatype.number(),
              },
            ],
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((_: any) => Promise.resolve(null));
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
        comments: {
          createMany: { data: [{ content: faker.lorem.sentence() }] },
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
          comments: {
            createMany: {
              data: [
                {
                  content: params.args.data.comments.createMany.data[0].content,
                  number: expect.any(Number),
                },
                { content: expect.any(String), number: expect.any(Number) },
              ],
            },
          },
        },
      },
    });
  });

  it("allows user to remove data from nested createMany args", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.action === "createMany") {
        return next({
          ...params,
          args: {
            ...params.args,
            data: [
              { ...params.args.data[0], number: faker.datatype.number() },
              { number: faker.datatype.number() },
            ],
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((_: any) => Promise.resolve(null));
    const params = createParams("User", "create", {
      data: {
        email: faker.internet.email(),
        comments: {
          createMany: {
            data: [
              { content: faker.lorem.sentence() },
              { content: faker.lorem.sentence() },
              { content: faker.lorem.sentence() },
            ],
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
          comments: {
            createMany: {
              data: [
                {
                  content: params.args.data.comments.createMany.data[0].content,
                  number: expect.any(Number),
                },
                { number: expect.any(Number) },
              ],
            },
          },
        },
      },
    });
  });

  it("allows user to modify nested where args", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.action === "where" && params.model === "Comment") {
        return next({
          ...params,
          args: {
            ...params.args,
            content: "bar",
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((_: any) => Promise.resolve(null));
    const params = createParams("User", "findMany", {
      where: {
        posts: {
          some: {
            comments: {
              some: {
                content: "foo",
              },
            },
          },
        },
      },
    });

    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith(
      set(params, "args.where.posts.some.comments.some.content", "bar")
    );
  });

  it("allows user to modify nested where args by removing a field", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.action === "where" && params.model === "Comment") {
        return next({
          ...params,
          args: {
            // remove content and replace it with updatedAt
            updatedAt: {
              gt: new Date(),
            },
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((_: any) => Promise.resolve(null));
    const params = createParams("User", "findMany", {
      where: {
        posts: {
          some: {
            comments: {
              some: {
                content: "foo",
              },
            },
          },
        },
      },
    });

    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith(
      set(params, "args.where.posts.some.comments.some", {
        updatedAt: {
          gt: expect.any(Date),
        },
      })
    );
  });

  it("allows user to modify nested where args with nested where", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.action === "where" && params.model === "Comment") {
        return next({
          ...params,
          args: {
            ...params.args,
            content: {
              contains: "bar",
            },
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((_: any) => Promise.resolve(null));
    const params = createParams("User", "findMany", {
      where: {
        posts: {
          some: {
            comments: {
              some: {
                content: "foo",
              },
            },
          },
        },
      },
    });

    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith(
      set(params, "args.where.posts.some.comments.some.content", {
        contains: "bar",
      })
    );
  });

  it("allows user to modify nested where args with nested where in logical operation", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.action === "where" && params.model === "Comment") {
        return next({
          ...params,
          args: {
            ...params.args,
            content: {
              contains: "bar",
            },
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((_: any) => Promise.resolve(null));
    const params = createParams("User", "findMany", {
      where: {
        posts: {
          some: {
            AND: [
              {
                author: {
                  id: 1,
                },
              },
              {
                comments: {
                  some: {
                    content: "foo",
                  },
                },
              },
            ],
          },
        },
      },
    });

    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith(
      set(params, "args.where.posts.some.AND.1.comments.some.content", {
        contains: "bar",
      })
    );
  });

  it("allows user to modify where args deeply nested in logical operations", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (
        params.action === "where" &&
        params.model === "User" &&
        params.scope
      ) {
        return next({
          ...params,
          args: {
            ...params.args,
            ...(params.args.id ? { id: params.args.id + 1 } : {}),
          },
        });
      }

      if (params.action === "where" && params.model === "Comment") {
        return next({
          ...params,
          args: {
            ...params.args,
            content: "bar",
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((_: any) => Promise.resolve(null));
    const params = createParams("User", "findMany", {
      where: {
        posts: {
          some: {
            AND: [
              {
                NOT: {
                  OR: [
                    {
                      AND: [
                        {
                          NOT: {
                            OR: [
                              {
                                id: 1,
                                author: {
                                  id: 2,
                                },
                              },
                            ],
                          },
                        },
                      ],
                      comments: {
                        some: {
                          content: "foo",
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    });

    await nestedMiddleware(params, next);

    set(
      params,
      "args.where.posts.some.AND.0.NOT.OR.0.AND.0.NOT.OR.0.author.id",
      3
    );
    set(
      params,
      "args.where.posts.some.AND.0.NOT.OR.0.comments.some.content",
      "bar"
    );

    expect(next).toHaveBeenCalledWith(params);
  });

  it("allows user to modify nested include where args", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.action === "where" && params.model === "Post") {
        return next({
          ...params,
          args: {
            ...params.args,
            title: "bar",
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((_: any) => Promise.resolve(null));
    const params = createParams("User", "findUnique", {
      where: { id: 1 },
      include: {
        posts: {
          where: {
            title: "foo",
          },
        },
      },
    });

    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith(
      set(params, "args.include.posts.where.title", "bar")
    );
  });

  it("allows user to modify nested select where args", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.action === "where" && params.model === "Post") {
        return next({
          ...params,
          args: {
            ...params.args,
            title: "bar",
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((_: any) => Promise.resolve(null));
    const params = createParams("User", "findUnique", {
      where: { id: 1 },
      select: {
        posts: {
          where: {
            title: "foo",
          },
        },
      },
    });

    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith(
      set(params, "args.select.posts.where.title", "bar")
    );
  });

  it("allows user to modify nested where relation args in nested include where", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.action === "where" && params.model === "Post") {
        return next({
          ...params,
          args: {
            ...params.args,
            title: "bar",
          },
        });
      }
      if (params.action === "where" && params.model === "Comment") {
        return next({
          ...params,
          args: {
            ...params.args,
            content: "bar",
          },
        });
      }
      if (params.action === "where" && params.model === "User") {
        return next({
          ...params,
          args: {
            ...params.args,
            email: "bar",
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((_: any) => Promise.resolve(null));
    const params = createParams("User", "findUnique", {
      where: { id: 1 },
      include: {
        posts: {
          where: {
            title: "foo",
            AND: [
              { author: { id: 1, email: "foo" } },
              { comments: { every: { content: "foo" } } },
            ],
            OR: [{ NOT: { author: { id: 1, email: "foo" } } }],
            NOT: { comments: { some: { content: "foo" } } },
          },
        },
      },
    });

    await nestedMiddleware(params, next);

    set(params, "args.include.posts.where.title", "bar");
    set(params, "args.include.posts.where.AND.0.author.email", "bar");
    set(params, "args.include.posts.where.AND.1.comments.every.content", "bar");
    set(params, "args.include.posts.where.OR.0.NOT.author.email", "bar");
    set(params, "args.include.posts.where.NOT.comments.some.content", "bar");

    expect(next).toHaveBeenCalledWith(params);
  });

  it("allows user to modify nested where relation args in nested select where", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.action === "where" && params.model === "Post") {
        return next({
          ...params,
          args: {
            ...params.args,
            title: "bar",
          },
        });
      }
      if (params.action === "where" && params.model === "Comment") {
        return next({
          ...params,
          args: {
            ...params.args,
            content: "bar",
          },
        });
      }
      if (params.action === "where" && params.model === "User") {
        return next({
          ...params,
          args: {
            ...params.args,
            email: "bar",
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((_: any) => Promise.resolve(null));
    const params = createParams("User", "findUnique", {
      where: { id: 1 },
      select: {
        posts: {
          where: {
            title: "foo",
            AND: [
              { author: { id: 1, email: "foo" } },
              { comments: { every: { content: "foo" } } },
            ],
            OR: [{ NOT: { author: { id: 1, email: "foo" } } }],
            NOT: { comments: { some: { content: "foo" } } },
          },
        },
      },
    });

    await nestedMiddleware(params, next);

    set(params, "args.select.posts.where.title", "bar");
    set(params, "args.select.posts.where.AND.0.author.email", "bar");
    set(params, "args.select.posts.where.AND.1.comments.every.content", "bar");
    set(params, "args.select.posts.where.OR.0.NOT.author.email", "bar");
    set(params, "args.select.posts.where.NOT.comments.some.content", "bar");

    expect(next).toHaveBeenCalledWith(params);
  });

  it("ignores invalid values passed to where logical operations", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.action === "where" && params.model === "Comment") {
        return next({
          ...params,
          args: {
            ...params.args,
            content: {
              contains: "bar",
            },
          },
        });
      }
      return next(params);
    });

    const next = jest.fn((_: any) => Promise.resolve(null));
    const params = createParams("User", "findMany", {
      where: {
        posts: {
          some: {
            AND: [
              {
                comments: {
                  some: {
                    content: "foo",
                  },
                },
              },
              // @ts-expect-error invalid value
              null,
              // @ts-expect-error invalid value
              undefined,
              // @ts-expect-error invalid value
              1,
              // @ts-expect-error invalid value
              "foo",
              // @ts-expect-error invalid value
              true,
            ],
            // @ts-expect-error invalid value
            NOT: null,
            // @ts-expect-error invalid value
            OR: true,
          },
        },
      },
    });

    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith(
      set(params, "args.where.posts.some.AND.0.comments.some.content", {
        contains: "bar",
      })
    );
  });

  it("waits for all middleware to finish before calling next when modifying args", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      if (params.model === "Post") {
        await wait(100);
        return next({
          ...params,
          args: {
            ...params.args,
            number: faker.datatype.number(),
          },
        });
      }

      if (params.model === "Comment") {
        await wait(200);
        return next({
          ...params,
          args: {
            ...params.args,
            number: faker.datatype.number(),
          },
        });
      }

      return next(params);
    });

    const next = jest.fn((_: any) => Promise.resolve(null));
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
