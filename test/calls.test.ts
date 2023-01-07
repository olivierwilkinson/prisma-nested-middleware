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
    | "connectOrCreate";
  argsPath: string;
  scope?: MiddlewareCall<any>;
};

function nestedParamsFromCall<Model extends Prisma.ModelName>(
  rootParams: Prisma.MiddlewareParams,
  call: MiddlewareCall<Model>
): NestedParams {
  return {
    ...createParams(call.model, call.action, get(rootParams, call.argsPath)),
    scope: call.scope
      ? nestedParamsFromCall(rootParams, call.scope)
      : rootParams,
  };
}

describe("calls", () => {
  it("calls middleware once when there are no nested operations", async () => {
    const middleware = jest.fn((params, next) => next(params))
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
          argsPath: "args.data.posts.create",
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
          argsPath: "args.data.posts.create",
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
          argsPath: "args.create.posts.create",
        },
        {
          action: "create",
          model: "Post",
          argsPath: "args.update.posts.create",
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
          argsPath: "args.data.posts.update",
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
          argsPath: "args.update.posts.update",
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
          argsPath: "args.data.posts.delete",
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
          argsPath: "args.update.posts.delete",
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
          argsPath: "args.data.posts.update.data.comments.delete",
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
  ])("calls middleware with $description", async ({ rootParams, calls }) => {
    const middleware = jest.fn((params, next) => next(params));
    const nestedMiddleware = createNestedMiddleware(middleware);

    const next = (params: any) => params;
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
