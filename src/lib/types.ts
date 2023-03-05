import { Prisma } from "@prisma/client";
import { DeferredPromise } from "@open-draft/deferred-promise";

export type NestedReadAction = "include" | "select";
export type NestedWriteAction =
  | "create"
  | "update"
  | "upsert"
  | "connectOrCreate"
  | "createMany"
  | "updateMany"
  | "delete"
  | "deleteMany";

export type NestedAction =
  | Prisma.PrismaAction
  | NestedWriteAction
  | NestedReadAction
  | "connectOrCreate";

export type ReadTarget = {
  action: NestedReadAction;
  relationName: string;
  field?: string;
};

export type WriteTarget = {
  action: NestedWriteAction;
  relationName: string;
  field: string;
  index?: number;
};

export type Target = ReadTarget | WriteTarget;

export type MiddlewareCall = {
  nextPromise: DeferredPromise<any>;
  result: Promise<any>;
  updatedParams: NestedParams;
  origin: Target;
  target: Target;
};

export type NestedParams = Omit<Prisma.MiddlewareParams, "action"> & {
  action: NestedAction;
  scope?: NestedParams;
  relation?: Prisma.DMMF.Field;
};

export type NestedMiddleware<T = any> = (
  params: NestedParams,
  next: (modifiedParams: NestedParams) => Promise<T>
) => Promise<T>;
