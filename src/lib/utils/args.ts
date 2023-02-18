import { NestedAction } from "../types";

export function normaliseRootArgs(action: NestedAction, args: any) {
  if (action === "create") {
    return { data: args };
  }

  return args;
}

export function normaliseNestedArgs(action: NestedAction, args: any) {
  if (action === "create") {
    return args.data;
  }

  return args;
}
