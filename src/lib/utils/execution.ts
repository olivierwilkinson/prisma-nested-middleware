import { DeferredPromise } from "@open-draft/deferred-promise";
import { omit } from "lodash";
import cloneDeep from "lodash/cloneDeep";

import {
  MiddlewareCall,
  NestedMiddleware,
  NestedParams,
  Target,
} from "../types";

import { isReadAction, isWriteAction } from "./actions";
import { isReadTarget, isWriteTarget } from "./targets";

export async function executeMiddleware(
  middleware: NestedMiddleware,
  params: NestedParams,
  target: Target
): Promise<MiddlewareCall> {
  const originalParams = cloneDeep(params);

  const paramsUpdatedPromise = new DeferredPromise<NestedParams>();
  const nextPromise = new DeferredPromise<any>();

  const result = middleware(params, (updatedParams) => {
    paramsUpdatedPromise.resolve(updatedParams);
    return nextPromise;
  }).catch((e) => {
    // reject params updated callback so it throws when awaited
    paramsUpdatedPromise.reject(e);

    // if next has already been resolved we must throw
    if (nextPromise.state === "fulfilled") {
      throw e;
    }
  });

  const updatedParams = await paramsUpdatedPromise;

  // execute middleware with updated params if action has changed
  if (updatedParams.action !== originalParams.action) {
    return executeMiddleware(
      middleware,
      updatedParams,
      omit(target, "index") as Target
    );
  }

  if (isWriteAction(updatedParams.action) && isWriteTarget(target)) {
    return {
      nextPromise,
      result,
      updatedParams,
      origin: target,
      target: {
        action: updatedParams.action,
        field: target.field,
        relationName: target.relationName,
        index: target.index,
      },
    };
  }

  if (isReadAction(updatedParams.action) && isReadTarget(target)) {
    return {
      nextPromise,
      result,
      updatedParams,
      origin: target,
      target: {
        action: updatedParams.action,
        field: target.field,
        relationName: target.relationName,
      },
    };
  }

  throw new Error("Invalid target and params combination");
}
