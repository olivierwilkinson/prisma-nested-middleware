import {
  LogicalOperator,
  QueryTarget,
  ReadTarget,
  Target,
  WriteTarget,
} from "../types";

import { isQueryAction, isReadAction, isWriteAction } from "./actions";

export function isQueryTarget(target: any): target is QueryTarget {
  return isQueryAction(target.action);
}

export function isReadTarget(target: any): target is ReadTarget {
  return isReadAction(target.action);
}

export function isWriteTarget(target: any): target is WriteTarget {
  return isWriteAction(target.action);
}

export function buildOperationsPath(
  operations?: { logicalOperator: LogicalOperator; index?: number }[]
) {
  if (!operations) return [];

  return operations.flatMap((op) => {
    if (typeof op.index === "number")
      return [op.logicalOperator, op.index.toString()];

    return [op.logicalOperator];
  });
}

export function buildQueryTargetPath(target: QueryTarget): string[] {
  const path = target.parentTarget ? buildTargetPath(target.parentTarget) : [];

  if (!target.relationName) {
    return [...path, target.action];
  }

  if (target.operations) {
    path.push(...buildOperationsPath(target.operations));
  }

  if (target.readAction) {
    path.push(target.readAction);
  }

  path.push(target.relationName);

  if (target.readAction) {
    path.push("where");
  }

  if (target.modifier) {
    path.push(target.modifier);
  }

  return path;
}

export function buildWriteTargetPath(target: WriteTarget): string[] {
  const path = target.parentTarget ? buildTargetPath(target.parentTarget) : [];

  if (target.field) {
    path.push(target.field);
  }

  path.push(target.relationName, target.action);

  if (typeof target.index === "number") {
    path.push(target.index.toString());
  }

  return path;
}

export function buildReadTargetPath(target: ReadTarget): string[] {
  const path = target.parentTarget ? buildTargetPath(target.parentTarget) : [];

  if (!target.relationName) {
    return [...path, target.action];
  }

  if (!target.field) {
    return [...path, target.action, target.relationName];
  }

  return [...path, target.field, target.relationName, target.action];
}

export function buildTargetPath(target: Target) {
  if (isQueryTarget(target)) return buildQueryTargetPath(target);
  if (isReadTarget(target)) return buildReadTargetPath(target);
  return buildWriteTargetPath(target);
}

export const buildTargetRelationPath = (target: Target): string[] | null => {
  if (!isReadTarget(target)) return null;

  if (target.parentTarget) {
    const basePath = buildTargetRelationPath(target.parentTarget);
    if (!basePath) return null;

    return target.relationName ? [...basePath, target.relationName] : basePath;
  }

  return target.relationName ? [target.relationName] : [];
};

export function targetChainLength(target: Target, count = 0): number {
  if (!target.parentTarget) {
    return count + 1;
  }
  return targetChainLength(target.parentTarget, count + 1);
}
