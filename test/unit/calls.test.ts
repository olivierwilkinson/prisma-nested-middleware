import { Prisma } from "@prisma/client";
import faker from "faker";
import { get } from "lodash";

import { createNestedMiddleware, NestedParams } from "../../src";
import { relationsByModel } from "../../src/lib/utils/relations";
import { LogicalOperator, Modifier } from "../../src/lib/types";
import { createParams } from "./helpers/createParams";

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
    | "select"
    | "where"
    | "groupBy";
  argsPath: string;
  scope?: MiddlewareCall<any>;
  relations: {
    to: Prisma.DMMF.Field;
    from: Prisma.DMMF.Field;
  };
  modifier?: Modifier;
  logicalOperators?: LogicalOperator[];
};

function nestedParamsFromCall<Model extends Prisma.ModelName>(
  rootParams: Prisma.MiddlewareParams,
  call: MiddlewareCall<Model>
): NestedParams {
  const params = createParams(
    call.model,
    call.action,
    get(rootParams, call.argsPath)
  );
  return {
    ...params,
    scope: {
      modifier: call.modifier,
      logicalOperators: call.logicalOperators,
      relations: call.relations,
      parentParams: call.scope
        ? nestedParamsFromCall(rootParams, call.scope)
        : rootParams,
    },
  };
}

function getModelRelation<Model extends Prisma.ModelName>(
  model: Model,
  relationName: string
): Prisma.DMMF.Field {
  const modelRelation = relationsByModel[model].find(
    (relation) => relation.name === relationName
  );
  if (!modelRelation) {
    throw new Error(
      `Unable to find relation ${relationName} on model ${model}`
    );
  }
  return modelRelation;
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
    nestedCalls?: MiddlewareCall<any>[];
  }>([
    {
      description: "count",
      rootParams: createParams("User", "count", undefined),
    },
    {
      description: "aggregate",
      rootParams: createParams("User", "aggregate", {}),
    },
    {
      description: "groupBy",
      rootParams: createParams("User", "groupBy", {
        by: ["email"],
        orderBy: { email: "asc" },
      })
    },
    {
      description: "nested create in create",
      rootParams: createParams("User", "create", {
        data: {
          email: faker.internet.email(),
          profile: { create: { bio: faker.lorem.paragraph() } },
        },
      }),
      nestedCalls: [
        {
          action: "create",
          model: "Profile",
          argsPath: "args.data.profile.create",
          relations: {
            to: getModelRelation("User", "profile"),
            from: getModelRelation("Profile", "user"),
          },
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
      nestedCalls: [
        {
          action: "create",
          model: "Profile",
          argsPath: "args.data.profile.create",
          relations: {
            to: getModelRelation("User", "profile"),
            from: getModelRelation("Profile", "user"),
          },
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
      nestedCalls: [
        {
          action: "create",
          model: "Profile",
          argsPath: "args.create.profile.create",
          relations: {
            to: getModelRelation("User", "profile"),
            from: getModelRelation("Profile", "user"),
          },
        },
        {
          action: "create",
          model: "Profile",
          argsPath: "args.update.profile.create",
          relations: {
            to: getModelRelation("User", "profile"),
            from: getModelRelation("Profile", "user"),
          },
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
      nestedCalls: [
        {
          action: "create",
          model: "Post",
          argsPath: "args.data.posts.create.0",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "create",
          model: "Post",
          argsPath: "args.data.posts.create.1",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
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
      nestedCalls: [
        {
          action: "create",
          model: "Post",
          argsPath: "args.data.posts.create.0",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "create",
          model: "Post",
          argsPath: "args.data.posts.create.1",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
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
      nestedCalls: [
        {
          action: "update",
          model: "Profile",
          argsPath: "args.data.profile.update",
          relations: {
            to: getModelRelation("User", "profile"),
            from: getModelRelation("Profile", "user"),
          },
        },
        {
          action: "create",
          model: "Post",
          argsPath: "args.data.posts.create.0",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
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
      nestedCalls: [
        {
          action: "create",
          model: "Post",
          argsPath: "args.create.posts.create.0",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "create",
          model: "Post",
          argsPath: "args.create.posts.create.1",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "create",
          model: "Post",
          argsPath: "args.update.posts.create.0",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "create",
          model: "Post",
          argsPath: "args.update.posts.create.1",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
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
      nestedCalls: [
        {
          action: "update",
          model: "Profile",
          argsPath: "args.data.profile.update",
          relations: {
            to: getModelRelation("User", "profile"),
            from: getModelRelation("Profile", "user"),
          },
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
      nestedCalls: [
        {
          action: "update",
          model: "Profile",
          argsPath: "args.update.profile.update",
          relations: {
            to: getModelRelation("User", "profile"),
            from: getModelRelation("Profile", "user"),
          },
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
      nestedCalls: [
        {
          action: "update",
          model: "Post",
          argsPath: "args.data.posts.update.0",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "update",
          model: "Post",
          argsPath: "args.data.posts.update.1",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
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
      nestedCalls: [
        {
          action: "update",
          model: "Post",
          argsPath: "args.update.posts.update.0",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "update",
          model: "Post",
          argsPath: "args.update.posts.update.1",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
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
      nestedCalls: [
        {
          action: "upsert",
          model: "Profile",
          argsPath: "args.data.profile.upsert",
          relations: {
            to: getModelRelation("User", "profile"),
            from: getModelRelation("Profile", "user"),
          },
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
      nestedCalls: [
        {
          action: "upsert",
          model: "Post",
          argsPath: "args.data.posts.upsert.0",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "upsert",
          model: "Post",
          argsPath: "args.data.posts.upsert.1",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
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
      nestedCalls: [
        {
          action: "upsert",
          model: "Profile",
          argsPath: "args.update.profile.upsert",
          relations: {
            to: getModelRelation("User", "profile"),
            from: getModelRelation("Profile", "user"),
          },
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
      nestedCalls: [
        {
          action: "delete",
          model: "Profile",
          argsPath: "args.data.profile.delete",
          relations: {
            to: getModelRelation("User", "profile"),
            from: getModelRelation("Profile", "user"),
          },
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
      nestedCalls: [
        {
          action: "delete",
          model: "Profile",
          argsPath: "args.update.profile.delete",
          relations: {
            to: getModelRelation("User", "profile"),
            from: getModelRelation("Profile", "user"),
          },
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
      nestedCalls: [
        {
          action: "delete",
          model: "Post",
          argsPath: "args.data.posts.delete.0",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "delete",
          model: "Post",
          argsPath: "args.data.posts.delete.1",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
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
      nestedCalls: [
        {
          action: "delete",
          model: "Post",
          argsPath: "args.update.posts.delete.0",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "delete",
          model: "Post",
          argsPath: "args.update.posts.delete.1",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
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
      nestedCalls: [
        {
          action: "createMany",
          model: "Post",
          argsPath: "args.data.posts.createMany",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
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
      nestedCalls: [
        {
          action: "createMany",
          model: "Post",
          argsPath: "args.data.posts.createMany",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
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
      nestedCalls: [
        {
          action: "createMany",
          model: "Post",
          argsPath: "args.update.posts.createMany",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
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
      nestedCalls: [
        {
          action: "updateMany",
          model: "Post",
          argsPath: "args.data.posts.updateMany",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
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
      nestedCalls: [
        {
          action: "updateMany",
          model: "Post",
          argsPath: "args.data.posts.updateMany.0",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "updateMany",
          model: "Post",
          argsPath: "args.data.posts.updateMany.1",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
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
      nestedCalls: [
        {
          action: "updateMany",
          model: "Post",
          argsPath: "args.update.posts.updateMany",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
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
      nestedCalls: [
        {
          action: "updateMany",
          model: "Post",
          argsPath: "args.update.posts.updateMany.0",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "updateMany",
          model: "Post",
          argsPath: "args.update.posts.updateMany.1",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
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
      nestedCalls: [
        {
          action: "deleteMany",
          model: "Post",
          argsPath: "args.data.posts.deleteMany",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
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
      nestedCalls: [
        {
          action: "deleteMany",
          model: "Post",
          argsPath: "args.data.posts.deleteMany.0",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "deleteMany",
          model: "Post",
          argsPath: "args.data.posts.deleteMany.1",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
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
      nestedCalls: [
        {
          action: "deleteMany",
          model: "Post",
          argsPath: "args.update.posts.deleteMany",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
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
      nestedCalls: [
        {
          action: "deleteMany",
          model: "Post",
          argsPath: "args.update.posts.deleteMany.0",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "deleteMany",
          model: "Post",
          argsPath: "args.update.posts.deleteMany.1",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
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
      nestedCalls: [
        {
          action: "connectOrCreate",
          model: "Profile",
          argsPath: "args.data.profile.connectOrCreate",
          relations: {
            to: getModelRelation("User", "profile"),
            from: getModelRelation("Profile", "user"),
          },
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
      nestedCalls: [
        {
          action: "connectOrCreate",
          model: "Profile",
          argsPath: "args.update.profile.connectOrCreate",
          relations: {
            to: getModelRelation("User", "profile"),
            from: getModelRelation("Profile", "user"),
          },
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
      nestedCalls: [
        {
          action: "create",
          model: "Post",
          argsPath: "args.data.posts.create",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "create",
          model: "Comment",
          argsPath: "args.data.posts.create.comments.create",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "create",
            model: "Post",
            argsPath: "args.data.posts.create",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
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
      nestedCalls: [
        {
          action: "update",
          model: "Post",
          argsPath: "args.data.posts.update",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "update",
          model: "Comment",
          argsPath: "args.data.posts.update.data.comments.update",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.data.posts.update",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
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
      nestedCalls: [
        {
          action: "update",
          model: "Post",
          argsPath: "args.data.posts.update",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "delete",
          model: "Comment",
          argsPath: "args.data.posts.update.data.comments.delete.0",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.data.posts.update",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
          },
        },
        {
          action: "delete",
          model: "Comment",
          argsPath: "args.data.posts.update.data.comments.delete.1",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.data.posts.update",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
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
      nestedCalls: [
        {
          action: "update",
          model: "Post",
          argsPath: "args.update.posts.update",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "upsert",
          model: "Comment",
          argsPath: "args.update.posts.update.data.comments.upsert",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.update.posts.update",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
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
      nestedCalls: [
        {
          action: "update",
          model: "Post",
          argsPath: "args.data.posts.update",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "createMany",
          model: "Comment",
          argsPath: "args.data.posts.update.data.comments.createMany",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.data.posts.update",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
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
      nestedCalls: [
        {
          action: "update",
          model: "Post",
          argsPath: "args.data.posts.update",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "updateMany",
          model: "Comment",
          argsPath: "args.data.posts.update.data.comments.updateMany",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.data.posts.update",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
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
      nestedCalls: [
        {
          action: "update",
          model: "Post",
          argsPath: "args.data.posts.update",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "updateMany",
          model: "Comment",
          argsPath: "args.data.posts.update.data.comments.updateMany.0",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.data.posts.update",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
          },
        },
        {
          action: "updateMany",
          model: "Comment",
          argsPath: "args.data.posts.update.data.comments.updateMany.1",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.data.posts.update",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
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
      nestedCalls: [
        {
          action: "update",
          model: "Post",
          argsPath: "args.data.posts.update",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "deleteMany",
          model: "Comment",
          argsPath: "args.data.posts.update.data.comments.deleteMany",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.data.posts.update",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
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
      nestedCalls: [
        {
          action: "update",
          model: "Post",
          argsPath: "args.data.posts.update",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "deleteMany",
          model: "Comment",
          argsPath: "args.data.posts.update.data.comments.deleteMany.0",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.data.posts.update",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
          },
        },
        {
          action: "deleteMany",
          model: "Comment",
          argsPath: "args.data.posts.update.data.comments.deleteMany.1",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.data.posts.update",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
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
      nestedCalls: [
        {
          action: "update",
          model: "Post",
          argsPath: "args.data.posts.update",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "connectOrCreate",
          model: "Comment",
          argsPath: "args.data.posts.update.data.comments.connectOrCreate",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "update",
            model: "Post",
            argsPath: "args.data.posts.update",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
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
      nestedCalls: [
        {
          action: "include",
          model: "Post",
          argsPath: "args.include.posts",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
      ],
    },
    {
      description: "include in findFirst",
      rootParams: createParams("User", "findFirst", {
        where: { id: faker.datatype.number() },
        include: { posts: true },
      }),
      nestedCalls: [
        {
          action: "include",
          model: "Post",
          argsPath: "args.include.posts",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
      ],
    },
    {
      description: "include in findMany",
      rootParams: createParams("User", "findMany", {
        where: { id: faker.datatype.number() },
        include: { posts: true },
      }),
      nestedCalls: [
        {
          action: "include",
          model: "Post",
          argsPath: "args.include.posts",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
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
      nestedCalls: [
        {
          action: "create",
          model: "Post",
          argsPath: "args.data.posts.create",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "include",
          model: "Post",
          argsPath: "args.include.posts",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
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
      nestedCalls: [
        {
          action: "include",
          model: "Post",
          argsPath: "args.include.posts",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
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
      nestedCalls: [
        {
          action: "include",
          model: "Post",
          argsPath: "args.include.posts",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
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
      nestedCalls: [
        {
          action: "include",
          model: "Post",
          argsPath: "args.include.posts",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "include",
          model: "Comment",
          argsPath: "args.include.posts.include.comments",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "include",
            model: "Post",
            argsPath: "args.include.posts",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
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
      nestedCalls: [
        {
          action: "include",
          model: "Post",
          argsPath: "args.include.posts",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "include",
          model: "Comment",
          argsPath: "args.include.posts.include.comments",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "include",
            model: "Post",
            argsPath: "args.include.posts",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
          },
        },
        {
          action: "include",
          model: "Comment",
          argsPath: "args.include.posts.include.comments.include.replies",
          relations: {
            to: getModelRelation("Comment", "replies"),
            from: getModelRelation("Comment", "repliedTo"),
          },
          scope: {
            action: "include",
            model: "Comment",
            argsPath: "args.include.posts.include.comments",
            relations: {
              to: getModelRelation("Post", "comments"),
              from: getModelRelation("Comment", "post"),
            },
            scope: {
              action: "include",
              model: "Post",
              argsPath: "args.include.posts",
              relations: {
                to: getModelRelation("User", "posts"),
                from: getModelRelation("Post", "author"),
              },
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
      nestedCalls: [
        {
          action: "select",
          model: "Post",
          argsPath: "args.select.posts",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
      ],
    },
    {
      description: "select in findFirst",
      rootParams: createParams("User", "findFirst", {
        where: { id: faker.datatype.number() },
        select: { posts: true },
      }),
      nestedCalls: [
        {
          action: "select",
          model: "Post",
          argsPath: "args.select.posts",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
      ],
    },
    {
      description: "select in findMany",
      rootParams: createParams("User", "findMany", {
        where: { id: faker.datatype.number() },
        select: { posts: true },
      }),
      nestedCalls: [
        {
          action: "select",
          model: "Post",
          argsPath: "args.select.posts",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
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
      nestedCalls: [
        {
          action: "create",
          model: "Post",
          argsPath: "args.data.posts.create",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "select",
          model: "Post",
          argsPath: "args.select.posts",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
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
      nestedCalls: [
        {
          action: "select",
          model: "Post",
          argsPath: "args.select.posts",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
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
      nestedCalls: [
        {
          action: "select",
          model: "Post",
          argsPath: "args.select.posts",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
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
      nestedCalls: [
        {
          action: "select",
          model: "Post",
          argsPath: "args.select.posts",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "select",
          model: "Comment",
          argsPath: "args.select.posts.select.comments",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "select",
            model: "Post",
            argsPath: "args.select.posts",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
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
      nestedCalls: [
        {
          action: "select",
          model: "Post",
          argsPath: "args.select.posts",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "select",
          model: "Comment",
          argsPath: "args.select.posts.select.comments",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "select",
            model: "Post",
            argsPath: "args.select.posts",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
          },
        },
        {
          action: "select",
          model: "Comment",
          argsPath: "args.select.posts.select.comments.select.replies",
          relations: {
            to: getModelRelation("Comment", "replies"),
            from: getModelRelation("Comment", "repliedTo"),
          },
          scope: {
            action: "select",
            model: "Comment",
            argsPath: "args.select.posts.select.comments",
            relations: {
              to: getModelRelation("Post", "comments"),
              from: getModelRelation("Comment", "post"),
            },
            scope: {
              action: "select",
              model: "Post",
              argsPath: "args.select.posts",
              relations: {
                to: getModelRelation("User", "posts"),
                from: getModelRelation("Post", "author"),
              },
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
      nestedCalls: [
        {
          action: "select",
          model: "Post",
          argsPath: "args.select.posts",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "select",
          model: "Comment",
          argsPath: "args.select.posts.select.comments",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "select",
            model: "Post",
            argsPath: "args.select.posts",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
          },
        },
        {
          action: "select",
          model: "Comment",
          argsPath: "args.select.posts.select.comments.select.replies",
          relations: {
            to: getModelRelation("Comment", "replies"),
            from: getModelRelation("Comment", "repliedTo"),
          },
          scope: {
            action: "select",
            model: "Comment",
            argsPath: "args.select.posts.select.comments",
            relations: {
              to: getModelRelation("Post", "comments"),
              from: getModelRelation("Comment", "post"),
            },
            scope: {
              action: "select",
              model: "Post",
              argsPath: "args.select.posts",
              relations: {
                to: getModelRelation("User", "posts"),
                from: getModelRelation("Post", "author"),
              },
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
      nestedCalls: [
        {
          action: "include",
          model: "Post",
          argsPath: "args.include.posts",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "select",
          model: "Post",
          argsPath: "args.include.posts.select",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
          scope: {
            action: "include",
            model: "Post",
            argsPath: "args.include.posts",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
          },
        },
        {
          action: "select",
          model: "Comment",
          argsPath: "args.include.posts.select.comments",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "include",
            model: "Post",
            argsPath: "args.include.posts",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
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
      nestedCalls: [
        {
          action: "select",
          model: "Post",
          argsPath: "args.select.posts",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "include",
          model: "Comment",
          argsPath: "args.select.posts.include.comments",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "select",
            model: "Post",
            argsPath: "args.select.posts",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
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
      nestedCalls: [
        {
          action: "include",
          model: "Post",
          argsPath: "args.include.posts",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "include",
          model: "Comment",
          argsPath: "args.include.posts.include.comments",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "include",
            model: "Post",
            argsPath: "args.include.posts",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
          },
        },
        {
          action: "select",
          model: "Comment",
          argsPath: "args.include.posts.include.comments.select",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "include",
            model: "Comment",
            argsPath: "args.include.posts.include.comments",
            relations: {
              to: getModelRelation("Post", "comments"),
              from: getModelRelation("Comment", "post"),
            },
            scope: {
              action: "include",
              model: "Post",
              argsPath: "args.include.posts",
              relations: {
                to: getModelRelation("User", "posts"),
                from: getModelRelation("Post", "author"),
              },
            },
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
      nestedCalls: [
        {
          action: "select",
          model: "Post",
          argsPath: "args.select.posts",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "select",
          model: "Comment",
          argsPath: "args.select.posts.select.comments",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "select",
            model: "Post",
            argsPath: "args.select.posts",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
          },
        },
        {
          action: "include",
          model: "User",
          argsPath: "args.select.posts.select.comments.include.author",
          relations: {
            to: getModelRelation("Comment", "author"),
            from: getModelRelation("User", "comments"),
          },
          scope: {
            action: "select",
            model: "Comment",
            argsPath: "args.select.posts.select.comments",
            relations: {
              to: getModelRelation("Post", "comments"),
              from: getModelRelation("Comment", "post"),
            },
            scope: {
              action: "select",
              model: "Post",
              argsPath: "args.select.posts",
              relations: {
                to: getModelRelation("User", "posts"),
                from: getModelRelation("Post", "author"),
              },
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
      nestedCalls: [
        {
          action: "create",
          model: "Post",
          argsPath: "args.data.posts.create",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "create",
          model: "Comment",
          argsPath: "args.data.posts.create.comments.create",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "create",
            model: "Post",
            argsPath: "args.data.posts.create",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
          },
        },
        {
          action: "include",
          model: "Post",
          argsPath: "args.include.posts",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "include",
          model: "Comment",
          argsPath: "args.include.posts.include.comments",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "include",
            model: "Post",
            argsPath: "args.include.posts",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
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
      nestedCalls: [
        {
          action: "create",
          model: "Post",
          argsPath: "args.data.posts.create",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "create",
          model: "Comment",
          argsPath: "args.data.posts.create.comments.create",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "create",
            model: "Post",
            argsPath: "args.data.posts.create",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
          },
        },
        {
          action: "select",
          model: "Post",
          argsPath: "args.select.posts",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "select",
          model: "Comment",
          argsPath: "args.select.posts.select.comments",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "select",
            model: "Post",
            argsPath: "args.select.posts",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
          },
        },
      ],
    },
    {
      description: "nested where",
      rootParams: createParams("User", "findMany", {
        where: {
          profile: {
            bio: {
              contains: "foo",
            },
          },
        },
      }),
      nestedCalls: [
        {
          action: "where",
          model: "Profile",
          argsPath: "args.where.profile",
          relations: {
            to: getModelRelation("User", "profile"),
            from: getModelRelation("Profile", "user"),
          },
        },
      ],
    },
    {
      description: "nested where with list modifier",
      rootParams: createParams("User", "findMany", {
        where: {
          posts: {
            some: {
              title: {
                contains: "foo",
              },
            },
          },
        },
      }),
      nestedCalls: [
        {
          action: "where",
          model: "Post",
          argsPath: "args.where.posts.some",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
          modifier: "some",
        },
      ],
    },
    {
      description: "nested where with multiple list modifiers",
      rootParams: createParams("User", "findMany", {
        where: {
          posts: {
            none: {
              title: "foo",
            },
            every: {
              title: "bar",
            },
          },
        },
      }),
      nestedCalls: [
        {
          action: "where",
          model: "Post",
          argsPath: "args.where.posts.none",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
          modifier: "none",
        },
        {
          action: "where",
          model: "Post",
          argsPath: "args.where.posts.every",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
          modifier: "every",
        },
      ],
    },
    {
      description: "nested where with 'is' modifier",
      rootParams: createParams("User", "findMany", {
        where: {
          profile: {
            is: {
              bio: {
                contains: "foo",
              },
            },
          },
        },
      }),
      nestedCalls: [
        {
          action: "where",
          model: "Profile",
          argsPath: "args.where.profile.is",
          modifier: "is",
          relations: {
            to: getModelRelation("User", "profile"),
            from: getModelRelation("Profile", "user"),
          },
        },
      ],
    },
    {
      description: "nested where with 'isNot' modifier",
      rootParams: createParams("User", "findMany", {
        where: {
          profile: {
            isNot: {
              bio: {
                contains: "foo",
              },
            },
          },
        },
      }),
      nestedCalls: [
        {
          action: "where",
          model: "Profile",
          argsPath: "args.where.profile.isNot",
          modifier: "isNot",
          relations: {
            to: getModelRelation("User", "profile"),
            from: getModelRelation("Profile", "user"),
          },
        },
      ],
    },
    {
      description: "two nested where calls from two relations on same parent",
      rootParams: createParams("User", "findMany", {
        where: {
          profile: {
            bio: {
              contains: "foo",
            },
          },
          posts: {
            some: {
              title: {
                contains: "foo",
              },
            },
          },
        },
      }),
      nestedCalls: [
        {
          action: "where",
          model: "Profile",
          argsPath: "args.where.profile",
          relations: {
            to: getModelRelation("User", "profile"),
            from: getModelRelation("Profile", "user"),
          },
        },
        {
          action: "where",
          model: "Post",
          argsPath: "args.where.posts.some",
          modifier: "some",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
      ],
    },
    {
      description: "deeply nested where",
      rootParams: createParams("User", "findMany", {
        where: {
          profile: {
            user: { name: "foo" },
          },
        },
      }),
      nestedCalls: [
        {
          action: "where",
          model: "Profile",
          argsPath: "args.where.profile",
          relations: {
            to: getModelRelation("User", "profile"),
            from: getModelRelation("Profile", "user"),
          },
        },
        {
          action: "where",
          model: "User",
          argsPath: "args.where.profile.user",
          relations: {
            to: getModelRelation("Profile", "user"),
            from: getModelRelation("User", "profile"),
          },
          scope: {
            action: "where",
            model: "Profile",
            argsPath: "args.where.profile",
            relations: {
              to: getModelRelation("User", "profile"),
              from: getModelRelation("Profile", "user"),
            },
          },
        },
      ],
    },
    {
      description: "where nested in 'some' modifier",
      rootParams: createParams("User", "findMany", {
        where: {
          posts: {
            some: {
              author: {
                name: "foo",
              },
            },
          },
        },
      }),
      nestedCalls: [
        {
          action: "where",
          model: "Post",
          argsPath: "args.where.posts.some",
          modifier: "some",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "where",
          model: "User",
          argsPath: "args.where.posts.some.author",
          relations: {
            to: getModelRelation("Post", "author"),
            from: getModelRelation("User", "posts"),
          },
          scope: {
            action: "where",
            model: "Post",
            argsPath: "args.where.posts.some",
            modifier: "some",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
          },
        },
      ],
    },
    {
      description: "where nested in 'none' modifier",
      rootParams: createParams("User", "findMany", {
        where: {
          posts: {
            none: {
              author: {
                name: "foo",
              },
            },
          },
        },
      }),
      nestedCalls: [
        {
          action: "where",
          model: "Post",
          argsPath: "args.where.posts.none",
          modifier: "none",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "where",
          model: "User",
          argsPath: "args.where.posts.none.author",
          relations: {
            to: getModelRelation("Post", "author"),
            from: getModelRelation("User", "posts"),
          },
          scope: {
            action: "where",
            model: "Post",
            argsPath: "args.where.posts.none",
            modifier: "none",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
          },
        },
      ],
    },
    {
      description: "where nested in 'every' modifier",
      rootParams: createParams("User", "findMany", {
        where: {
          posts: {
            every: {
              author: {
                name: "foo",
              },
            },
          },
        },
      }),
      nestedCalls: [
        {
          action: "where",
          model: "Post",
          argsPath: "args.where.posts.every",
          modifier: "every",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "where",
          model: "User",
          argsPath: "args.where.posts.every.author",
          relations: {
            to: getModelRelation("Post", "author"),
            from: getModelRelation("User", "posts"),
          },
          scope: {
            action: "where",
            model: "Post",
            argsPath: "args.where.posts.every",
            modifier: "every",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
          },
        },
      ],
    },
    {
      description: "where nested in 'is' modifier",
      rootParams: createParams("User", "findMany", {
        where: {
          profile: {
            is: {
              user: {
                name: "foo",
              },
            },
          },
        },
      }),
      nestedCalls: [
        {
          action: "where",
          model: "Profile",
          argsPath: "args.where.profile.is",
          modifier: "is",
          relations: {
            to: getModelRelation("User", "profile"),
            from: getModelRelation("Profile", "user"),
          },
        },
        {
          action: "where",
          model: "User",
          argsPath: "args.where.profile.is.user",
          relations: {
            to: getModelRelation("Profile", "user"),
            from: getModelRelation("User", "profile"),
          },
          scope: {
            action: "where",
            model: "Profile",
            argsPath: "args.where.profile.is",
            modifier: "is",
            relations: {
              to: getModelRelation("User", "profile"),
              from: getModelRelation("Profile", "user"),
            },
          },
        },
      ],
    },
    {
      description: "where nested in 'isNot' modifier",
      rootParams: createParams("User", "findMany", {
        where: {
          profile: {
            isNot: {
              user: {
                name: "foo",
              },
            },
          },
        },
      }),
      nestedCalls: [
        {
          action: "where",
          model: "Profile",
          argsPath: "args.where.profile.isNot",
          modifier: "isNot",
          relations: {
            to: getModelRelation("User", "profile"),
            from: getModelRelation("Profile", "user"),
          },
        },
        {
          action: "where",
          model: "User",
          argsPath: "args.where.profile.isNot.user",
          relations: {
            to: getModelRelation("Profile", "user"),
            from: getModelRelation("User", "profile"),
          },
          scope: {
            action: "where",
            model: "Profile",
            argsPath: "args.where.profile.isNot",
            modifier: "isNot",
            relations: {
              to: getModelRelation("User", "profile"),
              from: getModelRelation("Profile", "user"),
            },
          },
        },
      ],
    },
    {
      description: "where nested in AND logical operator",
      rootParams: createParams("User", "findMany", {
        where: {
          AND: [
            {
              posts: {
                some: {
                  content: "foo",
                },
              },
            },
            {
              comments: {
                some: {
                  content: "bar",
                },
              },
            },
          ],
        },
      }),
      nestedCalls: [
        {
          action: "where",
          model: "Post",
          argsPath: "args.where.AND.0.posts.some",
          modifier: "some",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
          logicalOperators: ["AND"],
        },
        {
          action: "where",
          model: "Comment",
          argsPath: "args.where.AND.1.comments.some",
          modifier: "some",
          relations: {
            to: getModelRelation("User", "comments"),
            from: getModelRelation("Comment", "author"),
          },
          logicalOperators: ["AND"],
        },
      ],
    },
    {
      description: "where nested in OR logical operator",
      rootParams: createParams("User", "findMany", {
        where: {
          OR: [
            {
              posts: {
                some: {
                  content: "foo",
                },
              },
            },
            {
              comments: {
                some: {
                  content: "bar",
                },
              },
            },
          ],
        },
      }),
      nestedCalls: [
        {
          action: "where",
          model: "Post",
          argsPath: "args.where.OR.0.posts.some",
          modifier: "some",
          logicalOperators: ["OR"],
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "where",
          model: "Comment",
          argsPath: "args.where.OR.1.comments.some",
          modifier: "some",
          logicalOperators: ["OR"],
          relations: {
            to: getModelRelation("User", "comments"),
            from: getModelRelation("Comment", "author"),
          },
        },
      ],
    },
    {
      description: "where nested in NOT logical operator",
      rootParams: createParams("User", "findMany", {
        where: {
          NOT: [
            {
              posts: {
                some: {
                  content: "foo",
                },
              },
            },
            {
              comments: {
                some: {
                  content: "bar",
                },
              },
            },
          ],
        },
      }),
      nestedCalls: [
        {
          action: "where",
          model: "Post",
          argsPath: "args.where.NOT.0.posts.some",
          modifier: "some",
          logicalOperators: ["NOT"],
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "where",
          model: "Comment",
          argsPath: "args.where.NOT.1.comments.some",
          modifier: "some",
          logicalOperators: ["NOT"],
          relations: {
            to: getModelRelation("User", "comments"),
            from: getModelRelation("Comment", "author"),
          },
        },
      ],
    },
    {
      description: "where nested in NOT, AND and OR logical operator",
      rootParams: createParams("User", "findMany", {
        where: {
          NOT: [
            {
              posts: {
                some: {
                  content: "foo",
                },
              },
            },
          ],
          AND: [
            {
              comments: {
                some: {
                  content: "bar",
                },
              },
            },
          ],
          OR: [
            {
              profile: {
                bio: "baz",
              },
            },
          ],
        },
      }),
      nestedCalls: [
        {
          action: "where",
          model: "Post",
          argsPath: "args.where.NOT.0.posts.some",
          modifier: "some",
          logicalOperators: ["NOT"],
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "where",
          model: "Comment",
          argsPath: "args.where.AND.0.comments.some",
          modifier: "some",
          logicalOperators: ["AND"],
          relations: {
            to: getModelRelation("User", "comments"),
            from: getModelRelation("Comment", "author"),
          },
        },
        {
          action: "where",
          model: "Profile",
          argsPath: "args.where.OR.0.profile",
          logicalOperators: ["OR"],
          relations: {
            to: getModelRelation("User", "profile"),
            from: getModelRelation("Profile", "user"),
          },
        },
      ],
    },
    {
      description: "where deeply nested in logical modifiers",
      rootParams: createParams("User", "findMany", {
        where: {
          NOT: [
            {
              posts: {
                some: {
                  AND: [{ author: { OR: [{ name: "foo" }, { name: "bar" }] } }],
                },
              },
            },
          ],
        },
      }),
      nestedCalls: [
        {
          action: "where",
          model: "Post",
          argsPath: "args.where.NOT.0.posts.some",
          modifier: "some",
          logicalOperators: ["NOT"],
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "where",
          model: "User",
          argsPath: "args.where.NOT.0.posts.some.AND.0.author",
          logicalOperators: ["AND"],
          relations: {
            to: getModelRelation("Post", "author"),
            from: getModelRelation("User", "posts"),
          },
          scope: {
            action: "where",
            model: "Post",
            argsPath: "args.where.NOT.0.posts.some",
            modifier: "some",
            logicalOperators: ["NOT"],
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
          },
        },
      ],
    },
    {
      description:
        "where deeply nested in logical operators with no interim relations",
      rootParams: createParams("User", "findMany", {
        where: {
          NOT: {
            AND: [
              {
                NOT: {
                  name: "foo",
                  profile: {
                    bio: "bar",
                  },
                },
              },
              {
                OR: [
                  {
                    name: "foo",
                  },
                  {
                    name: "bar",
                    comments: {
                      some: {
                        content: "baz",
                      },
                    },
                  },
                ],
              },
            ],
          },
        },
      }),
      nestedCalls: [
        {
          action: "where",
          model: "Profile",
          argsPath: "args.where.NOT.AND.0.NOT.profile",
          logicalOperators: ["NOT", "AND", "NOT"],
          relations: {
            to: getModelRelation("User", "profile"),
            from: getModelRelation("Profile", "user"),
          },
        },
        {
          action: "where",
          model: "Comment",
          argsPath: "args.where.NOT.AND.1.OR.1.comments.some",
          modifier: "some",
          logicalOperators: ["NOT", "AND", "OR"],
          relations: {
            to: getModelRelation("User", "comments"),
            from: getModelRelation("Comment", "author"),
          },
        },
      ],
    },
    {
      description: "include where",
      rootParams: createParams("User", "findMany", {
        include: {
          posts: {
            where: {
              title: "foo",
            },
          },
        },
      }),
      nestedCalls: [
        {
          action: "include",
          model: "Post",
          argsPath: "args.include.posts",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "where",
          model: "Post",
          argsPath: "args.include.posts.where",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
          scope: {
            action: "include",
            model: "Post",
            argsPath: "args.include.posts",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
          },
        },
      ],
    },
    {
      description: "select where",
      rootParams: createParams("User", "findMany", {
        select: {
          posts: {
            where: {
              title: "foo",
            },
          },
        },
      }),
      nestedCalls: [
        {
          action: "select",
          model: "Post",
          argsPath: "args.select.posts",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "where",
          model: "Post",
          argsPath: "args.select.posts.where",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
          scope: {
            action: "select",
            model: "Post",
            argsPath: "args.select.posts",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
          },
        },
      ],
    },
    {
      description: "select in include where",
      rootParams: createParams("User", "findMany", {
        include: {
          posts: {
            select: {
              comments: {
                where: {
                  content: "foo",
                },
              },
            },
          },
        },
      }),
      nestedCalls: [
        {
          action: "include",
          model: "Post",
          argsPath: "args.include.posts",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "select",
          model: "Post",
          argsPath: "args.include.posts.select",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
          scope: {
            action: "include",
            model: "Post",
            argsPath: "args.include.posts",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
          },
        },
        {
          action: "select",
          model: "Comment",
          argsPath: "args.include.posts.select.comments",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "include",
            model: "Post",
            argsPath: "args.include.posts",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
          },
        },
        {
          action: "where",
          model: "Comment",
          argsPath: "args.include.posts.select.comments.where",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "select",
            model: "Comment",
            argsPath: "args.include.posts.select.comments",
            relations: {
              to: getModelRelation("Post", "comments"),
              from: getModelRelation("Comment", "post"),
            },
            scope: {
              action: "include",
              model: "Post",
              argsPath: "args.include.posts",
              relations: {
                to: getModelRelation("User", "posts"),
                from: getModelRelation("Post", "author"),
              },
            },
          },
        },
      ],
    },
    {
      description: "multiple include wheres",
      rootParams: createParams("User", "findMany", {
        include: {
          posts: {
            where: {
              title: "foo",
            },
            include: {
              comments: {
                where: {
                  content: "foo",
                },
              },
            },
          },
        },
      }),
      nestedCalls: [
        {
          action: "include",
          model: "Post",
          argsPath: "args.include.posts",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "where",
          model: "Post",
          argsPath: "args.include.posts.where",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
          scope: {
            action: "include",
            model: "Post",
            argsPath: "args.include.posts",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
          },
        },
        {
          action: "include",
          model: "Comment",
          argsPath: "args.include.posts.include.comments",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "include",
            model: "Post",
            argsPath: "args.include.posts",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
          },
        },
        {
          action: "where",
          model: "Comment",
          argsPath: "args.include.posts.include.comments.where",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "include",
            model: "Comment",
            argsPath: "args.include.posts.include.comments",
            relations: {
              to: getModelRelation("Post", "comments"),
              from: getModelRelation("Comment", "post"),
            },
            scope: {
              action: "include",
              model: "Post",
              argsPath: "args.include.posts",
              relations: {
                to: getModelRelation("User", "posts"),
                from: getModelRelation("Post", "author"),
              },
            },
          },
        },
      ],
    },
    {
      description: "multiple select wheres",
      rootParams: createParams("User", "findMany", {
        select: {
          posts: {
            where: {
              title: "foo",
            },
            select: {
              comments: {
                where: {
                  content: "foo",
                },
              },
            },
          },
        },
      }),
      nestedCalls: [
        {
          action: "select",
          model: "Post",
          argsPath: "args.select.posts",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "where",
          model: "Post",
          argsPath: "args.select.posts.where",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
          scope: {
            action: "select",
            model: "Post",
            argsPath: "args.select.posts",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
          },
        },
        {
          action: "select",
          model: "Comment",
          argsPath: "args.select.posts.select.comments",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "select",
            model: "Post",
            argsPath: "args.select.posts",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
          },
        },
        {
          action: "where",
          model: "Comment",
          argsPath: "args.select.posts.select.comments.where",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          scope: {
            action: "select",
            model: "Comment",
            argsPath: "args.select.posts.select.comments",
            relations: {
              to: getModelRelation("Post", "comments"),
              from: getModelRelation("Comment", "post"),
            },
            scope: {
              action: "select",
              model: "Post",
              argsPath: "args.select.posts",
              relations: {
                to: getModelRelation("User", "posts"),
                from: getModelRelation("Post", "author"),
              },
            },
          },
        },
      ],
    },
    {
      description: "include where with nested relations",
      rootParams: createParams("User", "findMany", {
        include: {
          posts: {
            where: {
              title: "foo",
              comments: {
                some: {
                  content: "bar",
                  repliedTo: {
                    is: {
                      content: "baz",
                      author: {
                        id: 1,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      nestedCalls: [
        {
          action: "include",
          model: "Post",
          argsPath: "args.include.posts",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
        {
          action: "where",
          model: "Post",
          argsPath: "args.include.posts.where",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
          scope: {
            action: "include",
            model: "Post",
            argsPath: "args.include.posts",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
          },
        },
        {
          action: "where",
          model: "Comment",
          argsPath: "args.include.posts.where.comments.some",
          relations: {
            to: getModelRelation("Post", "comments"),
            from: getModelRelation("Comment", "post"),
          },
          modifier: "some",
          scope: {
            action: "where",
            model: "Post",
            argsPath: "args.include.posts.where",
            relations: {
              to: getModelRelation("User", "posts"),
              from: getModelRelation("Post", "author"),
            },
            scope: {
              action: "include",
              model: "Post",
              argsPath: "args.include.posts",
              relations: {
                to: getModelRelation("User", "posts"),
                from: getModelRelation("Post", "author"),
              },
            },
          },
        },
        {
          action: "where",
          model: "Comment",
          argsPath: "args.include.posts.where.comments.some.repliedTo.is",
          relations: {
            to: getModelRelation("Comment", "repliedTo"),
            from: getModelRelation("Comment", "replies"),
          },
          modifier: "is",
          scope: {
            action: "where",
            model: "Comment",
            argsPath: "args.include.posts.where.comments.some",
            relations: {
              to: getModelRelation("Post", "comments"),
              from: getModelRelation("Comment", "post"),
            },
            modifier: "some",
            scope: {
              action: "where",
              model: "Post",
              argsPath: "args.include.posts.where",
              relations: {
                to: getModelRelation("User", "posts"),
                from: getModelRelation("Post", "author"),
              },
              scope: {
                action: "include",
                model: "Post",
                argsPath: "args.include.posts",
                relations: {
                  to: getModelRelation("User", "posts"),
                  from: getModelRelation("Post", "author"),
                },
              },
            },
          },
        },
        {
          action: "where",
          model: "User",
          argsPath:
            "args.include.posts.where.comments.some.repliedTo.is.author",
          relations: {
            to: getModelRelation("Comment", "author"),
            from: getModelRelation("User", "comments"),
          },
          scope: {
            action: "where",
            model: "Comment",
            argsPath: "args.include.posts.where.comments.some.repliedTo.is",
            relations: {
              to: getModelRelation("Comment", "repliedTo"),
              from: getModelRelation("Comment", "replies"),
            },
            modifier: "is",
            scope: {
              action: "where",
              model: "Comment",
              argsPath: "args.include.posts.where.comments.some",
              relations: {
                to: getModelRelation("Post", "comments"),
                from: getModelRelation("Comment", "post"),
              },
              modifier: "some",
              scope: {
                action: "where",
                model: "Post",
                argsPath: "args.include.posts.where",
                relations: {
                  to: getModelRelation("User", "posts"),
                  from: getModelRelation("Post", "author"),
                },
                scope: {
                  action: "include",
                  model: "Post",
                  argsPath: "args.include.posts",
                  relations: {
                    to: getModelRelation("User", "posts"),
                    from: getModelRelation("Post", "author"),
                  },
                },
              },
            },
          },
        },
      ],
    },
    {
      description: "where in groupBy",
      rootParams: createParams("User", "groupBy", {
        by: ["id"],
        orderBy: { id: "asc" },
        where: {
          posts: {
            some: {
              title: "foo",
            },
          },
        },
      }),
      nestedCalls: [
        {
          action: "where",
          model: "Post",
          argsPath: "args.where.posts.some",
          modifier: "some",
          relations: {
            to: getModelRelation("User", "posts"),
            from: getModelRelation("Post", "author"),
          },
        },
      ],
    },
    {
      description: "correct relations for relations between same model",
      rootParams: createParams("Comment", "findMany", {
        include: {
          replies: true,
        },
      }),
      nestedCalls: [
        {
          action: "include",
          model: "Comment",
          argsPath: "args.include.replies",
          relations: {
            to: getModelRelation("Comment", "replies"),
            from: getModelRelation("Comment", "repliedTo"),
          },
        },
      ],
    },
  ])(
    "calls middleware with $description",
    async ({ rootParams, nestedCalls = [] }) => {
      const middleware = jest.fn((params, next) => next(params));
      const nestedMiddleware = createNestedMiddleware(middleware);

      const next = (_: any) => Promise.resolve({});
      await nestedMiddleware(rootParams, next);

      expect(middleware).toHaveBeenCalledTimes(nestedCalls.length + 1);
      expect(middleware).toHaveBeenCalledWith(rootParams, next);
      nestedCalls.forEach((call) => {
        expect(middleware).toHaveBeenCalledWith(
          nestedParamsFromCall(rootParams, call),
          expect.any(Function)
        );
      });
    }
  );
});
