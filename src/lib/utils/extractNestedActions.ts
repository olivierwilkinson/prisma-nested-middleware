import { Prisma } from "@prisma/client";
import get from "lodash/get";

import {
  LogicalOperator,
  NestedParams,
  NestedWriteAction,
  Target,
} from "../types";

import {
  isWriteAction,
  logicalOperators,
  modifiers,
  readActions,
} from "./actions";
import { findOppositeRelation, relationsByModel } from "./relations";

type NestedActionInfo = {
  params: NestedParams;
  target: Target;
};

// actions have nested relations inside fields within the args object, sometimes
// relations are defined directly in the args object because the action is in a
// to one relation, for example the update action. Add undefined for actions where this
// can happen
export const fieldsByWriteAction: Record<
  NestedWriteAction,
  (string | undefined)[]
> = {
  create: [undefined, "data"],
  update: [undefined, "data"],
  upsert: ["update", "create"],
  connectOrCreate: ["create"],
  createMany: ["data"],
  updateMany: ["data"],
  connect: [],
  disconnect: [],
  delete: [],
  deleteMany: [],
};

export function extractRelationLogicalWhereActions(
  params: NestedParams,
  parentTarget?: Target,
  parentOperations: { logicalOperator: LogicalOperator; index?: number }[] = []
): NestedActionInfo[] {
  const relations = relationsByModel[params.model || ""] || [];
  const nestedWhereActions: NestedActionInfo[] = [];

  const operationsPath: string[] = [];
  parentOperations.forEach(({ logicalOperator, index }) => {
    operationsPath.push(logicalOperator);

    if (typeof index === "number") {
      operationsPath.push(index.toString());
    }
  });

  logicalOperators.forEach((logicalOperator) => {
    const baseArgPath = params.scope ? ["args"] : ["args", "where"];
    const logicalArg = get(params, [
      ...baseArgPath,
      ...operationsPath,
      logicalOperator,
    ]);
    if (!logicalArg) return;

    const nestedOperators = Array.isArray(logicalArg)
      ? logicalArg.map((_, index) => ({ logicalOperator, index }))
      : [{ logicalOperator }];

    nestedOperators.forEach((nestedOperator) => {
      nestedWhereActions.push(
        ...extractRelationLogicalWhereActions(params, parentTarget, [
          ...parentOperations,
          nestedOperator,
        ])
      );
    });

    relations.forEach((relation) => {
      const model = relation.type as Prisma.ModelName;
      const oppositeRelation = findOppositeRelation(relation);

      if (Array.isArray(logicalArg)) {
        logicalArg.forEach((where, index) => {
          const arg = where?.[relation.name];
          if (!arg) return;

          const operations = [...parentOperations, { logicalOperator, index }];
          const foundModifiers = modifiers.filter((mod) => arg[mod]);

          // if there are no modifiers call the where action without a modifier
          if (!foundModifiers.length) {
            nestedWhereActions.push({
              target: {
                action: "where" as const,
                relationName: relation.name,
                operations,
                parentTarget,
              },
              params: {
                model,
                action: "where",
                args: arg,
                runInTransaction: params.runInTransaction,
                dataPath: [],
                scope: {
                  parentParams: params,
                  logicalOperators: operations.map((op) => op.logicalOperator),
                  relations: { to: relation, from: oppositeRelation },
                },
              },
            });

            return;
          }

          // if there are modifiers call the where action with each modifier but
          // not the action without a modifier
          foundModifiers.forEach((modifier) => {
            nestedWhereActions.push({
              target: {
                action: "where" as const,
                relationName: relation.name,
                modifier,
                operations,
                parentTarget,
              },
              params: {
                model,
                action: "where",
                args: arg[modifier],
                runInTransaction: params.runInTransaction,
                dataPath: [],
                scope: {
                  parentParams: params,
                  modifier,
                  logicalOperators: operations.map((op) => op.logicalOperator),
                  relations: { to: relation, from: oppositeRelation },
                },
              },
            });
          });
        });

        return;
      }

      const arg = logicalArg[relation.name];
      if (!arg) return;

      const operations = [...parentOperations, { logicalOperator }];
      const foundModifiers = modifiers.filter((mod) => arg[mod]);

      if (!foundModifiers.length) {
        nestedWhereActions.push({
          target: {
            action: "where",
            relationName: relation.name,
            operations,
            parentTarget,
          },
          params: {
            model,
            action: "where",
            args: arg,
            runInTransaction: params.runInTransaction,
            dataPath: [],
            scope: {
              parentParams: params,
              logicalOperators: operations.map((op) => op.logicalOperator),
              relations: { to: relation, from: oppositeRelation },
            },
          },
        });

        return;
      }

      foundModifiers.forEach((modifier) => {
        nestedWhereActions.push({
          target: {
            action: "where",
            relationName: relation.name,
            modifier,
            operations,
            parentTarget,
          },
          params: {
            model,
            action: "where",
            args: modifier ? arg[modifier] : arg,
            runInTransaction: params.runInTransaction,
            dataPath: [],
            scope: {
              parentParams: params,
              modifier,
              logicalOperators: operations.map((op) => op.logicalOperator),
              relations: { to: relation, from: oppositeRelation },
            },
          },
        });
      });
    });
  });

  return nestedWhereActions;
}

export function extractRelationWhereActions(
  params: NestedParams,
  parentTarget?: Target
): NestedActionInfo[] {
  const relations = relationsByModel[params.model || ""] || [];
  const runInTransaction = params.runInTransaction;

  const nestedWhereActions = extractRelationLogicalWhereActions(
    params,
    parentTarget
  );

  relations.forEach((relation) => {
    const model = relation.type as Prisma.ModelName;
    const oppositeRelation = findOppositeRelation(relation);

    const baseArgPath = params.scope ? ["args"] : ["args", "where"];
    const arg = get(params, [...baseArgPath, relation.name]);
    if (!arg) return;

    const foundModifiers = modifiers.filter((mod) => arg[mod]);
    if (!foundModifiers.length) {
      nestedWhereActions.push({
        target: {
          action: "where",
          relationName: relation.name,
          parentTarget,
        },
        params: {
          model,
          action: "where",
          args: arg,
          runInTransaction,
          dataPath: [],
          scope: {
            parentParams: params,
            relations: { to: relation, from: oppositeRelation },
          },
        },
      });

      return;
    }

    foundModifiers.forEach((modifier) => {
      nestedWhereActions.push({
        target: {
          action: "where",
          relationName: relation.name,
          modifier,
          parentTarget,
        },
        params: {
          model,
          action: "where",
          args: modifier ? arg[modifier] : arg,
          runInTransaction,
          dataPath: [],
          scope: {
            parentParams: params,
            modifier,
            relations: { to: relation, from: oppositeRelation },
          },
        },
      });
    });
  });

  return nestedWhereActions.concat(
    nestedWhereActions.flatMap((nestedActionInfo) =>
      extractRelationWhereActions(
        nestedActionInfo.params,
        nestedActionInfo.target
      )
    )
  );
}

export function extractRelationWriteActions(
  params: NestedParams,
  parentTarget?: Target
): NestedActionInfo[] {
  const relations = relationsByModel[params.model || ""] || [];

  if (!isWriteAction(params.action)) return [];

  const nestedWriteActions: NestedActionInfo[] = [];
  const fields = fieldsByWriteAction[params.action] || [];

  relations.forEach((relation) => {
    const model = relation.type as Prisma.ModelName;
    const runInTransaction = params.runInTransaction;
    const oppositeRelation = findOppositeRelation(relation);

    fields.forEach((field) => {
      const argPath = ["args", field, relation.name].filter(
        (part): part is string => !!part
      );
      const arg = get(params, argPath, {});

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
              ...arg[action].map(
                (item: any, index: number): NestedActionInfo => ({
                  target: {
                    field,
                    relationName: relation.name,
                    action,
                    index,
                    parentTarget,
                  },
                  params: {
                    model,
                    action,
                    args: item,
                    runInTransaction,
                    dataPath: [],
                    scope: {
                      parentParams: params,
                      relations: { to: relation, from: oppositeRelation },
                    },
                  },
                })
              )
            );
            return;
          }

          nestedWriteActions.push({
            target: {
              field,
              relationName: relation.name,
              action,
              parentTarget,
            },
            params: {
              model,
              action,
              args: arg[action],
              runInTransaction,
              dataPath: [],
              scope: {
                parentParams: params,
                relations: { to: relation, from: oppositeRelation },
              },
            },
          });
        });
    });
  });

  return nestedWriteActions.concat(
    nestedWriteActions.flatMap((nestedActionInfo) =>
      extractRelationWriteActions(
        nestedActionInfo.params,
        nestedActionInfo.target
      )
    )
  );
}

export function extractRelationReadActions(
  params: NestedParams,
  parentTarget?: Target
): NestedActionInfo[] {
  const relations = relationsByModel[params.model || ""] || [];
  const nestedActions: NestedActionInfo[] = [];

  relations.forEach((relation) => {
    const model = relation.type as Prisma.ModelName;
    const runInTransaction = params.runInTransaction;
    const oppositeRelation = findOppositeRelation(relation);

    readActions.forEach((action) => {
      const arg = get(params, ["args", action, relation.name]);
      if (!arg) return;

      const readActionInfo = {
        params: {
          model,
          action,
          args: arg,
          runInTransaction,
          dataPath: [],
          scope: {
            parentParams: params,
            relations: { to: relation, from: oppositeRelation },
          },
        },
        target: { action, relationName: relation.name, parentTarget },
      };

      nestedActions.push(readActionInfo);

      if (readActionInfo.params.args?.where) {
        const whereActionInfo = {
          target: {
            action: "where" as const,
            relationName: relation.name,
            readAction: action,
            parentTarget: readActionInfo.target,
          },
          params: {
            model: readActionInfo.params.model,
            action: "where" as const,
            args: readActionInfo.params.args.where,
            runInTransaction: params.runInTransaction,
            dataPath: [],
            scope: {
              parentParams: readActionInfo.params,
              relations: readActionInfo.params.scope.relations,
            },
          },
        };
        nestedActions.push(whereActionInfo);
        nestedActions.push(
          ...extractRelationWhereActions(
            whereActionInfo.params,
            whereActionInfo.target
          )
        );
      }
    });
  });

  return nestedActions.concat(
    nestedActions.flatMap((nestedAction) =>
      extractRelationReadActions(nestedAction.params, nestedAction.target)
    )
  );
}

export function extractNestedActions(params: NestedParams): NestedActionInfo[] {
  return [
    ...extractRelationWhereActions(params),
    ...extractRelationReadActions(params),
    ...extractRelationWriteActions(params),
  ];
}
