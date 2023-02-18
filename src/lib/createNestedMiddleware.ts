import { Prisma } from "@prisma/client";

import { NestedMiddleware, MiddlewareCall } from "./types";
import { extractNestedActions } from "./utils/actions";
import { executeMiddleware } from "./utils/execution";
import { buildParamsFromCalls } from "./utils/params";
import { getNestedResult, setNestedResult } from "./utils/results";

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
    const relations = relationsByModel[params.model || ""] || [];
    let calls: MiddlewareCall[] = [];

    try {
      const executionResults = await Promise.allSettled(
        relations.flatMap((relation) =>
          extractNestedActions(params, relation).map((nestedAction) =>
            executeMiddleware(
              nestedMiddleware,
              nestedAction.params,
              nestedAction.target
            )
          )
        )
      );

      // populate middlewareCalls with successful calls first so we can resolve
      // next promises if we find a rejection
      calls = executionResults
        .filter(isFulfilled)
        .map(({ value: call }) => call);

      // consider any rejected execution as a failure of all nested middleware
      const failedExecution = executionResults.find(isRejected);
      if (failedExecution) throw failedExecution.reason;

      // evaluate result from parent middleware
      const result = await middleware(
        buildParamsFromCalls(calls, params),
        next
      );

      // resolve nested middleware next functions with relevant slice of result
      await Promise.all(
        calls.map(async (call) => {
          // if relationship hasn't been included nestedResult is undefined.
          call.nextPromise.resolve(
            result && getNestedResult(result, call.target.relationName)
          );

          // set final result relation to be result of nested middleware
          setNestedResult(result, call.target.relationName, await call.result);
        })
      );

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
