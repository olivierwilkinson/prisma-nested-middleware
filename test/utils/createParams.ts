import { Prisma } from "@prisma/client";

type DelegateByModel<Model extends Prisma.ModelName> = Model extends "User"
  ? Prisma.UserDelegate<undefined>
  : Model extends "Post"
  ? Prisma.PostDelegate<undefined>
  : Model extends "Profile"
  ? Prisma.ProfileDelegate<undefined>
  : never;

type SelectByModel<Model extends Prisma.ModelName> = Model extends "User"
  ? Prisma.UserSelect
  : Model extends "Post"
  ? Prisma.PostSelect
  : Model extends "Profile"
  ? Prisma.ProfileSelect
  : never;

type IncludeByModel<Model extends Prisma.ModelName> = Model extends "User"
  ? Prisma.UserInclude
  : Model extends "Post"
  ? Prisma.PostInclude
  : Model extends "Profile"
  ? Prisma.ProfileInclude
  : never;

type ActionByModel<Model extends Prisma.ModelName> =
  | keyof DelegateByModel<Model>
  | "connectOrCreate"
  | "select"
  | "include";

type ArgsByAction<
  Model extends Prisma.ModelName,
  Action extends ActionByModel<Model>
> = Action extends "create"
  ? Parameters<DelegateByModel<Model>["create"]>[0]
  : Action extends "update"
  ? Parameters<DelegateByModel<Model>["update"]>[0]
  : Action extends "upsert"
  ? Parameters<DelegateByModel<Model>["upsert"]>[0]
  : Action extends "delete"
  ? Parameters<DelegateByModel<Model>["delete"]>[0]
  : Action extends "createMany"
  ? Parameters<DelegateByModel<Model>["createMany"]>[0]
  : Action extends "updateMany"
  ? Parameters<DelegateByModel<Model>["updateMany"]>[0]
  : Action extends "deleteMany"
  ? Parameters<DelegateByModel<Model>["deleteMany"]>[0]
  : Action extends "findUnique"
  ? Parameters<DelegateByModel<Model>["findUnique"]>[0]
  : Action extends "findFirst"
  ? Parameters<DelegateByModel<Model>["findFirst"]>[0]
  : Action extends "findMany"
  ? Parameters<DelegateByModel<Model>["findMany"]>[0]
  : Action extends "connectOrCreate"
  ? {
      where: Parameters<DelegateByModel<Model>["findUnique"]>[0];
      create: Parameters<DelegateByModel<Model>["create"]>[0];
    }
  : Action extends "select"
  ? SelectByModel<Model>
  : Action extends "include"
  ? IncludeByModel<Model>
  : never;

/**
 * Creates params objects with strict typing of the `args` object to ensure it
 * is valid for the `model` and `action` passed.
 */
export const createParams = <
  Model extends Prisma.ModelName,
  Action extends ActionByModel<Model> = ActionByModel<Model>
>(
  model: Model,
  action: Action,
  args: ArgsByAction<Model, Action>,
  dataPath: string[] = [],
  runInTransaction: boolean = false
): Prisma.MiddlewareParams => ({
  model,
  action: action as Prisma.PrismaAction,
  args,
  dataPath,
  runInTransaction,
});
