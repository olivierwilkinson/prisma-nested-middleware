import { Prisma } from "@prisma/client";
import get from "lodash/get";

import {
  NestedParams,
  NestedReadAction,
  NestedWriteAction,
  Target,
} from "../types";

import { normaliseRootArgs } from "./args";

export const readActions: NestedReadAction[] = ["include", "select"];
export const writeActions: NestedWriteAction[] = [
  "create",
  "update",
  "upsert",
  "connectOrCreate",
  "createMany",
  "updateMany",
  "delete",
  "deleteMany",
];

export function isReadAction(action: any): action is NestedReadAction {
  return readActions.includes(action);
}

export function isWriteAction(action: any): action is NestedWriteAction {
  return writeActions.includes(action);
}

type NestedActionInfo = {
  params: NestedParams;
  target: Target;
};

const fieldsByWriteAction: Record<NestedWriteAction, string[]> = {
  create: ["data"],
  update: ["data"],
  upsert: ["update", "create"],
  connectOrCreate: ["create"],
  createMany: ["data"],
  updateMany: ["data"],
  delete: [],
  deleteMany: [],
};

export function extractNestedWriteActions(
  params: NestedParams,
  relation: Prisma.DMMF.Field
): NestedActionInfo[] {
  if (!isWriteAction(params.action)) {
    return [];
  }

  const model = relation.type as Prisma.ModelName;
  const runInTransaction = params.runInTransaction;
  const nestedWriteActions: NestedActionInfo[] = [];
  const fields = fieldsByWriteAction[params.action] || [];

  fields.forEach((field) => {
    const arg = get(params.args, [field, relation.name], {});

    Object.keys(arg)
      .filter(isWriteAction)
      .forEach((action) => {
        /*
            Add single writes passed as a list as separate operations.
  
            Checking if the operation is an array is enough since only lists of
            separate operations are passed as arrays at the top level. For example
            a nested create may be passed as an array but a nested createMany will
            pass an object with a data array.
          */
        if (Array.isArray(arg[action])) {
          nestedWriteActions.push(
            ...arg[action].map((item: any, index: number) => ({
              target: {
                field,
                relationName: relation.name,
                action,
                index,
              },
              params: {
                model,
                action,
                args: normaliseRootArgs(action, item),
                runInTransaction,
                dataPath: [],
                scope: params,
                relation,
              },
            }))
          );
          return;
        }

        nestedWriteActions.push({
          target: {
            field,
            relationName: relation.name,
            action,
          },
          params: {
            model,
            action,
            args: normaliseRootArgs(action, arg[action]),
            runInTransaction,
            dataPath: [],
            scope: params,
            relation,
          },
        });
      });
  });

  return nestedWriteActions;
}

export function extractNestedReadActions(
  params: NestedParams,
  relation: Prisma.DMMF.Field
): NestedActionInfo[] {
  const model = relation.type as Prisma.ModelName;
  const runInTransaction = params.runInTransaction;
  const relationName = relation.name;
  const nestedReadActions: NestedActionInfo[] = [];

  readActions.forEach((action) => {
    const arg = get(params.args, [action, relation.name]);
    if (!arg) return;

    nestedReadActions.push({
      target: { action, relationName: relation.name },
      params: {
        model,
        action,
        args: normaliseRootArgs(action, arg),
        runInTransaction,
        dataPath: [],
        scope: params,
        relation,
      },
    });

    // push select nested in an include
    if (action === "include" && arg.select) {
      nestedReadActions.push({
        target: { field: "include", action: "select", relationName },
        params: {
          model,
          action: "select",
          args: normaliseRootArgs("select", arg.select),
          runInTransaction,
          dataPath: [],
          scope: params,
          relation,
        },
      });
    }
  });

  return nestedReadActions;
}

export function extractNestedActions(
  params: NestedParams,
  relation: Prisma.DMMF.Field
): NestedActionInfo[] {
  return [
    ...extractNestedWriteActions(params, relation),
    ...extractNestedReadActions(params, relation),
  ];
}
