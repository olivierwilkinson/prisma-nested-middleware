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
    const nestedMiddleware = createNestedMiddleware(async (params, next) => {
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
            ...params.args,
            number: faker.datatype.number(),
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
            ...params.args,
            number: faker.datatype.number(),
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

  it("waits for all middleware to finish before calling next", async () => {
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
