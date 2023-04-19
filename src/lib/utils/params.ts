import set from "lodash/set";
import get from "lodash/get";
import unset from "lodash/unset";
import merge from "lodash/merge";
import { omit } from "lodash";

import {
  MiddlewareCall,
  NestedAction,
  NestedParams,
  NestedWriteAction,
  ReadTarget,
  Target,
  WriteTarget,
} from "../types";

import {
  buildQueryTargetPath,
  buildReadTargetPath,
  buildTargetPath,
  buildWriteTargetPath,
  isQueryTarget,
  isReadTarget,
  isWriteTarget,
  targetChainLength,
} from "./targets";
import {
  isQueryAction,
  isReadAction,
  isWriteAction,
  toOneRelationNonListActions,
} from "./actions";
import { fieldsByWriteAction } from "./extractNestedActions";
import { cloneParams } from "./cloneParams";

function addWriteArgsToParams(
  params: NestedParams,
  target: WriteTarget,
  updatedParams: NestedParams
) {
  const toOneRelation = !updatedParams.scope?.relations.to.isList;
  const targetPath = buildWriteTargetPath(target);
  const targetArgs = get(params.args, targetPath);

  // it's possible to target args that have already been updated if the user
  // has reused the same object in multiple places when changing action, in this
  // case we can just return
  if (targetArgs === updatedParams.args) {
    return;
  }

  // if target doesn't exist or is a boolean action, we can just set the args
  if (!targetArgs || typeof targetArgs === "boolean") {
    set(params.args, targetPath, updatedParams.args);
    return;
  }

  // createMany operations cannot be turned into arrays of operations so merge
  // their data fields
  if (target.action === "createMany") {
    set(
      params.args,
      [...targetPath, "data"],
      [...targetArgs.data, ...updatedParams.args.data]
    );
    return;
  }

  // to one relations have actions that cannot be turned into arrays of operations
  // so merge their args
  if (toOneRelation && toOneRelationNonListActions.includes(target.action)) {
    merge(get(params.args, targetPath), updatedParams.args);
    return;
  }

  // if target is an array of operations push args as another operation
  if (Array.isArray(targetArgs)) {
    targetArgs.push(updatedParams.args);
    return;
  }

  // convert target to an array of operations with the target args as the
  // first operation and passed args as the second
  set(params.args, targetPath, [targetArgs, updatedParams.args]);
}

function removeWriteArgsFromParams(params: NestedParams, target: WriteTarget) {
  // remove args from target
  const targetPath = buildWriteTargetPath(target);
  unset(params.args, targetPath);

  // if target parent is now an empty object or array we must remove it
  const targetParentPath = targetPath.slice(0, -1);
  const targetParent = get(params.args, targetParentPath);
  if (Object.keys(targetParent).length === 0) {
    unset(params.args, targetParentPath);
  }
}

function removeReadArgsFromParams(params: NestedParams, target: ReadTarget) {
  // remove args from target
  const targetPath = buildReadTargetPath(target);
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

  if (isQueryAction(previousAction) && !isQueryAction(nextAction)) {
    throw new Error(
      "Changing a query action to a non-query action is not supported"
    );
  }
}

function moveActionChangesToEnd(callA: MiddlewareCall, callB: MiddlewareCall) {
  if (callA.target.action !== callA.origin.action) {
    return 1;
  }
  if (callB.target.action !== callB.origin.action) {
    return -1;
  }
  return 0;
}

function findParentCall(
  calls: MiddlewareCall[],
  origin: Target
): MiddlewareCall | undefined {
  return calls.find(
    (call) =>
      origin.parentTarget &&
      buildTargetPath(origin.parentTarget).join(".") ===
        buildTargetPath(call.origin).join(".")
  );
}

export function buildParamsFromCalls(
  calls: MiddlewareCall[],
  parentParams: NestedParams
) {
  const finalParams = cloneParams(parentParams);

  // calls should update the parent calls updated params

  // sort calls so we set from deepest to shallowest
  // actions that are at the same depth should put action changes at the end
  const sortedCalls = calls.sort((a, b) => {
    const aDepth = targetChainLength(a.target);
    const bDepth = targetChainLength(b.target);

    if (aDepth === bDepth) {
      return moveActionChangesToEnd(a, b);
    }

    return bDepth - aDepth;
  });

  // eslint-disable-next-line complexity
  sortedCalls.forEach((call, i) => {
    const parentCall = findParentCall(calls.slice(i), call.origin);
    const targetParams = parentCall?.updatedParams || finalParams;

    const origin = omit(call.origin, "parentTarget");
    const target = omit(call.target, "parentTarget");

    if (origin.action !== target.action) {
      assertActionChangeIsValid(origin.action, target.action);
    }

    if (isWriteTarget(target) && isWriteTarget(origin)) {
      // if action has not changed use normal target to set args
      if (target.action === origin.action) {
        const targetPath = buildWriteTargetPath(target);
        const targetArgs = get(targetParams.args, targetPath);

        // if target hasn't changed but is an array it has been merged
        // the original target must be the first element of the array
        if (Array.isArray(targetArgs)) {
          targetArgs[0] = call.updatedParams.args;
          return;
        }

        // set the updated args if the target hasn't changed
        set(targetParams.args, targetPath, call.updatedParams.args);
        return;
      }

      // if parent action has not changed we can use our normal targets
      if (
        targetParams.action === call.updatedParams.scope?.parentParams.action
      ) {
        addWriteArgsToParams(targetParams, target, call.updatedParams);
        removeWriteArgsFromParams(targetParams, origin);
        return;
      }

      // if parent action has changed we must modify out target to match the
      // parent action
      const fields =
        fieldsByWriteAction[targetParams.action as NestedWriteAction];

      fields.forEach((field) => {
        const newOrigin = { ...origin, field };
        const newTarget = { ...target, field };

        if (get(targetParams.args, buildWriteTargetPath(newOrigin))) {
          // if action has changed we add merge args with target and remove the
          // args from the origin
          addWriteArgsToParams(targetParams, newTarget, call.updatedParams);
          removeWriteArgsFromParams(targetParams, newOrigin);
        }
      });
    }

    if (isReadTarget(target) && isReadTarget(origin)) {
      const targetPath = buildReadTargetPath(target);
      // Do nothing if the target action has changed and already exists. Having
      // a select and include at the same level is not supported so we should
      // pass this through so Prisma can throw an error to let the user know.
      if (
        origin.action !== target.action &&
        typeof get(targetParams, targetPath) !== "undefined"
      ) {
        return;
      }

      // because includes and selects cannot be at the same level we can safely
      // set target path to be the updated args without worrying about
      // overwriting the original args
      set(targetParams.args, targetPath, call.updatedParams.args);

      // remove the origin args if the action has changed
      if (target.action !== origin.action) {
        removeReadArgsFromParams(targetParams, origin);
      }
    }

    if (isQueryTarget(target) && isQueryTarget(origin)) {
      if (target.readAction) {
        set(targetParams.args, "where", call.updatedParams.args);
        return;
      }

      const basePath = parentCall ? [] : ["where"];
      set(
        targetParams.args,
        [...basePath, ...buildQueryTargetPath(target)],
        call.updatedParams.args
      );
    }
  });

  return finalParams;
}
