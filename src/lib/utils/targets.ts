import { ReadTarget, Target, WriteTarget } from "../types";

import {
  isReadAction,
  isWriteAction,
} from "./actions";

export function isReadTarget(target: any): target is ReadTarget {
  return isReadAction(target.action);
}

export function isWriteTarget(target: any): target is WriteTarget {
  return isWriteAction(target.action);
}

export function buildWriteTargetPath(target: WriteTarget) {
  const targetPath = [target.field, target.relationName, target.action];

  if (typeof target.index === "number") {
    targetPath.push(target.index.toString());
  }

  return targetPath;
}

export function buildReadTargetPath(target: ReadTarget) {
  if (target.field) {
    return [target.field, target.relationName, target.action];
  }

  return [target.action, target.relationName];
}

export function buildTargetPath(target: Target) {
  return isReadTarget(target)
    ? buildReadTargetPath(target)
    : buildWriteTargetPath(target);
}
