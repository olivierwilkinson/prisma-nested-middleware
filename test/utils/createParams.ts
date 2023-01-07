import { Prisma } from "@prisma/client";

type DelegateByModel<Model extends Prisma.ModelName> = Model extends "User"
  ? Prisma.UserDelegate<undefined>
  : Model extends "Post"
  ? Prisma.PostDelegate<undefined>
  : Model extends "Profile"
  ? Prisma.ProfileDelegate<undefined>
  : never;

type ArgsByAction<
  Model extends Prisma.ModelName,
  Action extends keyof DelegateByModel<Model> | "connectOrCreate"
> = Action extends "create"
  ? Parameters<DelegateByModel<Model>["create"]>[0]
  : Action extends "update"
  ? Parameters<DelegateByModel<Model>["update"]>[0]
  : Action extends "upsert"
  ? Parameters<DelegateByModel<Model>["upsert"]>[0]
  : Action extends "delete"
  ? Parameters<DelegateByModel<Model>["delete"]>[0]
  : Action extends "deleteMany"
  ? Parameters<DelegateByModel<Model>["deleteMany"]>[0]
  : Action extends "updateMany"
  ? Parameters<DelegateByModel<Model>["updateMany"]>[0]
  : Action extends "connectOrCreate"
  ? {
      where: Parameters<DelegateByModel<Model>["findUnique"]>[0];
      create: Parameters<DelegateByModel<Model>["create"]>[0];
    }
  : never;

/**
 * Creates params objects with strict typing of the `args` object to ensure it
 * is valid for the `model` and `action` passed.
 */
export const createParams = <
  Model extends Prisma.ModelName,
  Action extends keyof DelegateByModel<Model> | "connectOrCreate" =
    | keyof DelegateByModel<Model>
    | "connectOrCreate"
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
