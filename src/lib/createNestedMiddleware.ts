import { Prisma } from "@prisma/client";

import { NestedMiddleware, MiddlewareCall } from "./types";
import { extractNestedActions } from "./utils/extractNestedActions";
import { executeMiddleware } from "./utils/execution";
import { buildParamsFromCalls } from "./utils/params";
import { buildTargetRelationPath } from "./utils/targets";
import {
  addIdSymbolsToResult,
  getRelationResult,
  stripIdSymbolsFromResult,
  updateResultRelation,
} from "./utils/results";

function isFulfilled(
  result: PromiseSettledResult<any>
): result is PromiseFulfilledResult<any> {
  return result.status === "fulfilled";
}

function isRejected(
  result: PromiseSettledResult<any>
): result is PromiseRejectedResult {
  return result.status === "rejected";
}

export function createNestedMiddleware<T>(
  middleware: NestedMiddleware
): Prisma.Middleware<T> {
  const nestedMiddleware: NestedMiddleware = async (params, next) => {
    let calls: MiddlewareCall[] = [];

    try {
      const executionResults = await Promise.allSettled(
        extractNestedActions(params).map((nestedAction) =>
          executeMiddleware(
            middleware,
            nestedAction.params,
            nestedAction.target
          )
        )
      );

      // populate middlewareCalls with successful calls first so we can resolve
      // next promises if we find a rejection
      calls = executionResults
        .filter(isFulfilled)
        .flatMap(({ value }) => value);

      // consider any rejected execution as a failure of all nested middleware
      const failedExecution = executionResults.find(isRejected);
      if (failedExecution) throw failedExecution.reason;

      // build updated params from middleware calls
      const updatedParams = buildParamsFromCalls(calls, params);

      // evaluate result from parent middleware
      const result = await middleware(updatedParams, next);

      // bail out if result is null
      if (result === null) {
        calls.forEach((call) => call.nextPromise.resolve(undefined));
        await Promise.all(calls.map((call) => call.result));
        return null;
      }

      // add id symbols to result so we can use them to update result relations
      // with the results from nested middleware
      addIdSymbolsToResult(result);

      const nestedNextResults = await Promise.all(
        calls.map(async (call) => {
          const relationsPath = buildTargetRelationPath(call.target);

          if (result === null || !relationsPath) {
            call.nextPromise.resolve(undefined);
            await call.result;
            return null;
          }

          const relationResults = getRelationResult(result, relationsPath);
          call.nextPromise.resolve(relationResults);
          const updatedResult = await call.result;

          if (typeof relationResults === "undefined") {
            return null;
          }

          return {
            relationsPath,
            updatedResult,
          };
        })
      );
      

      // keep only the relevant result updates from nested next results
      const resultUpdates = nestedNextResults.filter(
        (update): update is { relationsPath: string[]; updatedResult: any } =>
          !!update
      );

      resultUpdates
        .sort((a, b) => b.relationsPath.length - a.relationsPath.length)
        .forEach(({ relationsPath, updatedResult }, i) => {
          const remainingUpdates = resultUpdates.slice(i);
          const nextUpdatePath = relationsPath.slice(0, -1).join(".");

          const nextUpdate = remainingUpdates.find(
            (update) => update?.relationsPath.join(".") === nextUpdatePath
          );

          if (nextUpdate) {
            updateResultRelation(
              nextUpdate.updatedResult,
              relationsPath[relationsPath.length - 1],
              updatedResult
            );
            return;
          }

          updateResultRelation(
            result,
            relationsPath[relationsPath.length - 1],
            updatedResult
          );
        });

      stripIdSymbolsFromResult(result);

      return result;
    } catch (e) {
      // if an error occurs reject the nested next functions promises to stop
      // them being pending forever
      calls.forEach((call) => call.nextPromise.reject(e));

      // wait for all nested middleware to settle before rethrowing
      await Promise.all(calls.map((call) => call.result.catch(() => {})));

      // bubble error up to parent middleware
      throw e;
    }
  };

  return (nestedMiddleware as unknown) as Prisma.Middleware;
}
