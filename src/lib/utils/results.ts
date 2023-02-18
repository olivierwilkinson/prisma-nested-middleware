import get from "lodash/get";
import set from "lodash/set";

const parentSymbol = Symbol("parent");

function addParentToResult(parent: any, result: any) {
  if (!Array.isArray(result)) {
    return { ...result, [parentSymbol]: parent };
  }

  return result.map((item) => ({ ...item, [parentSymbol]: parent }));
}

function removeParentFromResult(result: any) {
  if (!Array.isArray(result)) {
    const { [parentSymbol]: _, ...rest } = result;
    return rest;
  }

  return result.map(({ [parentSymbol]: _, ...rest }: any) => rest);
}

export function getNestedResult(result: any, targetPath: string | string[]) {
  if (!Array.isArray(result)) {
    return get(result, targetPath);
  }

  return result.reduce((acc, item) => {
    const itemResult = get(item, targetPath);
    if (typeof itemResult !== "object" || itemResult === null) {
      return acc;
    }

    return acc.concat(addParentToResult(item, itemResult));
  }, []);
}

export function setNestedResult(
  result: any,
  targetPath: string | string[],
  modifiedResult: any
) {
  if (!Array.isArray(result)) {
    return set(result, targetPath, modifiedResult);
  }

  result.forEach((item: any) => {
    const originalResult = get(item, targetPath);

    // if original result was an array we need to filter the result to match
    if (Array.isArray(originalResult)) {
      return set(
        item,
        targetPath,
        removeParentFromResult(
          modifiedResult.filter(
            (modifiedItem: any) => modifiedItem[parentSymbol] === item
          )
        )
      );
    }

    // if the orginal result was not an array we can just set the result
    const modifiedResultItem = modifiedResult.find(
      ({ [parentSymbol]: parent }: any) => parent === item
    );
    return set(
      item,
      targetPath,
      modifiedResultItem ? removeParentFromResult(modifiedResultItem) : null
    );
  });
}
