import { Prisma } from "@prisma/client";
import { cloneDeep, cloneDeepWith } from "lodash";

import { NestedParams } from "../types";

// Prisma v4 requires that instances of Prisma.NullTypes are not cloned,
// otherwise it will parse them as 'undefined' and the operation will fail.
function passThroughNullTypes(value: any) {
  if (
    value instanceof Prisma.NullTypes.DbNull ||
    value instanceof Prisma.NullTypes.JsonNull ||
    value instanceof Prisma.NullTypes.AnyNull
  ) {
    return value;
  }
}

export function cloneParams(params: NestedParams) {
  // only handle null types if they are present, Prisma versions lower than v4
  // do not have them and we can clone the string values as usual
  if (Prisma.NullTypes) {
    return cloneDeepWith(params, passThroughNullTypes);
  }

  return cloneDeep(params);
}
