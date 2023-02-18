import faker from "faker";
import { set } from "lodash";

import { createNestedMiddleware } from "../src";
import { createParams } from "./utils/createParams";
import { wait } from "./utils/wait";

describe("actions", () => {
  it("allows middleware to modify root params action", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      return next({
        ...params,
        action: "findFirst",
      });
    });

    const next = jest.fn((_: any) => Promise.resolve(null));
    const params = createParams("User", "findUnique", {
      where: { id: faker.datatype.number() },
    });
    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith(set(params, "action", "findFirst"));
  });

  it("allows middleware to modify root params action asynchronously", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      await wait(100);
      return next({
        ...params,
        action: "findFirst",
      });
    });

    const next = jest.fn((_: any) => Promise.resolve(null));
    const params = createParams("User", "findUnique", {
      where: { id: faker.datatype.number() },
    });
    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith(set(params, "action", "findFirst"));
  });

  it("applies middleware to operations moved to new action type", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.action === "update" && params.scope) {
        return next({
          ...params,
          action: "upsert",
          args: {
            where: { id: params.args.where.id },
            create: params.args.data,
            update: params.args.data,
          },
        });
      }

      if (params.action === "upsert") {
        return next({
          ...params,
          args: {
            ...params.args,
            update: {
              ...params.args.update,
              number: faker.datatype.number(),
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
          upsert: {
            where: { id: faker.datatype.number() },
            create: { title: faker.lorem.sentence() },
            update: { title: faker.lorem.sentence() },
          },
          update: {
            where: { id: faker.datatype.number() },
            data: { title: faker.lorem.sentence() },
          },
        },
      },
    });

    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith(
      set(params, "args.data.posts", {
        upsert: [
          {
            where: params.args.data.posts.upsert.where,
            create: params.args.data.posts.upsert.create,
            update: {
              title: params.args.data.posts.upsert.update.title,
              number: expect.any(Number),
            },
          },
          {
            where: params.args.data.posts.update.where,
            create: params.args.data.posts.update.data,
            update: {
              title: params.args.data.posts.update.data.title,
              // this should also be applied
              number: expect.any(Number),
            },
          },
        ],
      })
    );
  });

  it("merges operation converted to existing operation correctly when converted operation defined before target operation", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.action === "update" && params.scope) {
        return next({
          ...params,
          action: "upsert",
          args: {
            where: { id: params.args.where.id },
            create: params.args.data,
            update: params.args.data,
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
          update: {
            where: { id: faker.datatype.number() },
            data: { title: faker.lorem.sentence() },
          },
          upsert: {
            where: { id: faker.datatype.number() },
            create: { title: faker.lorem.sentence() },
            update: { title: faker.lorem.sentence() },
          },
        },
      },
    });

    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith(
      set(params, "args.data.posts", {
        upsert: [
          {
            where: params.args.data.posts.upsert.where,
            create: params.args.data.posts.upsert.create,
            update: params.args.data.posts.upsert.update,
          },
          {
            where: params.args.data.posts.update.where,
            create: params.args.data.posts.update.data,
            update: params.args.data.posts.update.data,
          },
        ],
      })
    );
  });

  it("waits for all middleware to finish before calling next when modifying nested action", async () => {
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
      if (params.action === "create" && params.scope) {
        await wait(100);
        return next({
          ...params,
          action: "update",
          args: {
            ...params.args,
            where: { id: params.args.data.id },
          },
        });
      }

      if (params.action === "update") {
        await wait(200);
        return next({
          ...params,
          action: "upsert",
          args: {
            where: params.args.where,
            create: params.args.data,
            update: params.args.data,
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
            id: faker.datatype.number(),
            title: faker.lorem.sentence(),
            comments: {
              create: {
                id: faker.datatype.number(),
                content: faker.lorem.sentence(),
                authorId: faker.datatype.number(),
              },
            },
          },
        },
      },
    });
    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith(
      set(params, "args.data.posts", {
        upsert: {
          where: { id: params.args.data.posts.create.id },
          create: {
            ...params.args.data.posts.create,
            comments: {
              upsert: {
                where: {
                  id: params.args.data.posts.create.comments.create.id,
                },
                create: params.args.data.posts.create.comments.create,
                update: params.args.data.posts.create.comments.create,
              },
            },
          },
          update: {
            ...params.args.data.posts.create,
            comments: {
              upsert: {
                where: {
                  id: params.args.data.posts.create.comments.create.id,
                },
                create: params.args.data.posts.create.comments.create,
                update: params.args.data.posts.create.comments.create,
              },
            },
          },
        },
      })
    );
  });

  it("allows middleware to modify deeply nested actions", async () => {
    const nestedMiddleware = createNestedMiddleware((params, next) => {
      if (params.action === "create" && params.args.data.id) {
        return next({
          ...params,
          action: "upsert",
          args: {
            where: { id: params.args.data.id },
            create: params.args.data,
            update: params.args.data,
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
          create: {
            id: faker.datatype.number(),
            title: faker.lorem.sentence(),
            comments: {
              create: {
                id: faker.datatype.number(),
                authorId: faker.datatype.number(),
                content: faker.lorem.sentence(),
              },
            },
          },
        },
      },
    });
    const createCommentData = params.args.data.posts.create.comments.create;
    const createPostData = {
      ...params.args.data.posts.create,
      comments: {
        upsert: {
          where: { id: createCommentData.id },
          create: createCommentData,
          update: createCommentData,
        },
      },
    };

    await nestedMiddleware(params, next);

    expect(next).toHaveBeenCalledWith(
      set(params, "args.data.posts", {
        upsert: {
          where: { id: createPostData.id },
          create: createPostData,
          update: createPostData,
        },
      })
    );
  });

  describe("create", () => {
    it("allows middleware to modify nested create action to be an update", async () => {
      const nestedMiddleware = createNestedMiddleware((params, next) => {
        if (params.action === "create") {
          return next({
            ...params,
            action: "update",
            args: {
              where: { id: params.args.data.id },
              data: params.args.data,
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
            create: {
              id: faker.datatype.number(),
              title: faker.lorem.sentence(),
            },
          },
        },
      });

      await nestedMiddleware(params, next);

      expect(next).toHaveBeenCalledWith(
        set(params, "args.data.posts", {
          update: {
            where: { id: params.args.data.posts.create.id },
            data: params.args.data.posts.create,
          },
        })
      );
    });

    it("allows middleware to modify nested create action to be an upsert", async () => {
      const nestedMiddleware = createNestedMiddleware((params, next) => {
        if (params.action === "create") {
          return next({
            ...params,
            action: "upsert",
            args: {
              where: { id: params.args.data.id },
              create: params.args.data,
              update: params.args.data,
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
            create: {
              title: faker.lorem.sentence(),
            },
          },
        },
      });
      const createData = params.args.data.posts.create;
      await nestedMiddleware(params, next);

      expect(next).toHaveBeenCalledWith(
        set(params, "args.data.posts", {
          upsert: {
            where: { id: createData.id },
            create: createData,
            update: createData,
          },
        })
      );
    });

    it("allows middleware to modify nested create action to be a createMany", async () => {
      const nestedMiddleware = createNestedMiddleware((params, next) => {
        if (params.action === "create") {
          return next({
            ...params,
            action: "createMany",
            args: {
              data: [params.args.data],
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
            create: { title: faker.lorem.sentence() },
          },
        },
      });

      await nestedMiddleware(params, next);

      expect(next).toHaveBeenCalledWith(
        set(params, "args.data.posts", {
          createMany: { data: [params.args.data.posts.create] },
        })
      );
    });

    it("allows middleware to modify nested create action array to be a createMany", async () => {
      const nestedMiddleware = createNestedMiddleware((params, next) => {
        if (params.action === "create") {
          return next({
            ...params,
            action: "createMany",
            args: { data: [params.args.data] },
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
              { title: faker.lorem.sentence() },
              { title: faker.lorem.sentence() },
            ],
          },
        },
      });

      await nestedMiddleware(params, next);

      expect(next).toHaveBeenCalledWith(
        set(params, "args.data.posts", {
          createMany: { data: params.args.data.posts.create },
        })
      );
    });

    it("allows middleware to modify nested create action to be a connectOrCreate", async () => {
      const nestedMiddleware = createNestedMiddleware((params, next) => {
        if (params.action === "create") {
          return next({
            ...params,
            action: "connectOrCreate",
            args: {
              where: { id: params.args.data.id },
              create: params.args.data,
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
            create: {
              id: faker.datatype.number(),
              title: faker.lorem.sentence(),
            },
          },
        },
      });

      await nestedMiddleware(params, next);

      expect(next).toHaveBeenCalledWith(
        set(params, "args.data.posts", {
          connectOrCreate: {
            where: { id: params.args.data.posts.create.id },
            create: params.args.data.posts.create,
          },
        })
      );
    });
  });

  describe("update", () => {
    it("allows middleware to modify nested update action to be a create", async () => {
      const nestedMiddleware = createNestedMiddleware((params, next) => {
        if (params.action === "update" && params.model === "Post") {
          return next({
            ...params,
            action: "create",
            args: {
              data: params.args.data,
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
            update: {
              where: { id: faker.datatype.number() },
              data: { title: faker.lorem.sentence() },
            },
          },
        },
      });

      await nestedMiddleware(params, next);

      expect(next).toHaveBeenCalledWith(
        set(params, "args.data.posts", {
          create: params.args.data.posts.update.data,
        })
      );
    });

    it("allows middleware to modify nested update action to be a createMany", async () => {
      const nestedMiddleware = createNestedMiddleware((params, next) => {
        if (params.action === "update" && params.model === "Post") {
          return next({
            ...params,
            action: "createMany",
            args: {
              data: [params.args.data],
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
            update: {
              where: { id: faker.datatype.number() },
              data: { title: faker.lorem.sentence() },
            },
          },
        },
      });

      await nestedMiddleware(params, next);

      expect(next).toHaveBeenCalledWith(
        set(params, "args.data.posts", {
          createMany: { data: [params.args.data.posts.update.data] },
        })
      );
    });

    it("allows middleware to modify nested update action to be a connectOrCreate", async () => {
      const nestedMiddleware = createNestedMiddleware((params, next) => {
        if (params.action === "update" && params.model === "Post") {
          return next({
            ...params,
            action: "connectOrCreate",
            args: {
              where: params.args.where,
              create: params.args.data,
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
            update: {
              where: { id: faker.datatype.number() },
              data: {
                title: faker.lorem.sentence(),
              },
            },
          },
        },
      });

      await nestedMiddleware(params, next);

      expect(next).toHaveBeenCalledWith(
        set(params, "args.data.posts", {
          connectOrCreate: {
            where: params.args.data.posts.update.where,
            create: params.args.data.posts.update.data,
          },
        })
      );
    });

    it("allows middleware to modify nested update action to be an updateMany", async () => {
      const nestedMiddleware = createNestedMiddleware((params, next) => {
        if (params.action === "update" && params.model === "Post") {
          return next({
            ...params,
            action: "updateMany",
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
            update: {
              where: { id: faker.datatype.number() },
              data: {
                title: faker.lorem.sentence(),
              },
            },
          },
        },
      });

      await nestedMiddleware(params, next);

      expect(next).toHaveBeenCalledWith(
        set(params, "args.data.posts", {
          updateMany: params.args.data.posts.update,
        })
      );
    });

    it("allows middleware to modify nested update action to be an upsert", async () => {
      const nestedMiddleware = createNestedMiddleware((params, next) => {
        if (params.action === "update" && params.model === "Post") {
          return next({
            ...params,
            action: "upsert",
            args: {
              where: { id: params.args.where.id },
              create: params.args.data,
              update: params.args.data,
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
            update: {
              where: { id: faker.datatype.number() },
              data: {
                title: faker.lorem.sentence(),
              },
            },
          },
        },
      });
      const updateId = params.args.data.posts.update.where.id;
      const updateData = params.args.data.posts.update.data;

      await nestedMiddleware(params, next);

      expect(next).toHaveBeenCalledWith(
        set(params, "args.data.posts", {
          upsert: {
            where: { id: updateId },
            create: updateData,
            update: updateData,
          },
        })
      );
    });

    it("allows middleware to modify nested update action to be a delete", async () => {
      const nestedMiddleware = createNestedMiddleware((params, next) => {
        if (params.action === "update" && params.model === "Post") {
          return next({
            ...params,
            action: "delete",
            args: {
              where: { id: params.args.where.id },
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
            update: {
              where: { id: faker.datatype.number() },
              data: {
                title: faker.lorem.sentence(),
              },
            },
          },
        },
      });

      await nestedMiddleware(params, next);

      expect(next).toHaveBeenCalledWith(
        set(params, "args.data.posts", {
          delete: {
            where: params.args.data.posts.update.where,
          },
        })
      );
    });

    it("allows middleware to modify nested update action to be a deleteMany", async () => {
      const nestedMiddleware = createNestedMiddleware((params, next) => {
        if (params.action === "update" && params.model === "Post") {
          return next({
            ...params,
            action: "deleteMany",
            args: {
              where: { id: params.args.where.id },
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
            update: {
              where: { id: faker.datatype.number() },
              data: {
                title: faker.lorem.sentence(),
              },
            },
          },
        },
      });

      await nestedMiddleware(params, next);

      expect(next).toHaveBeenCalledWith(
        set(params, "args.data.posts", {
          deleteMany: {
            where: params.args.data.posts.update.where,
          },
        })
      );
    });
  });

  describe("upsert", () => {
    it("allows middleware to modify nested upsert action to be a create", async () => {
      const nestedMiddleware = createNestedMiddleware((params, next) => {
        if (params.action === "upsert") {
          return next({
            ...params,
            action: "create",
            args: {
              data: params.args.create,
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
            upsert: {
              where: { id: faker.datatype.number() },
              create: {
                title: faker.lorem.sentence(),
              },
              update: {
                title: faker.lorem.sentence(),
              },
            },
          },
        },
      });

      await nestedMiddleware(params, next);

      expect(next).toHaveBeenCalledWith(
        set(params, "args.data.posts", {
          create: params.args.data.posts.upsert.create,
        })
      );
    });

    it("allows middleware to modify nested upsert action array to be a create array", async () => {
      const nestedMiddleware = createNestedMiddleware((params, next) => {
        if (params.action === "upsert") {
          return next({
            ...params,
            action: "create",
            args: { data: params.args.create },
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
            upsert: [
              {
                where: { id: faker.datatype.number() },
                create: { title: faker.lorem.sentence() },
                update: { title: faker.lorem.sentence() },
              },
              {
                where: { id: faker.datatype.number() },
                create: { title: faker.lorem.sentence() },
                update: { title: faker.lorem.sentence() },
              },
            ],
          },
        },
      });

      await nestedMiddleware(params, next);

      expect(next).toHaveBeenCalledWith(
        set(params, "args.data.posts", {
          create: params.args.data.posts.upsert.map((u: any) => u.create),
        })
      );
    });
  });

  describe("connectOrCreate", () => {});

  describe("createMany", () => {
    // This is not possible with the current API, we would need to destinguish
    // between a root createMany and a nested createMany and then allow the user
    // to pass params with a list of operations as args or allow passing an array
    // of params to next
    it.failing(
      "allows middleware to modify nested createMany action to be a create list",
      async () => {
        const nestedMiddleware = createNestedMiddleware((params, next) => {
          if (params.action === "createMany") {
            // this is only a placeholder for what the user might be able to pass
            return next({
              ...params,
              action: "create",
              args: params.args.data,
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
              createMany: {
                data: [
                  { title: faker.lorem.sentence() },
                  { title: faker.lorem.sentence() },
                ],
              },
            },
          },
        });

        await nestedMiddleware(params, next);

        expect(next).toHaveBeenCalledWith(
          set(params, "args.data.posts", {
            create: params.args.data.posts.createMany.data,
          })
        );
      }
    );
  });

  describe("updateMany", () => {
  });

  describe("delete", () => {
    it("allows middleware to modify nested delete action to be an update", async () => {
      const nestedMiddleware = createNestedMiddleware((params, next) => {
        if (params.action === "delete") {
          return next({
            ...params,
            action: "update",
            args: {
              where: { id: params.args.id },
              data: { deleted: true },
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
            delete: { id: faker.datatype.number() },
          },
        },
      });
      await nestedMiddleware(params, next);

      expect(next).toHaveBeenCalledWith(
        set(params, "args.data.posts", {
          update: {
            where: { id: params.args.data.posts.delete.id },
            data: { deleted: true },
          },
        })
      );
    });

    it("allows middleware to modify nested delete action list to be an update list", async () => {
      const nestedMiddleware = createNestedMiddleware((params, next) => {
        if (params.action === "delete") {
          return next({
            ...params,
            action: "update",
            args: {
              where: { id: params.args.id },
              data: { deleted: true },
            },
          });
        }

        return next(params);
      });

      const next = jest.fn((_: any) => Promise.resolve(null));
      const params = createParams("User", "update", {
        where: {
          id: faker.datatype.number(),
        },
        data: {
          email: faker.internet.email(),
          posts: {
            delete: [
              { id: faker.datatype.number() },
              { id: faker.datatype.number() },
            ],
          },
        },
      });
      await nestedMiddleware(params, next);

      expect(next).toHaveBeenCalledWith(
        set(params, "args.data.posts", {
          update: params.args.data.posts.delete.map((del: any) => ({
            where: del,
            data: { deleted: true },
          })),
        })
      );
    });

    it("allows middleware to modify nested boolean delete action to be an update", async () => {
      const nestedMiddleware = createNestedMiddleware((params, next) => {
        if (params.action === "delete" && params.args === true) {
          return next({
            ...params,
            action: "update",
            args: {
              ...params.args,
              deleted: true,
            },
          });
        }

        return next(params);
      });

      const next = jest.fn((_: any) => Promise.resolve(null));
      const params = createParams("User", "update", {
        where: {
          id: faker.datatype.number(),
        },
        data: {
          email: faker.internet.email(),
          profile: {
            delete: true,
          },
        },
      });
      await nestedMiddleware(params, next);

      expect(next).toHaveBeenCalledWith(
        set(params, "args.data.profile", { update: { deleted: true } })
      );
    });

    it("allows middleware to modify deeply nested delete action to be an update", async () => {
      const nestedMiddleware = createNestedMiddleware((params, next) => {
        if (params.action === "delete") {
          return next({
            ...params,
            action: "update",
            args: {
              where: { id: params.args.id },
              data: { deleted: true },
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
            update: {
              where: { id: faker.datatype.number() },
              data: {
                title: faker.lorem.sentence(),
                comments: {
                  delete: { id: faker.datatype.number() },
                },
              },
            },
          },
        },
      });
      await nestedMiddleware(params, next);

      expect(next).toHaveBeenCalledWith(
        set(params, "args.data.posts.update.data.comments", {
          update: {
            where: params.args.data.posts.update.data.comments.delete,
            data: { deleted: true },
          },
        })
      );
    });
  });

  describe("deleteMany", () => {
  });

  describe("include", () => {
    it("allows middleware to modify nested include action to be a select", async () => {
      const nestedMiddleware = createNestedMiddleware((params, next) => {
        if (params.action === "include") {
          return next({
            ...params,
            action: "select",
          });
        }

        return next(params);
      });

      const next = jest.fn((_: any) => Promise.resolve(null));
      const params = createParams("User", "findUnique", {
        where: { id: faker.datatype.number() },
        include: {
          posts: true,
        },
      });

      await nestedMiddleware(params, next);

      expect(next).toHaveBeenCalledWith({
        ...params,
        args: {
          where: params.args.where,
          select: {
            posts: true,
          },
        },
      });
    });
  });

  describe("select", () => {
    it("allows middleware to modify nested select action to be an include", async () => {
      const nestedMiddleware = createNestedMiddleware((params, next) => {
        if (params.action === "select") {
          return next({
            ...params,
            action: "include",
          });
        }

        return next(params);
      });

      const next = jest.fn((_: any) => Promise.resolve(null));
      const params = createParams("User", "findUnique", {
        where: { id: faker.datatype.number() },
        include: {
          posts: {
            select: {
              author: true,
            },
          },
        },
      });
      await nestedMiddleware(params, next);

      expect(next).toHaveBeenCalledWith(
        set(params, "args.include.posts", { include: { author: true } })
      );
    });
  });

  describe("merging", () => {
    it("merges converted write action args with existing write action args", async () => {
      const nestedMiddleware = createNestedMiddleware((params, next) => {
        if (params.action === "delete") {
          return next({
            ...params,
            action: "update",
            args: {
              where: { id: params.args.id },
              data: { deleted: true },
            },
          });
        }

        return next(params);
      });

      const next = jest.fn((_: any) => Promise.resolve(null));
      const params = createParams("User", "update", {
        where: {
          id: faker.datatype.number(),
        },
        data: {
          email: faker.internet.email(),
          posts: {
            update: {
              where: { id: faker.datatype.number() },
              data: { title: faker.lorem.sentence() },
            },
            delete: {
              id: faker.datatype.number(),
            },
          },
        },
      });

      await nestedMiddleware(params, next);

      expect(next).toHaveBeenCalledWith(
        set(params, "args.data.posts", {
          update: [
            {
              where: { id: params.args.data.posts.update.where.id },
              data: { title: params.args.data.posts.update.data.title },
            },
            {
              where: { id: params.args.data.posts.delete.id },
              data: { deleted: true },
            },
          ],
        })
      );
    });

    it("merges converted write array args with existing write action args", async () => {
      const nestedMiddleware = createNestedMiddleware((params, next) => {
        if (params.action === "delete") {
          return next({
            ...params,
            action: "update",
            args: {
              where: { id: params.args.id },
              data: { deleted: true },
            },
          });
        }

        return next(params);
      });

      const next = jest.fn((_: any) => Promise.resolve(null));
      const params = createParams("User", "update", {
        where: {
          id: faker.datatype.number(),
        },
        data: {
          email: faker.internet.email(),
          posts: {
            update: {
              where: { id: faker.datatype.number() },
              data: { title: faker.lorem.sentence() },
            },
            delete: [
              { id: faker.datatype.number() },
              { id: faker.datatype.number() },
            ],
          },
        },
      });

      await nestedMiddleware(params, next);

      expect(next).toHaveBeenCalledWith(
        set(params, "args.data.posts", {
          update: [
            {
              where: { id: params.args.data.posts.update.where.id },
              data: params.args.data.posts.update.data,
            },
            {
              where: { id: params.args.data.posts.delete[0].id },
              data: { deleted: true },
            },
            {
              where: { id: params.args.data.posts.delete[1].id },
              data: { deleted: true },
            },
          ],
        })
      );
    });

    it("merges converted write args with existing write action array args", async () => {
      const nestedMiddleware = createNestedMiddleware((params, next) => {
        if (params.action === "delete") {
          return next({
            ...params,
            action: "update",
            args: {
              where: { id: params.args.id },
              data: { deleted: true },
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
                data: { title: faker.lorem.sentence() },
              },
            ],
            delete: { id: faker.datatype.number() },
          },
        },
      });

      await nestedMiddleware(params, next);

      expect(next).toHaveBeenCalledWith(
        set(params, "args.data.posts", {
          update: [
            {
              where: { id: params.args.data.posts.update[0].where.id },
              data: params.args.data.posts.update[0].data,
            },
            {
              where: { id: params.args.data.posts.delete.id },
              data: { deleted: true },
            },
          ],
        })
      );
    });

    it("merges converted write array args with existing write action array args", async () => {
      const nestedMiddleware = createNestedMiddleware((params, next) => {
        if (params.action === "delete") {
          return next({
            ...params,
            action: "update",
            args: {
              where: { id: params.args.id },
              data: { deleted: true },
            },
          });
        }

        return next(params);
      });

      const next = jest.fn((_: any) => Promise.resolve(null));
      const params = createParams("User", "update", {
        where: {
          id: faker.datatype.number(),
        },
        data: {
          email: faker.internet.email(),
          posts: {
            update: [
              {
                where: { id: faker.datatype.number() },
                data: { title: faker.lorem.sentence() },
              },
            ],
            delete: [
              { id: faker.datatype.number() },
              { id: faker.datatype.number() },
            ],
          },
        },
      });

      await nestedMiddleware(params, next);

      expect(next).toHaveBeenCalledWith(
        set(params, "args.data.posts", {
          update: [
            {
              where: { id: params.args.data.posts.update[0].where.id },
              data: params.args.data.posts.update[0].data,
            },
            {
              where: { id: params.args.data.posts.delete[0].id },
              data: { deleted: true },
            },
            {
              where: { id: params.args.data.posts.delete[1].id },
              data: { deleted: true },
            },
          ],
        })
      );
    });

    it("merges converted write args with existing write action args when nested in action array", async () => {
      const nestedMiddleware = createNestedMiddleware((params, next) => {
        if (params.action === "delete") {
          return next({
            ...params,
            action: "update",
            args: {
              where: { id: params.args.id },
              data: { deleted: true },
            },
          });
        }

        return next(params);
      });

      const next = jest.fn((_: any) => Promise.resolve(null));
      const params = createParams("User", "update", {
        where: {
          id: faker.datatype.number(),
        },
        data: {
          email: faker.internet.email(),
          posts: {
            update: [
              {
                where: { id: faker.datatype.number() },
                data: {
                  title: faker.lorem.sentence(),
                  comments: {
                    update: {
                      where: { id: faker.datatype.number() },
                      data: { content: "test comment content" },
                    },
                    delete: { id: faker.datatype.number() },
                  },
                },
              },
            ],
          },
        },
      });

      await nestedMiddleware(params, next);

      expect(next).toHaveBeenCalledWith(
        set(params, "args.data.posts.update.0.data.comments", {
          update: [
            params.args.data.posts.update[0].data.comments.update,
            {
              where: params.args.data.posts.update[0].data.comments.delete,
              data: { deleted: true },
            },
          ],
        })
      );
    });

    it("merges operation converted to createMany with existing createMany", async () => {
      const nestedMiddleware = createNestedMiddleware((params, next) => {
        if (params.action === "upsert") {
          return next({
            ...params,
            action: "createMany",
            args: {
              data: [
                {
                  title: params.args.create.title,
                  number: params.args.create.title.includes("first") ? 1 : 2,
                },
              ],
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
            createMany: {
              data: [{ title: "pre-existing" }],
            },
            upsert: [
              {
                where: { id: faker.datatype.number() },
                create: { title: "first-upsert" },
                update: { title: "first-upsert" },
              },
              {
                where: { id: faker.datatype.number() },
                create: { title: "second-upsert" },
                update: { title: "second-upsert" },
              },
            ],
          },
        },
      });
      await nestedMiddleware(params, next);

      // spread data here as a fix to: https://github.com/facebook/jest/issues/8475
      expect(next).toHaveBeenCalledTimes(1);
      expect([
        ...next.mock.calls[0][0].args.data.posts.createMany.data,
      ]).toEqual([
        { title: "pre-existing" },
        { title: "first-upsert", number: 1 },
        { title: "second-upsert", number: 2 },
      ]);
    });

    it("does nothing when middleware changes an select to be a include but an include already exists", async () => {
      const nestedMiddleware = createNestedMiddleware((params, next) => {
        if (params.action === "select") {
          return next({
            ...params,
            action: "include",
          });
        }

        return next(params);
      });

      const next = jest.fn((_: any) => Promise.resolve(null));
      const params = createParams("User", "findUnique", {
        where: { id: faker.datatype.number() },
        include: {
          posts: {
            select: { deleted: true },
            include: { author: true },
          },
        },
      });

      await nestedMiddleware(params, next);

      expect(next).toHaveBeenCalledWith(params);
    });
  });
});
