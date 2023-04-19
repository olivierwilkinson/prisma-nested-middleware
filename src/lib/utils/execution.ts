import { DeferredPromise } from "@open-draft/deferred-promise";
import { omit } from "lodash";

import {
  MiddlewareCall,
  NestedMiddleware,
  NestedParams,
  Target,
} from "../types";
import { cloneParams } from "./cloneParams";

export async function executeMiddleware(
  middleware: NestedMiddleware,
  params: NestedParams,
  target: Target
): Promise<MiddlewareCall[]> {
  const paramsUpdatedPromise = new DeferredPromise<
    NestedParams | NestedParams[]
  >();
  const nextPromise = new DeferredPromise<any>();

  const result = middleware(cloneParams(params), (updatedParams) => {
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

  if (Array.isArray(updatedParams)) {
    const calls = await Promise.all(
      updatedParams.map((updatedParamsItem) => {
        // execute middleware with updated params if action has changed
        if (updatedParamsItem.action !== params.action) {
          return executeMiddleware(
            middleware,
            updatedParamsItem,
            omit(target, "index") as Target
          );
        }

        return [
          {
            nextPromise,
            result,
            updatedParams: updatedParamsItem,
            origin: target,
            target: {
              ...target,
              action: updatedParamsItem.action as any,
            },
          },
        ];
      })
    );

    return calls.flat();
  }

  // execute middleware with updated params if action has changed
  if (updatedParams.action !== params.action) {
    return executeMiddleware(
      middleware,
      updatedParams,
      omit(target, "index") as Target
    );
  }

  return [
    {
      nextPromise,
      result,
      updatedParams,
      origin: target,
      target: { ...target, action: updatedParams.action as any },
    },
  ];
}
