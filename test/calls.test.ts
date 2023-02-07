import { Prisma } from "@prisma/client";
import faker from "faker";
import { get } from "lodash";

import { createNestedMiddleware, NestedParams } from "../src";
import { createParams } from "./utils/createParams";

type MiddlewareCall<Model extends Prisma.ModelName> = {
  model: Model;
  action:
    | "create"
    | "update"
    | "upsert"
    | "delete"
    | "createMany"
    | "updateMany"
    | "deleteMany"
    | "connectOrCreate"
    | "findUnique"
    | "findFirst"
    | "findMany"
    | "include"
    | "select";
  argsPath: string;
  scope?: MiddlewareCall<any>;
};

function nestedParamsFromCall<Model extends Prisma.ModelName>(
  rootParams: Prisma.MiddlewareParams,
  call: MiddlewareCall<Model>
): NestedParams {
  const args = get(rootParams, call.argsPath);
  const params = createParams(
    call.model,
    call.action,
    call.action === "create" ? { data: args } : args
  );
  return {
    ...params,
    scope: call.scope
      ? nestedParamsFromCall(rootParams, call.scope)
      : rootParams,
  };
}

describe("calls", () => {
  it("calls middleware once when there are no nested operations", async () => {
    const middleware = jest.fn((params, next) => next(params));
    const nestedMiddleware = createNestedMiddleware(middleware);

    const next = jest.fn((params: any) => params);
    const params = createParams("User", "create", {
      data: { email: faker.internet.email() },
    });
    await nestedMiddleware(params, next);

    // middleware is called with params and next
    expect(middleware).toHaveBeenCalledTimes(1);
    expect(middleware).toHaveBeenCalledWith(params, next);
  });

  it.each<{
    description: string;
    rootParams: Prisma.MiddlewareParams;
    calls: MiddlewareCall<any>[];
  }>([
    {
      description: "nested create in create",
      rootParams: createParams("User", "create", {
        data: {
          email: faker.internet.email(),
          profile: { create: { bio: faker.lorem.paragraph() } },
        },
      }),
      calls: [
        {
          action: "create",
          model: "Profile",
          argsPath: "args.data.profile.create",
        },
      ],
    },
    {
      description: "nested create in update",
      rootParams: createParams("User", "update", {
        where: { id: faker.datatype.number() },
        data: {
          email: faker.internet.email(),
          profile: { create: { bio: faker.lorem.paragraph() } },
        },
      }),
      calls: [
        {
          action: "create",
          model: "Profile",
          argsPath: "args.data.profile.create",
        },
      ],
    },
    {
      description: "nested creates in upsert",
      rootParams: createParams("User", "upsert", {
        where: { id: faker.datatype.number() },
        create: {
          email: faker.internet.email(),
          profile: { create: { bio: faker.lorem.paragraph() } },
        },
        update: {
          email: faker.internet.email(),
          profile: { create: { bio: faker.lorem.paragraph() } },
        },
      }),
      calls: [
        {
          action: "create",
          model: "Profile",
          argsPath: "args.create.profile.create",
        },
        {
          action: "create",
          model: "Profile",
          argsPath: "args.update.profile.create",
        },
      ],
    },
    {
      description: "nested create array in create",
      rootParams: createParams("User", "create", {
        data: {
          email: faker.internet.email(),
          posts: {
            create: [
              {
                title: faker.lorem.sentence(),
                content: faker.lorem.paragraph(),
              },
              {
                title: faker.lorem.sentence(),
                content: faker.lorem.paragraph(),
              },
            ],
          },
        },
      }),
      calls: [
        {
          action: "create",
          model: "Post",
          argsPath: "args.data.posts.create.0",
        },
        {
          action: "create",
          model: "Post",
          argsPath: "args.data.posts.create.1",
        },
      ],
    },
    {
      description: "nested create array in update",
      rootParams: createParams("User", "update", {
        where: { id: faker.datatype.number() },
        data: {
          email: faker.internet.email(),
          posts: {
            create: [
              {
                title: faker.lorem.sentence(),
                content: faker.lorem.paragraph(),
              },
              {
                title: faker.lorem.sentence(),
                content: faker.lorem.paragraph(),
              },
            ],
          },
        },
      }),
      calls: [
        {
          action: "create",
          model: "Post",
          argsPath: "args.data.posts.create.0",
        },
        {
          action: "create",
          model: "Post",
          argsPath: "args.data.posts.create.1",
        },
      ],
    },
    {
      description: "nested create and update in update",
      rootParams: createParams("User", "update", {
        where: { id: faker.datatype.number() },
        data: {
          email: faker.internet.email(),
          profile: {
            update: { bio: faker.lorem.paragraph() },
          },
          posts: {
            create: [
              {
                title: faker.lorem.sentence(),
                content: faker.lorem.paragraph(),
              },
            ],
          },
        },
      }),
      calls: [
        {
          action: "update",
          model: "Profile",
          argsPath: "args.data.profile.update",
        },
        {
          action: "create",
          model: "Post",
          argsPath: "args.data.posts.create.0",
        },
      ],
    },
    {
      description: "nested create array in upsert",
      rootParams: createParams("User", "upsert", {
        where: { id: faker.datatype.number() },
        create: {
          email: faker.internet.email(),
          posts: {
            create: [
              {
                title: faker.lorem.sentence(),
                content: faker.lorem.paragraph(),
              },
              {
                title: faker.lorem.sentence(),
                content: faker.lorem.paragraph(),
              },
            ],
          },
        },
        update: {
          email: faker.internet.email(),
          posts: {
            create: [
              {
                title: faker.lorem.sentence(),
                content: faker.lorem.paragraph(),
              },
              {
                title: faker.lorem.sentence(),
                content: faker.lorem.paragraph(),
              },
            ],
          },
        },
      }),
      calls: [
        {
          action: "create",
          model: "Post",
          argsPath: "args.create.posts.create.0",
        },
        {
          action: "create",
          model: "Post",
          argsPath: "args.create.posts.create.1",
        },
        {
          action: "create",
          model: "Post",
          argsPath: "args.update.posts.create.0",
        },
        {
          action: "create",
          model: "Post",
          argsPath: "args.update.posts.create.1",
        },
      ],
    },
    {
      description: "nested update in update",
      rootParams: createParams("User", "update", {
        where: { id: faker.datatype.number() },

        data: {
          email: faker.internet.email(),
          profile: { update: { bio: faker.lorem.paragraph() } },
        },
      }),
      calls: [
        {
          action: "update",
          model: "Profile",
          argsPath: "args.data.profile.update",
        },
      ],
    },
    {
      description: "nested update in upsert",
      rootParams: createParams("User", "upsert", {
        where: { id: faker.datatype.number() },
        create: {
          email: faker.internet.email(),
        },
        update: {
          email: faker.internet.email(),
          profile: { update: { bio: faker.lorem.paragraph() } },
        },
      }),
      calls: [
        {
          action: "update",
          model: "Profile",
          argsPath: "args.update.profile.update",
        },
      ],
    },
    {
      description: "nested update array in update",
      rootParams: createParams("User", "update", {
        where: { id: faker.datatype.number() },
        data: {
          email: faker.internet.email(),
          posts: {
            update: [
              {
                where: { id: faker.datatype.number() },
                data: {
                  title: faker.lorem.sentence(),
                  content: faker.lorem.paragraph(),
                },
              },
              {
                where: { id: faker.datatype.number() },
                data: {
                  title: faker.lorem.sentence(),
                  content: faker.lorem.paragraph(),
                },
              },
            ],
          },
        },
      }),
      calls: [
        {
          action: "update",
          model: "Post",
          argsPath: "args.data.posts.update.0",
        },
        {
          action: "update",
          model: "Post",
          argsPath: "args.data.posts.update.1",
        },
      ],
    },
    {
      description: "nested update array in upsert",
      rootParams: createParams("User", "upsert", {
        where: { id: faker.datatype.number() },
        create: {
          email: faker.internet.email(),
        },
        update: {
          email: faker.internet.email(),
          posts: {
            update: [
              {
                where: { id: faker.datatype.number() },
                data: {
                  title: faker.lorem.sentence(),
                  content: faker.lorem.paragraph(),
                },
              },
              {
                where: { id: faker.datatype.number() },
                data: {
                  title: faker.lorem.sentence(),
                  content: faker.lorem.paragraph(),
                },
              },
            ],
          },
        },
      }),
      calls: [
        {
          action: "update",
          model: "Post",
          argsPath: "args.update.posts.update.0",
        },
        {
          action: "update",
          model: "Post",
          argsPath: "args.update.posts.update.1",
        },
      ],
    },
    {
      description: "nested upsert in update",
      rootParams: createParams("User", "update", {
        where: { id: faker.datatype.number() },
        data: {
          email: faker.internet.email(),
          profile: {
            upsert: {
              create: { bio: faker.lorem.paragraph() },
              update: { bio: faker.lorem.paragraph() },
            },
          },
        },
      }),
      calls: [
        {
          action: "upsert",
          model: "Profile",
          argsPath: "args.data.profile.upsert",
        },
      ],
    },
    {
      description: "nested upsert in upsert",
      rootParams: createParams("User", "upsert", {
        where: { id: faker.datatype.number() },
        create: {
          email: faker.internet.email(),
        },
        update: {
          email: faker.internet.email(),
          profile: {
            upsert: {
              create: { bio: faker.lorem.paragraph() },
              update: { bio: faker.lorem.paragraph() },
            },
          },
        },
      }),
      calls: [
        {
          action: "upsert",
          model: "Profile",
          argsPath: "args.update.profile.upsert",
        },
      ],
    },
    {
      description: "nested delete in update",
      rootParams: createParams("User", "update", {
        where: { id: faker.datatype.number() },
        data: {
          email: faker.internet.email(),
          profile: { delete: true },
        },
      }),
      calls: [
        {
          action: "delete",
          model: "Profile",
          argsPath: "args.data.profile.delete",
        },
      ],
    },
    {
      description: "nested delete in upsert",
      rootParams: createParams("User", "upsert", {
        where: { id: faker.datatype.number() },
        create: {
          email: faker.internet.email(),
        },
        update: {
          email: faker.internet.email(),
          profile: { delete: true },
        },
      }),
      calls: [
        {
          action: "delete",
          model: "Profile",
          argsPath: "args.update.profile.delete",
        },
      ],
    },
    {
      description: "nested delete array in update",
      rootParams: createParams("User", "update", {
        where: { id: faker.datatype.number() },
        data: {
          email: faker.internet.email(),
          posts: {
            delete: [
              { id: faker.datatype.number() },
              { id: faker.datatype.number() },
            ],
          },
        },
      }),
      calls: [
        {
          action: "delete",
          model: "Post",
          argsPath: "args.data.posts.delete.0",
        },
        {
          action: "delete",
          model: "Post",
          argsPath: "args.data.posts.delete.1",
        },
      ],
    },
    {
      description: "nested delete array in upsert",
      rootParams: createParams("User", "upsert", {
        where: { id: faker.datatype.number() },
        create: {
          email: faker.internet.email(),
        },
        update: {
          email: faker.internet.email(),
          posts: {
            delete: [
              { id: faker.datatype.number() },
              { id: faker.datatype.number() },
            ],
          },
        },
      }),
      calls: [
        {
          action: "delete",
          model: "Post",
          argsPath: "args.update.posts.delete.0",
        },
        {
          action: "delete",
          model: "Post",
          argsPath: "args.update.posts.delete.1",
        },
      ],
    },
    {
      description: "nested createMany in create",
      rootParams: createParams("User", "create", {
        data: {
          email: faker.internet.email(),
          posts: {
            createMany: {
              data: [
                {
                  title: faker.lorem.sentence(),
                  content: faker.lorem.paragraph(),
                },
                {
                  title: faker.lorem.sentence(),
                  content: faker.lorem.paragraph(),
                },
              ],
            },
          },
        },
      }),
      calls: [
        {
          action: "createMany",
          model: "Post",
          argsPath: "args.data.posts.createMany",
        },
      ],
    },
    {
      description: "nested createMany in update",
      rootParams: createParams("User", "update", {
        where: { id: faker.datatype.number() },
        data: {
          email: faker.internet.email(),
          posts: {
            createMany: {
              data: [
                {
                  title: faker.lorem.sentence(),
                  content: faker.lorem.paragraph(),
                },
                {
                  title: faker.lorem.sentence(),
                  content: faker.lorem.paragraph(),
                },
              ],
            },
          },
        },
      }),
      calls: [
        {
          action: "createMany",
          model: "Post",
          argsPath: "args.data.posts.createMany",
        },
      ],
    },
    {
      description: "nested createMany in upsert",
      rootParams: createParams("User", "upsert", {
        where: { id: faker.datatype.number() },
        create: {
          email: faker.internet.email(),
        },
        update: {
          email: faker.internet.email(),
          posts: {
            createMany: {
              data: [
                {
                  title: faker.lorem.sentence(),
                  content: faker.lorem.paragraph(),
                },
                {
                  title: faker.lorem.sentence(),
                  content: faker.lorem.paragraph(),
                },
              ],
            },
          },
        },
      }),
      calls: [
        {
          action: "createMany",
          model: "Post",
          argsPath: "args.update.posts.createMany",
        },
      ],
    },
    {
      description: "nested updateMany in update",
      rootParams: createParams("User", "update", {
        where: { id: faker.datatype.number() },
        data: {
          email: faker.internet.email(),
          posts: {
            updateMany: {
              data: {
                title: faker.lorem.sentence(),
                content: faker.lorem.paragraph(),
              },
              where: { id: faker.datatype.number() },
            },
          },
        },
      }),
      calls: [
        {
          action: "updateMany",
          model: "Post",
          argsPath: "args.data.posts.updateMany",
        },
      ],
    },
    {
      description: "nested updateMany in upsert",
      rootParams: createParams("User", "upsert", {
        where: { id: faker.datatype.number() },
        create: {
          email: faker.internet.email(),
        },
        update: {
          email: faker.internet.email(),
          posts: {
            updateMany: {
              data: {
                title: faker.lorem.sentence(),
                content: faker.lorem.paragraph(),
              },
              where: { id: faker.datatype.number() },
            },
          },
        },
      }),
      calls: [
        {
          action: "updateMany",
          model: "Post",
          argsPath: "args.update.posts.updateMany",
        },
      ],
    },
    {
      description: "nested deleteMany in update",
      rootParams: createParams("User", "update", {
        where: { id: faker.datatype.number() },
        data: {
          email: faker.internet.email(),
          posts: {
            deleteMany: { id: faker.datatype.number() },
          },
        },
      }),
      calls: [
        {
          action: "deleteMany",
          model: "Post",
          argsPath: "args.data.posts.deleteMany",
        },
      ],
    },
    {
      description: "nested deleteMany in upsert",
      rootParams: createParams("User", "upsert", {
        where: { id: faker.datatype.number() },
        create: {
          email: faker.internet.email(),
        },
        update: {
          email: faker.internet.email(),
          posts: {
            deleteMany: { id: faker.datatype.number() },
          },
        },
      }),
      calls: [
        {
          action: "deleteMany",
          model: "Post",
          argsPath: "args.update.posts.deleteMany",
        },
      ],
    },
    {
      description: "nested connectOrCreate in update",
      rootParams: createParams("User", "update", {
        where: { id: faker.datatype.number() },
        data: {
          email: faker.internet.email(),
          profile: {
            connectOrCreate: {
              where: { id: faker.datatype.number() },
              create: { bio: faker.lorem.paragraph() },
            },
          },
        },
      }),
      calls: [
        {
          action: "connectOrCreate",
          model: "Profile",
          argsPath: "args.data.profile.connectOrCreate",
        },
      ],
    },
    {
      description: "nested connectOrCreate in upsert",
      rootParams: createParams("User", "upsert", {
        where: { id: faker.datatype.number() },
        create: {
          email: faker.internet.email(),
        },
        update: {
          email: faker.internet.email(),
          profile: {
            connectOrCreate: {
              where: { id: faker.datatype.number() },
              create: { bio: faker.lorem.paragraph() },
            },
          },
        },
      }),
      calls: [
        {
          action: "connectOrCreate",
          model: "Profile",
          argsPath: "args.update.profile.connectOrCreate",
        },
      ],
    },
    {
      description: "deeply nested creates",
      rootParams: createParams("User", "create", {
        data: {
          email: faker.internet.email(),
          posts: {
            create: {
              title: faker.lorem.sentence(),
              content: faker.lorem.paragraph(),
              comments: {
                create: {
                  authorId: faker.datatype.number(),
                  content: faker.lorem.paragraph(),
                },
              },
            },
          },
        },
      }),
      calls: [
        {
          action: "create",
          model: "Post",
          argsPath: "args.data.posts.create",
        },
        {
          action: "create",
          model: "Comment",
          argsPath: "args.data.posts.create.comments.create",
          scope: {
            action: "create",
            model: "Post",
            argsPath: "args.data.posts.create",
          },
        },
      ],
    },
    {
      description: "deeply nested update",
      rootParams: createParams("User", "update", {
        where: { id: faker.datatype.number() },
        data: {
          email: faker.internet.email(),
          posts: {
            update: {
              where: { id: faker.datatype.number() },
              data: {
                title: faker.lorem.sentence(),
                content: faker.lorem.paragraph(),
                comments: {
                  update: {
                    where: { id: faker.datatype.number() },
                    data: {
                      authorId: faker.datatype.number(),
                      content: faker.lorem.paragraph(),
                    },
                  },
                },
              },
            },
          },
        },
      }),
      calls: [
        {
          action: "update",
          model: "Post",
          argsPath: "args.data.posts.update",
        },
        {
          action: "update",
          model: "Comment",
          argsPath: "args.data.posts.update.data.comments.update",
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.data.posts.update",
          },
        },
      ],
    },
    {
      description: "deeply nested delete",
      rootParams: createParams("User", "update", {
        where: { id: faker.datatype.number() },
        data: {
          email: faker.internet.email(),
          posts: {
            update: {
              where: { id: faker.datatype.number() },
              data: {
                title: faker.lorem.sentence(),
                content: faker.lorem.paragraph(),
                comments: {
                  delete: [
                    { id: faker.datatype.number() },
                    { id: faker.datatype.number() },
                  ],
                },
              },
            },
          },
        },
      }),
      calls: [
        {
          action: "update",
          model: "Post",
          argsPath: "args.data.posts.update",
        },
        {
          action: "delete",
          model: "Comment",
          argsPath: "args.data.posts.update.data.comments.delete.0",
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.data.posts.update",
          },
        },
        {
          action: "delete",
          model: "Comment",
          argsPath: "args.data.posts.update.data.comments.delete.1",
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.data.posts.update",
          },
        },
      ],
    },
    {
      description: "deeply nested upsert",
      rootParams: createParams("User", "upsert", {
        where: { id: faker.datatype.number() },
        create: {
          email: faker.internet.email(),
        },
        update: {
          email: faker.internet.email(),
          posts: {
            update: {
              where: { id: faker.datatype.number() },
              data: {
                title: faker.lorem.sentence(),
                content: faker.lorem.paragraph(),
                comments: {
                  upsert: {
                    where: { id: faker.datatype.number() },
                    create: {
                      authorId: faker.datatype.number(),
                      content: faker.lorem.paragraph(),
                    },
                    update: {
                      authorId: faker.datatype.number(),
                      content: faker.lorem.paragraph(),
                    },
                  },
                },
              },
            },
          },
        },
      }),
      calls: [
        {
          action: "update",
          model: "Post",
          argsPath: "args.update.posts.update",
        },
        {
          action: "upsert",
          model: "Comment",
          argsPath: "args.update.posts.update.data.comments.upsert",
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.update.posts.update",
          },
        },
      ],
    },
    {
      description: "deeply nested createMany",
      rootParams: createParams("User", "update", {
        where: { id: faker.datatype.number() },
        data: {
          email: faker.internet.email(),
          posts: {
            update: {
              where: { id: faker.datatype.number() },
              data: {
                title: faker.lorem.sentence(),
                content: faker.lorem.paragraph(),
                comments: {
                  createMany: {
                    data: [
                      {
                        authorId: faker.datatype.number(),
                        content: faker.lorem.paragraph(),
                      },
                      {
                        authorId: faker.datatype.number(),
                        content: faker.lorem.paragraph(),
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      }),
      calls: [
        {
          action: "update",
          model: "Post",
          argsPath: "args.data.posts.update",
        },
        {
          action: "createMany",
          model: "Comment",
          argsPath: "args.data.posts.update.data.comments.createMany",
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.data.posts.update",
          },
        },
      ],
    },
    {
      description: "deeply nested updateMany",
      rootParams: createParams("User", "update", {
        where: { id: faker.datatype.number() },
        data: {
          email: faker.internet.email(),
          posts: {
            update: {
              where: { id: faker.datatype.number() },
              data: {
                title: faker.lorem.sentence(),
                content: faker.lorem.paragraph(),
                comments: {
                  updateMany: {
                    where: { id: faker.datatype.number() },
                    data: {
                      content: faker.lorem.paragraph(),
                    },
                  },
                },
              },
            },
          },
        },
      }),
      calls: [
        {
          action: "update",
          model: "Post",
          argsPath: "args.data.posts.update",
        },
        {
          action: "updateMany",
          model: "Comment",
          argsPath: "args.data.posts.update.data.comments.updateMany",
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.data.posts.update",
          },
        },
      ],
    },
    {
      description: "deeply nested deleteMany",
      rootParams: createParams("User", "update", {
        where: { id: faker.datatype.number() },
        data: {
          email: faker.internet.email(),
          posts: {
            update: {
              where: { id: faker.datatype.number() },
              data: {
                title: faker.lorem.sentence(),
                content: faker.lorem.paragraph(),
                comments: {
                  deleteMany: { id: faker.datatype.number() },
                },
              },
            },
          },
        },
      }),
      calls: [
        {
          action: "update",
          model: "Post",
          argsPath: "args.data.posts.update",
        },
        {
          action: "deleteMany",
          model: "Comment",
          argsPath: "args.data.posts.update.data.comments.deleteMany",
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.data.posts.update",
          },
        },
      ],
    },
    {
      description: "deeply nested connectOrCreate",
      rootParams: createParams("User", "update", {
        where: { id: faker.datatype.number() },
        data: {
          email: faker.internet.email(),
          posts: {
            update: {
              where: { id: faker.datatype.number() },
              data: {
                title: faker.lorem.sentence(),
                content: faker.lorem.paragraph(),
                comments: {
                  connectOrCreate: {
                    where: { id: faker.datatype.number() },
                    create: {
                      authorId: faker.datatype.number(),
                      content: faker.lorem.paragraph(),
                    },
                  },
                },
              },
            },
          },
        },
      }),
      calls: [
        {
          action: "update",
          model: "Post",
          argsPath: "args.data.posts.update",
        },
        {
          action: "connectOrCreate",
          model: "Comment",
          argsPath: "args.data.posts.update.data.comments.connectOrCreate",
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.data.posts.update",
          },
        },
      ],
    },
    {
      description: "include in findUnique",
      rootParams: createParams("User", "findUnique", {
        where: { id: faker.datatype.number() },
        include: {
          posts: true,
        },
      }),
      calls: [
        {
          action: "include",
          model: "Post",
          argsPath: "args.include.posts",
        },
      ],
    },
    {
      description: "include in findFirst",
      rootParams: createParams("User", "findFirst", {
        where: { id: faker.datatype.number() },
        include: { posts: true },
      }),
      calls: [
        {
          action: "include",
          model: "Post",
          argsPath: "args.include.posts",
        },
      ],
    },
    {
      description: "include in findMany",
      rootParams: createParams("User", "findMany", {
        where: { id: faker.datatype.number() },
        include: { posts: true },
      }),
      calls: [
        {
          action: "include",
          model: "Post",
          argsPath: "args.include.posts",
        },
      ],
    },
    {
      description: "include in create",
      rootParams: createParams("User", "create", {
        data: {
          email: faker.internet.email(),
          posts: { create: { title: faker.lorem.sentence() } },
        },
        include: { posts: true },
      }),
      calls: [
        {
          action: "create",
          model: "Post",
          argsPath: "args.data.posts.create",
        },
        {
          action: "include",
          model: "Post",
          argsPath: "args.include.posts",
        },
      ],
    },
    {
      description: "include in update",
      rootParams: createParams("User", "update", {
        where: { id: faker.datatype.number() },
        data: {
          email: faker.internet.email(),
        },
        include: { posts: true },
      }),
      calls: [
        {
          action: "include",
          model: "Post",
          argsPath: "args.include.posts",
        },
      ],
    },
    {
      description: "include in upsert",
      rootParams: createParams("User", "upsert", {
        where: { id: faker.datatype.number() },
        create: {
          email: faker.internet.email(),
        },
        update: {
          email: faker.internet.email(),
        },
        include: { posts: true },
      }),
      calls: [
        {
          action: "include",
          model: "Post",
          argsPath: "args.include.posts",
        },
      ],
    },
    {
      description: "nested includes",
      rootParams: createParams("User", "findUnique", {
        where: { id: faker.datatype.number() },
        include: {
          posts: {
            include: {
              comments: true,
            },
          },
        },
      }),
      calls: [
        {
          action: "include",
          model: "Post",
          argsPath: "args.include.posts",
        },
        {
          action: "include",
          model: "Comment",
          argsPath: "args.include.posts.include.comments",
          scope: {
            action: "include",
            model: "Post",
            argsPath: "args.include.posts",
          },
        },
      ],
    },
    {
      description: "deeply nested includes",
      rootParams: createParams("User", "findUnique", {
        where: { id: faker.datatype.number() },
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
      }),
      calls: [
        {
          action: "include",
          model: "Post",
          argsPath: "args.include.posts",
        },
        {
          action: "include",
          model: "Comment",
          argsPath: "args.include.posts.include.comments",
          scope: {
            action: "include",
            model: "Post",
            argsPath: "args.include.posts",
          },
        },
        {
          action: "include",
          model: "Comment",
          argsPath: "args.include.posts.include.comments.include.replies",
          scope: {
            action: "include",
            model: "Comment",
            argsPath: "args.include.posts.include.comments",
            scope: {
              action: "include",
              model: "Post",
              argsPath: "args.include.posts",
            },
          },
        },
      ],
    },
    {
      description: "select in findUnique",
      rootParams: createParams("User", "findUnique", {
        where: { id: faker.datatype.number() },
        select: {
          posts: true,
        },
      }),
      calls: [
        {
          action: "select",
          model: "Post",
          argsPath: "args.select.posts",
        },
      ],
    },
    {
      description: "select in findFirst",
      rootParams: createParams("User", "findFirst", {
        where: { id: faker.datatype.number() },
        select: { posts: true },
      }),
      calls: [
        {
          action: "select",
          model: "Post",
          argsPath: "args.select.posts",
        },
      ],
    },
    {
      description: "select in findMany",
      rootParams: createParams("User", "findMany", {
        where: { id: faker.datatype.number() },
        select: { posts: true },
      }),
      calls: [
        {
          action: "select",
          model: "Post",
          argsPath: "args.select.posts",
        },
      ],
    },
    {
      description: "select in create",
      rootParams: createParams("User", "create", {
        data: {
          email: faker.internet.email(),
          posts: { create: { title: faker.lorem.sentence() } },
        },
        select: { posts: true },
      }),
      calls: [
        {
          action: "create",
          model: "Post",
          argsPath: "args.data.posts.create",
        },
        {
          action: "select",
          model: "Post",
          argsPath: "args.select.posts",
        },
      ],
    },
    {
      description: "select in update",
      rootParams: createParams("User", "update", {
        where: { id: faker.datatype.number() },
        data: {
          email: faker.internet.email(),
        },
        select: { posts: true },
      }),
      calls: [
        {
          action: "select",
          model: "Post",
          argsPath: "args.select.posts",
        },
      ],
    },
    {
      description: "select in upsert",
      rootParams: createParams("User", "upsert", {
        where: { id: faker.datatype.number() },
        create: {
          email: faker.internet.email(),
        },
        update: {
          email: faker.internet.email(),
        },
        select: { posts: true },
      }),
      calls: [
        {
          action: "select",
          model: "Post",
          argsPath: "args.select.posts",
        },
      ],
    },
    {
      description: "nested selects",
      rootParams: createParams("User", "findUnique", {
        where: { id: faker.datatype.number() },
        select: {
          posts: {
            select: {
              comments: true,
            },
          },
        },
      }),
      calls: [
        {
          action: "select",
          model: "Post",
          argsPath: "args.select.posts",
        },
        {
          action: "select",
          model: "Comment",
          argsPath: "args.select.posts.select.comments",
          scope: {
            action: "select",
            model: "Post",
            argsPath: "args.select.posts",
          },
        },
      ],
    },
    {
      description: "deeply nested selects",
      rootParams: createParams("User", "findUnique", {
        where: { id: faker.datatype.number() },
        select: {
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
      }),
      calls: [
        {
          action: "select",
          model: "Post",
          argsPath: "args.select.posts",
        },
        {
          action: "select",
          model: "Comment",
          argsPath: "args.select.posts.select.comments",
          scope: {
            action: "select",
            model: "Post",
            argsPath: "args.select.posts",
          },
        },
        {
          action: "select",
          model: "Comment",
          argsPath: "args.select.posts.select.comments.select.replies",

          scope: {
            action: "select",
            model: "Comment",
            argsPath: "args.select.posts.select.comments",

            scope: {
              action: "select",
              model: "Post",
              argsPath: "args.select.posts",
            },
          },
        },
      ],
    },
    {
      description: "deeply nested selects with custom fields",
      rootParams: createParams("User", "findUnique", {
        where: { id: faker.datatype.number() },
        select: {
          posts: {
            select: {
              title: true,
              comments: {
                select: {
                  content: true,
                  replies: {
                    select: {
                      content: true,
                      createdAt: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      calls: [
        {
          action: "select",
          model: "Post",
          argsPath: "args.select.posts",
        },
        {
          action: "select",
          model: "Comment",
          argsPath: "args.select.posts.select.comments",
          scope: {
            action: "select",
            model: "Post",
            argsPath: "args.select.posts",
          },
        },
        {
          action: "select",
          model: "Comment",
          argsPath: "args.select.posts.select.comments.select.replies",
          scope: {
            action: "select",
            model: "Comment",
            argsPath: "args.select.posts.select.comments",
            scope: {
              action: "select",
              model: "Post",
              argsPath: "args.select.posts",
            },
          },
        },
      ],
    },
    {
      description: "nested select in include",
      rootParams: createParams("User", "findUnique", {
        where: { id: faker.datatype.number() },
        include: {
          posts: {
            select: {
              comments: true,
            },
          },
        },
      }),
      calls: [
        {
          action: "include",
          model: "Post",
          argsPath: "args.include.posts",
        },
        {
          action: "select",
          model: "Post",
          argsPath: "args.include.posts.select",
        },
        {
          action: "select",
          model: "Comment",
          argsPath: "args.include.posts.select.comments",
          scope: {
            action: "include",
            model: "Post",
            argsPath: "args.include.posts",
          },
        },
      ],
    },
    {
      description: "nested include in select",
      rootParams: createParams("User", "findUnique", {
        where: { id: faker.datatype.number() },
        select: {
          posts: {
            include: {
              comments: true,
            },
          },
        },
      }),
      calls: [
        {
          action: "select",
          model: "Post",
          argsPath: "args.select.posts",
        },
        {
          action: "include",
          model: "Comment",
          argsPath: "args.select.posts.include.comments",
          scope: {
            action: "select",
            model: "Post",
            argsPath: "args.select.posts",
          },
        },
      ],
    },
    {
      description: "nested select in nested include",
      rootParams: createParams("User", "findUnique", {
        where: { id: faker.datatype.number() },
        include: {
          posts: {
            include: {
              comments: {
                select: {
                  content: true,
                },
              },
            },
          },
        },
      }),
      calls: [
        {
          action: "include",
          model: "Post",
          argsPath: "args.include.posts",
        },
        {
          action: "include",
          model: "Comment",
          argsPath: "args.include.posts.include.comments",
          scope: {
            action: "include",
            model: "Post",
            argsPath: "args.include.posts",
          },
        },
        {
          action: "select",
          model: "Comment",
          argsPath: "args.include.posts.include.comments.select",
          scope: {
            action: "include",
            model: "Post",
            argsPath: "args.include.posts",
          },
        },
      ],
    },
    {
      description: "nested include in nested select",
      rootParams: createParams("User", "findUnique", {
        where: { id: faker.datatype.number() },
        select: {
          posts: {
            select: {
              comments: {
                include: {
                  author: true,
                },
              },
            },
          },
        },
      }),
      calls: [
        {
          action: "select",
          model: "Post",
          argsPath: "args.select.posts",
        },
        {
          action: "select",
          model: "Comment",
          argsPath: "args.select.posts.select.comments",
          scope: {
            action: "select",
            model: "Post",
            argsPath: "args.select.posts",
          },
        },
        {
          action: "include",
          model: "User",
          argsPath: "args.select.posts.select.comments.include.author",
          scope: {
            action: "select",
            model: "Comment",
            argsPath: "args.select.posts.select.comments",
            scope: {
              action: "select",
              model: "Post",
              argsPath: "args.select.posts",
            },
          },
        },
      ],
    },
    {
      description: "nested includes with nested create",
      rootParams: createParams("User", "create", {
        data: {
          email: faker.internet.email(),
          posts: {
            create: {
              title: faker.lorem.sentence(),
              comments: {
                create: {
                  authorId: faker.datatype.number(),
                  content: faker.lorem.sentence(),
                },
              },
            },
          },
        },
        include: {
          posts: {
            include: {
              comments: true,
            },
          },
        },
      }),
      calls: [
        {
          action: "create",
          model: "Post",
          argsPath: "args.data.posts.create",
        },
        {
          action: "create",
          model: "Comment",
          argsPath: "args.data.posts.create.comments.create",
          scope: {
            action: "create",
            model: "Post",
            argsPath: "args.data.posts.create",
          },
        },
        {
          action: "include",
          model: "Post",
          argsPath: "args.include.posts",
        },
        {
          action: "include",
          model: "Comment",
          argsPath: "args.include.posts.include.comments",
          scope: {
            action: "include",
            model: "Post",
            argsPath: "args.include.posts",
          },
        },
      ],
    },
    {
      description: "nested selects with nested create",
      rootParams: createParams("User", "create", {
        data: {
          email: faker.internet.email(),
          posts: {
            create: {
              title: faker.lorem.sentence(),
              comments: {
                create: {
                  authorId: faker.datatype.number(),
                  content: faker.lorem.sentence(),
                },
              },
            },
          },
        },
        select: {
          posts: {
            select: {
              comments: true,
            },
          },
        },
      }),
      calls: [
        {
          action: "create",
          model: "Post",
          argsPath: "args.data.posts.create",
        },
        {
          action: "create",
          model: "Comment",
          argsPath: "args.data.posts.create.comments.create",
          scope: {
            action: "create",
            model: "Post",
            argsPath: "args.data.posts.create",
          },
        },
        {
          action: "select",
          model: "Post",
          argsPath: "args.select.posts",
        },
        {
          action: "select",
          model: "Comment",
          argsPath: "args.select.posts.select.comments",
          scope: {
            action: "select",
            model: "Post",
            argsPath: "args.select.posts",
          },
        },
      ],
    },
  ])("calls middleware with $description", async ({ rootParams, calls }) => {
    const middleware = jest.fn((params, next) => next(params));
    const nestedMiddleware = createNestedMiddleware(middleware);

    const next = (_: any) => Promise.resolve({});
    await nestedMiddleware(rootParams, next);

    expect(middleware).toHaveBeenCalledTimes(calls.length + 1);
    expect(middleware).toHaveBeenCalledWith(rootParams, next);
    calls.forEach((call) => {
      expect(middleware).toHaveBeenCalledWith(
        nestedParamsFromCall(rootParams, call),
        expect.any(Function)
      );
    });
  });
});
