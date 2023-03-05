import { Prisma } from "@prisma/client";
import faker from "faker";
import { get } from "lodash";

import { createNestedMiddleware, NestedParams } from "../src";
import { relationsByModel } from "../src/lib/createNestedMiddleware";
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
  relation?: Prisma.DMMF.Field;
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
    relation: call.relation,
    scope: call.scope
      ? nestedParamsFromCall(rootParams, call.scope)
      : rootParams,
  };
}

function getModelRelation<Model extends Prisma.ModelName>(
  model: Model,
  relationName: string
): Prisma.DMMF.Field | undefined {
  return relationsByModel[model].find(
    (relation) => relation.name === relationName
  );
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
          relation: getModelRelation("User", "profile"),
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
          relation: getModelRelation("User", "profile"),
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
          relation: getModelRelation("User", "profile"),
        },
        {
          action: "create",
          model: "Profile",
          argsPath: "args.update.profile.create",
          relation: getModelRelation("User", "profile"),
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "create",
          model: "Post",
          argsPath: "args.data.posts.create.1",
          relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "create",
          model: "Post",
          argsPath: "args.data.posts.create.1",
          relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "profile"),
        },
        {
          action: "create",
          model: "Post",
          argsPath: "args.data.posts.create.0",
          relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "create",
          model: "Post",
          argsPath: "args.create.posts.create.1",
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "create",
          model: "Post",
          argsPath: "args.update.posts.create.0",
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "create",
          model: "Post",
          argsPath: "args.update.posts.create.1",
          relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "profile"),
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
          relation: getModelRelation("User", "profile"),
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "update",
          model: "Post",
          argsPath: "args.data.posts.update.1",
          relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "update",
          model: "Post",
          argsPath: "args.update.posts.update.1",
          relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "profile"),
        },
      ],
    },
    {
      description: "nested upsert list in update",
      rootParams: createParams("User", "update", {
        where: { id: faker.datatype.number() },
        data: {
          email: faker.internet.email(),
          posts: {
            upsert: [
              {
                where: { id: faker.datatype.number() },
                update: { title: faker.lorem.sentence() },
                create: {
                  title: faker.lorem.sentence(),
                  content: faker.lorem.paragraph(),
                },
              },
              {
                where: { id: faker.datatype.number() },
                update: { title: faker.lorem.sentence() },
                create: {
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
          action: "upsert",
          model: "Post",
          argsPath: "args.data.posts.upsert.0",
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "upsert",
          model: "Post",
          argsPath: "args.data.posts.upsert.1",
          relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "profile"),
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
          relation: getModelRelation("User", "profile"),
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
          relation: getModelRelation("User", "profile"),
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "delete",
          model: "Post",
          argsPath: "args.data.posts.delete.1",
          relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "delete",
          model: "Post",
          argsPath: "args.update.posts.delete.1",
          relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
        },
      ],
    },

    {
      description: "nested updateMany array in update",
      rootParams: createParams("User", "update", {
        where: { id: faker.datatype.number() },
        data: {
          email: faker.internet.email(),
          posts: {
            updateMany: [
              {
                where: {
                  id: faker.datatype.number(),
                },
                data: {
                  title: faker.lorem.sentence(),
                  content: faker.lorem.paragraph(),
                },
              },
              {
                where: {
                  id: faker.datatype.number(),
                },
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
          action: "updateMany",
          model: "Post",
          argsPath: "args.data.posts.updateMany.0",
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "updateMany",
          model: "Post",
          argsPath: "args.data.posts.updateMany.1",
          relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
        },
      ],
    },
    {
      description: "nested updateMany list in upsert",
      rootParams: createParams("User", "upsert", {
        where: { id: faker.datatype.number() },
        create: {
          email: faker.internet.email(),
        },
        update: {
          email: faker.internet.email(),
          posts: {
            updateMany: [
              {
                where: { id: faker.datatype.number() },
                data: { title: faker.lorem.sentence() },
              },
              {
                where: { id: faker.datatype.number() },
                data: { title: faker.lorem.sentence() },
              },
            ],
          },
        },
      }),
      calls: [
        {
          action: "updateMany",
          model: "Post",
          argsPath: "args.update.posts.updateMany.0",
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "updateMany",
          model: "Post",
          argsPath: "args.update.posts.updateMany.1",
          relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
        },
      ],
    },
    {
      description: "nested deleteMany list in update",
      rootParams: createParams("User", "update", {
        where: { id: faker.datatype.number() },
        data: {
          email: faker.internet.email(),
          posts: {
            deleteMany: [
              { id: faker.datatype.number() },
              { id: faker.datatype.number() },
            ],
          },
        },
      }),
      calls: [
        {
          action: "deleteMany",
          model: "Post",
          argsPath: "args.data.posts.deleteMany.0",
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "deleteMany",
          model: "Post",
          argsPath: "args.data.posts.deleteMany.1",
          relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
        },
      ],
    },
    {
      description: "nested deleteMany list in upsert",
      rootParams: createParams("User", "upsert", {
        where: { id: faker.datatype.number() },
        create: {
          email: faker.internet.email(),
        },
        update: {
          email: faker.internet.email(),
          posts: {
            deleteMany: [
              { id: faker.datatype.number() },
              { id: faker.datatype.number() },
            ],
          },
        },
      }),
      calls: [
        {
          action: "deleteMany",
          model: "Post",
          argsPath: "args.update.posts.deleteMany.0",
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "deleteMany",
          model: "Post",
          argsPath: "args.update.posts.deleteMany.1",
          relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "profile"),
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
          relation: getModelRelation("User", "profile"),
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "create",
          model: "Comment",
          argsPath: "args.data.posts.create.comments.create",
          relation: getModelRelation("Post", "comments"),
          scope: {
            action: "create",
            model: "Post",
            argsPath: "args.data.posts.create",
            relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "update",
          model: "Comment",
          argsPath: "args.data.posts.update.data.comments.update",
          relation: getModelRelation("Post", "comments"),
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.data.posts.update",
            relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "delete",
          model: "Comment",
          argsPath: "args.data.posts.update.data.comments.delete.0",
          relation: getModelRelation("Post", "comments"),
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.data.posts.update",
            relation: getModelRelation("User", "posts"),
          },
        },
        {
          action: "delete",
          model: "Comment",
          argsPath: "args.data.posts.update.data.comments.delete.1",
          relation: getModelRelation("Post", "comments"),
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.data.posts.update",
            relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "upsert",
          model: "Comment",
          argsPath: "args.update.posts.update.data.comments.upsert",
          relation: getModelRelation("Post", "comments"),
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.update.posts.update",
            relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "createMany",
          model: "Comment",
          argsPath: "args.data.posts.update.data.comments.createMany",
          relation: getModelRelation("Post", "comments"),
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.data.posts.update",
            relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "updateMany",
          model: "Comment",
          argsPath: "args.data.posts.update.data.comments.updateMany",
          relation: getModelRelation("Post", "comments"),
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.data.posts.update",
            relation: getModelRelation("User", "posts"),
          },
        },
      ],
    },
    {
      description: "deeply nested updateMany array",
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
                  updateMany: [
                    {
                      where: { id: faker.datatype.number() },
                      data: { content: faker.lorem.paragraph() },
                    },
                    {
                      where: { id: faker.datatype.number() },
                      data: { content: faker.lorem.paragraph() },
                    },
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "updateMany",
          model: "Comment",
          argsPath: "args.data.posts.update.data.comments.updateMany.0",
          relation: getModelRelation("Post", "comments"),
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.data.posts.update",
            relation: getModelRelation("User", "posts"),
          },
        },
        {
          action: "updateMany",
          model: "Comment",
          argsPath: "args.data.posts.update.data.comments.updateMany.1",
          relation: getModelRelation("Post", "comments"),
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.data.posts.update",
            relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "deleteMany",
          model: "Comment",
          argsPath: "args.data.posts.update.data.comments.deleteMany",
          relation: getModelRelation("Post", "comments"),
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.data.posts.update",
            relation: getModelRelation("User", "posts"),
          },
        },
      ],
    },
    {
      description: "deeply nested deleteMany array",
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
                  deleteMany: [
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "deleteMany",
          model: "Comment",
          argsPath: "args.data.posts.update.data.comments.deleteMany.0",
          relation: getModelRelation("Post", "comments"),
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.data.posts.update",
            relation: getModelRelation("User", "posts"),
          },
        },
        {
          action: "deleteMany",
          model: "Comment",
          argsPath: "args.data.posts.update.data.comments.deleteMany.1",
          relation: getModelRelation("Post", "comments"),
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.data.posts.update",
            relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "connectOrCreate",
          model: "Comment",
          argsPath: "args.data.posts.update.data.comments.connectOrCreate",
          relation: getModelRelation("Post", "comments"),
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.data.posts.update",
            relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "include",
          model: "Post",
          argsPath: "args.include.posts",
          relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "include",
          model: "Comment",
          argsPath: "args.include.posts.include.comments",
          relation: getModelRelation("Post", "comments"),
          scope: {
            action: "include",
            model: "Post",
            argsPath: "args.include.posts",
            relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "include",
          model: "Comment",
          argsPath: "args.include.posts.include.comments",
          relation: getModelRelation("Post", "comments"),
          scope: {
            action: "include",
            model: "Post",
            argsPath: "args.include.posts",
            relation: getModelRelation("User", "posts"),
          },
        },
        {
          action: "include",
          model: "Comment",
          argsPath: "args.include.posts.include.comments.include.replies",
          relation: getModelRelation("Comment", "replies"),
          scope: {
            action: "include",
            model: "Comment",
            argsPath: "args.include.posts.include.comments",
            relation: getModelRelation("Post", "comments"),
            scope: {
              action: "include",
              model: "Post",
              argsPath: "args.include.posts",
              relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "select",
          model: "Post",
          argsPath: "args.select.posts",
          relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "select",
          model: "Comment",
          argsPath: "args.select.posts.select.comments",
          relation: getModelRelation("Post", "comments"),
          scope: {
            action: "select",
            model: "Post",
            argsPath: "args.select.posts",
            relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "select",
          model: "Comment",
          argsPath: "args.select.posts.select.comments",
          relation: getModelRelation("Post", "comments"),
          scope: {
            action: "select",
            model: "Post",
            argsPath: "args.select.posts",
            relation: getModelRelation("User", "posts"),
          },
        },
        {
          action: "select",
          model: "Comment",
          argsPath: "args.select.posts.select.comments.select.replies",
          relation: getModelRelation("Comment", "replies"),
          scope: {
            action: "select",
            model: "Comment",
            argsPath: "args.select.posts.select.comments",
            relation: getModelRelation("Post", "comments"),
            scope: {
              action: "select",
              model: "Post",
              argsPath: "args.select.posts",
              relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "select",
          model: "Comment",
          argsPath: "args.select.posts.select.comments",
          relation: getModelRelation("Post", "comments"),
          scope: {
            action: "select",
            model: "Post",
            argsPath: "args.select.posts",
            relation: getModelRelation("User", "posts"),
          },
        },
        {
          action: "select",
          model: "Comment",
          argsPath: "args.select.posts.select.comments.select.replies",
          relation: getModelRelation("Comment", "replies"),
          scope: {
            action: "select",
            model: "Comment",
            argsPath: "args.select.posts.select.comments",
            relation: getModelRelation("Post", "comments"),
            scope: {
              action: "select",
              model: "Post",
              argsPath: "args.select.posts",
              relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "select",
          model: "Post",
          argsPath: "args.include.posts.select",
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "select",
          model: "Comment",
          argsPath: "args.include.posts.select.comments",
          relation: getModelRelation("Post", "comments"),
          scope: {
            action: "include",
            model: "Post",
            argsPath: "args.include.posts",
            relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "include",
          model: "Comment",
          argsPath: "args.select.posts.include.comments",
          relation: getModelRelation("Post", "comments"),
          scope: {
            action: "select",
            model: "Post",
            argsPath: "args.select.posts",
            relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "include",
          model: "Comment",
          argsPath: "args.include.posts.include.comments",
          relation: getModelRelation("Post", "comments"),
          scope: {
            action: "include",
            model: "Post",
            argsPath: "args.include.posts",
            relation: getModelRelation("User", "posts"),
          },
        },
        {
          action: "select",
          model: "Comment",
          argsPath: "args.include.posts.include.comments.select",
          relation: getModelRelation("Post", "comments"),
          scope: {
            action: "include",
            model: "Post",
            argsPath: "args.include.posts",
            relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "select",
          model: "Comment",
          argsPath: "args.select.posts.select.comments",
          relation: getModelRelation("Post", "comments"),
          scope: {
            action: "select",
            model: "Post",
            argsPath: "args.select.posts",
            relation: getModelRelation("User", "posts"),
          },
        },
        {
          action: "include",
          model: "User",
          argsPath: "args.select.posts.select.comments.include.author",
          relation: getModelRelation("Comment", "author"),
          scope: {
            action: "select",
            model: "Comment",
            argsPath: "args.select.posts.select.comments",
            relation: getModelRelation("Post", "comments"),
            scope: {
              action: "select",
              model: "Post",
              argsPath: "args.select.posts",
              relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "create",
          model: "Comment",
          argsPath: "args.data.posts.create.comments.create",
          relation: getModelRelation("Post", "comments"),
          scope: {
            action: "create",
            model: "Post",
            argsPath: "args.data.posts.create",
            relation: getModelRelation("User", "posts"),
          },
        },
        {
          action: "include",
          model: "Post",
          argsPath: "args.include.posts",
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "include",
          model: "Comment",
          argsPath: "args.include.posts.include.comments",
          relation: getModelRelation("Post", "comments"),
          scope: {
            action: "include",
            model: "Post",
            argsPath: "args.include.posts",
            relation: getModelRelation("User", "posts"),
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
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "create",
          model: "Comment",
          argsPath: "args.data.posts.create.comments.create",
          relation: getModelRelation("Post", "comments"),
          scope: {
            action: "create",
            model: "Post",
            argsPath: "args.data.posts.create",
            relation: getModelRelation("User", "posts"),
          },
        },
        {
          action: "select",
          model: "Post",
          argsPath: "args.select.posts",
          relation: getModelRelation("User", "posts"),
        },
        {
          action: "select",
          model: "Comment",
          argsPath: "args.select.posts.select.comments",
          relation: getModelRelation("Post", "comments"),
          scope: {
            action: "select",
            model: "Post",
            argsPath: "args.select.posts",
            relation: getModelRelation("User", "posts"),
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
