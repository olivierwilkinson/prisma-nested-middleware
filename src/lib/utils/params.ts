import set from "lodash/set";
import get from "lodash/get";
import unset from "lodash/unset";
import cloneDeep from "lodash/cloneDeep";

import {
  MiddlewareCall,
  NestedAction,
  NestedParams,
  ReadTarget,
  WriteTarget,
} from "../types";

import {
  buildReadTargetPath,
  buildWriteTargetPath,
  isReadTarget,
  isWriteTarget,
} from "./targets";
import { setNestedResult } from "./results";
import { normaliseNestedArgs } from "./args";
import { isReadAction, isWriteAction } from "./actions";

function addWriteArgsToParams(
  params: NestedParams,
  target: WriteTarget,
  args: any
) {
  const targetPath = buildWriteTargetPath(target);
  const targetArgs = get(params.args, targetPath);

  // if target doesn't exist, we can just set the updated args
  if (!targetArgs) {
    set(params.args, targetPath, args);
    return;
  }

  // createMany operations cannot be turned into arrays of operations so merge
  // their data fields
  if (target.action === "createMany") {
    set(
      params.args,
      [...targetPath, "data"],
      [...targetArgs.data, ...args.data]
    );
    return;
  }

  // if target is an array of operations push args as another operation
  if (Array.isArray(targetArgs)) {
    targetArgs.push(args);
    return;
  }

  // convert target to an array of operations with the target args as the
  // first operation and passed args as the second
  set(params.args, targetPath, [targetArgs, args]);
}

function removeWriteArgsFromParams(params: NestedParams, target: WriteTarget) {
  // remove args from target
  unset(params.args, buildWriteTargetPath(target));

  // TODO:- check if we must handle createMany operations

  // if target parent is now an empty object or array we must remove it
  const targetParentPath = [target.field, target.relationName];
  const targetParent = get(params.args, targetParentPath);
  if (Object.keys(targetParent).length === 0) {
    unset(params.args, targetParentPath);
  }
}

function removeReadArgsFromParams(params: NestedParams, target: ReadTarget) {
  const targetPath = buildReadTargetPath(target);

  // remove args from target
  unset(params.args, targetPath);

  // if target parent is an array with only unset values we must remove it
  const targetParentPath = targetPath.slice(0, -1);
  const targetParent = get(params.args, targetParentPath);
  if (Object.keys(targetParent).length === 0) {
    unset(params.args, targetParentPath);
  }
}

export function assertActionChangeIsValid(
  previousAction: NestedAction,
  nextAction: NestedAction
) {
  if (isReadAction(previousAction) && isWriteAction(nextAction)) {
    throw new Error(
      "Changing a read action to a write action is not supported"
    );
  }

  if (isWriteAction(previousAction) && isReadAction(nextAction)) {
    throw new Error(
      "Changing a write action to a read action is not supported"
    );
  }
}

export function buildParamsFromCalls(
  calls: MiddlewareCall[],
  parentParams: NestedParams
) {
  const finalParams = cloneDeep(parentParams);

  calls.forEach(({ target, origin, updatedParams }) => {
    assertActionChangeIsValid(origin.action, target.action);

    if (isWriteTarget(target) && isWriteTarget(origin)) {
      const targetPath = buildWriteTargetPath(target);
      const targetArgs = get(finalParams.args, targetPath);
      const updatedArgs = normaliseNestedArgs(
        target.action,
        updatedParams.args
      );

      // if target hasn't changed but is an array it has been merged
      // the original target must be the first element of the array
      if (target.action === origin.action && Array.isArray(targetArgs)) {
        targetArgs[0] = updatedArgs;
        return;
      }

      // set the updated args if the target hasn't changed
      if (target.action === origin.action) {
        set(finalParams.args, targetPath, updatedArgs);
        return;
      }

      // if action has changed we add merge args with target and remove the args
      // from the origin
      addWriteArgsToParams(finalParams, target, updatedArgs);
      removeWriteArgsFromParams(finalParams, origin);
    }

    if (isReadTarget(target) && isReadTarget(origin)) {
      const targetPath = buildReadTargetPath(target);
      // Do nothing if the target action has changed and already exists. Having
      // a select and include at the same level is not supported so we should
      // pass this through so Prisma can throw an error to let the user know.
      if (
        origin.action !== target.action &&
        typeof get(finalParams.args, targetPath) !== "undefined"
      ) {
        return;
      }

      // because includes and selects cannot be at the same level we can safely
      // set target path to be the updated args without worrying about
      // overwriting the original args
      setNestedResult(
        finalParams.args,
        targetPath,
        normaliseNestedArgs(target.action, updatedParams.args)
      );

      // remove the origin args if the action has changed
      if (target.action !== origin.action) {
        removeReadArgsFromParams(finalParams, origin);
      }
    }
  });

  return finalParams;
}
