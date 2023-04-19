import { Prisma } from "@prisma/client";
import { DeferredPromise } from "@open-draft/deferred-promise";

export type Modifier = "is" | "isNot" | "some" | "none" | "every";
export type LogicalOperator = "AND" | "OR" | "NOT";

export type NestedQueryAction = "where";
export type NestedReadAction = "include" | "select";
export type NestedWriteAction =
  | "create"
  | "update"
  | "upsert"
  | "connectOrCreate"
  | "connect"
  | "disconnect"
  | "createMany"
  | "updateMany"
  | "delete"
  | "deleteMany";

export type NestedAction =
  | Prisma.PrismaAction
  | NestedWriteAction
  | NestedReadAction
  | NestedQueryAction;

export type QueryTarget = {
  action: NestedQueryAction;
  relationName?: string;
  modifier?: Modifier;
  operations?: { logicalOperator: LogicalOperator; index?: number }[];
  readAction?: NestedReadAction;
  parentTarget?: Target;
};

export type ReadTarget = {
  action: NestedReadAction;
  relationName?: string;
  field?: string;
  parentTarget?: Target;
};

export type WriteTarget = {
  action: NestedWriteAction;
  relationName: string;
  field?: string;
  index?: number;
  parentTarget?: Target;
};

export type Target = ReadTarget | WriteTarget | QueryTarget;

export type MiddlewareCall = {
  nextPromise: DeferredPromise<any>;
  result: Promise<any>;
  updatedParams: NestedParams;
  origin: Target;
  target: Target;
};

export type Scope = {
  parentParams: NestedParams;
  relations: { to: Prisma.DMMF.Field; from: Prisma.DMMF.Field };
  modifier?: Modifier;
  logicalOperators?: LogicalOperator[];
};

export type NestedParams = Omit<Prisma.MiddlewareParams, "action"> & {
  action: NestedAction;
  scope?: Scope;
};

export type NestedMiddleware<T = any> = (
  params: NestedParams,
  next: (modifiedParams: NestedParams | NestedParams[]) => Promise<T>
) => Promise<T>;
