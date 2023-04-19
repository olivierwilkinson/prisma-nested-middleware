import {
  LogicalOperator,
  Modifier,
  NestedQueryAction,
  NestedReadAction,
  NestedWriteAction,
} from "../types";

export const queryActions: NestedQueryAction[] = ["where"];
export const readActions: NestedReadAction[] = ["include", "select"];
export const writeActions: NestedWriteAction[] = [
  "create",
  "update",
  "upsert",
  "createMany",
  "updateMany",
  "delete",
  "deleteMany",
  "disconnect",
  "connect",
  "connectOrCreate",
];
export const toOneRelationNonListActions: NestedWriteAction[] = [
  "create",
  "update",
  "delete",
  "upsert",
  "connect",
  "connectOrCreate",
  "disconnect",
];

export function isQueryAction(action: any): action is NestedQueryAction {
  return queryActions.includes(action);
}

export function isReadAction(action: any): action is NestedReadAction {
  return readActions.includes(action);
}

export function isWriteAction(action: any): action is NestedWriteAction {
  return writeActions.includes(action);
}

export const modifiers: Modifier[] = ["is", "isNot", "some", "none", "every"];
export const logicalOperators: LogicalOperator[] = ["AND", "OR", "NOT"];
