/* eslint-disable import/no-unresolved */
// @ts-ignore unable to generate prisma client before building
import { Prisma } from "@prisma/client";

import get from "lodash/get";
import set from "lodash/set";

if (!Prisma.dmmf) {
  throw new Error(
    "Prisma DMMF not found, please generate Prisma client using `npx prisma generate`"
  );
}

const relationsByModel: Record<string, Prisma.DMMF.Field[]> = {};
Prisma.dmmf.datamodel.models.forEach((model: Prisma.DMMF.Model) => {
  relationsByModel[model.name] = model.fields.filter(
    (field) => field.kind === "object" && field.relationName
  );
});

export type NestedReadAction = "include" | "select";
export type NestedAction =
  | Prisma.PrismaAction
  | NestedReadAction
  | "connectOrCreate";

export type NestedParams = Omit<Prisma.MiddlewareParams, "action"> & {
  action: NestedAction;
  scope?: NestedParams;
};

export type NestedMiddleware<T = any> = (
  params: NestedParams,
  next: (modifiedParams: NestedParams) => Promise<T>
) => Promise<T>;

type NestedOperationInfo = {
  params: NestedParams;
  argPath: string;
};

type PromiseCallbackRef = {
  resolve: (result?: any) => void;
  reject: (reason?: any) => void;
};

const readOperations: NestedReadAction[] = ["include", "select"];
const writeOperations: NestedAction[] = [
  "create",
  "update",
  "upsert",
  "connectOrCreate",
  "createMany",
  "updateMany",
  "delete",
  "deleteMany",
];

function isReadOperation(key: any): key is NestedReadAction {
  return readOperations.includes(key);
}

function isWriteOperation(key: any): key is NestedAction {
  return writeOperations.includes(key);
}

function getNestedWriteArgPaths(
  params: NestedParams,
  relation: Prisma.DMMF.Field
): string[] {
  if (params.action === "upsert") {
    return [`update.${relation.name}`, `create.${relation.name}`];
  }

  // nested create args are not nested under data
  if (params.action === "create" && params.scope) {
    return [relation.name];
  }

  if (
    ["create", "update", "updateMany", "createMany"].includes(params.action)
  ) {
    return [`data.${relation.name}`];
  }

  if (params.action === "connectOrCreate") {
    return [`create.${relation.name}`];
  }

  return [];
}

function getNestedReadArgPaths(
  operation: NestedReadAction,
  relation: Prisma.DMMF.Field
) {
  if (operation === "include") {
    return [`include.${relation.name}`];
  }

  if (operation === "select") {
    // nested select first so we go from the most nested to the least nested
    return [`include.${relation.name}.select`, `select.${relation.name}`];
  }

  return [];
}

function extractNestedWriteOperations(
  params: NestedParams,
  relation: Prisma.DMMF.Field
): NestedOperationInfo[] {
  const model = relation.type as Prisma.ModelName;
  const nestedWriteOperations: NestedOperationInfo[] = [];

  getNestedWriteArgPaths(params, relation).forEach((argPath) => {
    const arg = get(params.args, argPath, {});
    nestedWriteOperations.push(
      ...Object.keys(arg)
        .filter(isWriteOperation)
        .map((operation) => ({
          argPath,
          params: {
            ...params,
            model,
            action: operation,
            args: arg[operation],
            scope: params,
          },
        }))
    );
  });

  return nestedWriteOperations;
}

function extractNestedReadOperations(
  params: NestedParams,
  relation: Prisma.DMMF.Field
): NestedOperationInfo[] {
  const model = relation.type as Prisma.ModelName;
  const nestedReadOperations: NestedOperationInfo[] = [];

  readOperations.forEach((operation) => {
    getNestedReadArgPaths(operation, relation).forEach((argPath) => {
      const arg = get(params.args, argPath);
      if (arg) {
        nestedReadOperations.push({
          argPath,
          params: {
            ...params,
            model,
            action: operation,
            args: arg,
            scope: params,
          },
        });
      }
    });
  });

  return nestedReadOperations;
}

function extractNestedOperations(
  params: NestedParams,
  relation: Prisma.DMMF.Field
): NestedOperationInfo[] {
  return [
    ...extractNestedWriteOperations(params, relation),
    ...extractNestedReadOperations(params, relation),
  ];
}

const parentSymbol = Symbol("parent");

function addParentToResult(parent: any, result: any) {
  if (!Array.isArray(result)) {
    return { ...result, [parentSymbol]: parent };
  }

  return result.map((item) => ({ ...item, [parentSymbol]: parent }));
}

function removeParentFromResult(result: any) {
  if (!Array.isArray(result)) {
    const { [parentSymbol]: _, ...rest } = result;
    return rest;
  }

  return result.map(({ [parentSymbol]: _, ...rest }: any) => rest);
}

function getNestedResult(result: any, relationName: string) {
  if (!Array.isArray(result)) {
    return get(result, relationName);
  }

  return result.reduce((acc, item) => {
    const itemResult = get(item, relationName);
    if (typeof itemResult === "undefined") {
      return acc;
    }

    return acc.concat(addParentToResult(item, itemResult));
  }, []);
}

function setNestedResult(
  result: any,
  relationName: string,
  modifiedResult: any
) {
  if (!Array.isArray(result)) {
    return set(result, relationName, modifiedResult);
  }

  result.forEach((item: any) => {
    const originalResult = get(item, relationName);

    // if original result was an array we need to filter the result to match
    if (Array.isArray(originalResult)) {
      return set(
        item,
        relationName,
        removeParentFromResult(
          modifiedResult.filter(
            (modifiedItem: any) => modifiedItem[parentSymbol] === item
          )
        )
      );
    }

    // if the orginal result was not an array we can just set the result
    const modifiedResultItem = modifiedResult.find(
      ({ [parentSymbol]: parent }: any) => parent === item
    );
    return set(
      item,
      relationName,
      modifiedResultItem && removeParentFromResult(modifiedResultItem)
    );
  });
}

export function createNestedMiddleware<T>(
  middleware: NestedMiddleware
): Prisma.Middleware<T> {
  const nestedMiddleware: NestedMiddleware = async (params, next) => {
    const relations = relationsByModel[params.model || ""] || [];
    const finalParams = params;
    const nestedOperations: {
      relationName: string;
      nextReached: Promise<unknown>;
      resultCallbacks: PromiseCallbackRef;
      result: Promise<any>;
    }[] = [];

    relations.forEach((relation) =>
      extractNestedOperations(params, relation).forEach((nestedOperation) => {
        // store nextReached promise callbacks to set whether next has been
        // called or if middleware has thrown beforehand
        const nextReachedCallbacks: PromiseCallbackRef = {
          resolve() {},
          reject() {},
        };

        // store result promise callbacks so we can settle it once we know how
        const resultCallbacks: PromiseCallbackRef = {
          resolve() {},
          reject() {},
        };

        // wrap params updated callback in a promise so we can await it
        const nextReached = new Promise<void>((resolve, reject) => {
          nextReachedCallbacks.resolve = resolve;
          nextReachedCallbacks.reject = reject;
        });

        const result = nestedMiddleware(
          nestedOperation.params,
          (updatedParams) => {
            // Update final params to include nested middleware changes.
            // Scope updates to [argPath].[action] to avoid breaking params
            set(
              finalParams.args,
              // no nested action in read operations
              isReadOperation(updatedParams.action)
                ? nestedOperation.argPath
                : `${nestedOperation.argPath}.${updatedParams.action}`,
              updatedParams.args
            );

            // notify parent middleware that params have been updated
            nextReachedCallbacks.resolve();

            // only resolve nested next when resolveRef.resolve is called
            return new Promise((resolve, reject) => {
              resultCallbacks.resolve = resolve;
              resultCallbacks.reject = reject;
            });
          }
        ).catch((e) => {
          // reject nextReached promise so if it has not already resolved the
          // parent will catch the error when awaiting it.
          nextReachedCallbacks.reject(e);

          // rethrow error so the parent catches it when awaiting `result`
          throw e;
        });

        nestedOperations.push({
          relationName: relation.name,
          nextReached,
          resultCallbacks,
          result,
        });
      })
    );

    try {
      // wait for all nested middleware to have reached next and updated params
      await Promise.all(nestedOperations.map(({ nextReached }) => nextReached));

      // evaluate result from parent middleware
      const result = await middleware(finalParams, next);

      // resolve nested middleware next functions with relevant slice of result
      await Promise.all(
        nestedOperations.map(async (nestedOperation) => {
          // if relationship hasn't been included nestedResult is undefined.
          nestedOperation.resultCallbacks.resolve(
            result && getNestedResult(result, nestedOperation.relationName)
          );

          // set final result relation to be result of nested middleware
          setNestedResult(
            result,
            nestedOperation.relationName,
            await nestedOperation.result
          );
        })
      );

      return result;
    } catch (e) {
      // When parent rejects also reject the nested next functions promises
      await Promise.all(
        nestedOperations.map((nestedOperation) => {
          nestedOperation.resultCallbacks.reject(e);
          return nestedOperation.result;
        })
      );
      throw e;
    }
  };

  return (nestedMiddleware as unknown) as Prisma.Middleware;
}
