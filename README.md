<div align="center">
<h1>Prisma Nested Middleware</h1>

<p>Middleware that is called for every nested relation in a Prisma query.</p>

<p>
  Vanilla Prisma middleware is great for modifying top-level queries but
  becomes difficult to use when middleware must handle
  <a href="https://www.prisma.io/docs/concepts/components/prisma-client/relation-queries#nested-writes">nested writes</a>
  or modify where objects that reference relations.
  See the <a href="https://github.com/prisma/prisma/issues/4211">existing issue regarding nested middleware</a>
  for more information.
</p>

<p>
  This library creates middleware that is called for relations nested in the
  params object, allowing you to modify params and results without having to
  recurse through params objects yourself.
</p>

</div>

<hr />

[![Build Status][build-badge]][build]
[![version][version-badge]][package]
[![MIT License][license-badge]][license]
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![PRs Welcome][prs-badge]][prs]

## Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Installation](#installation)
- [Usage](#usage)
  - [Params](#params)
  - [Nested Writes](#nested-writes)
    - [Changing Nested Write Actions](#changing-nested-write-actions)
    - [Splitting Nested Write Actions](#splitting-nested-write-actions)
    - [Write Results](#write-results)
  - [Where](#where)
    - [Where Results](#where-results)
  - [Include](#include)
    - [Include Results](#include-results)
  - [Select](#select)
    - [Select Results](#select-results)
  - [Relations](#relations)
  - [Modifying Nested Write Params](#modifying-nested-write-params)
  - [Modifying Where Params](#modifying-where-params)
  - [Modifying Results](#modifying-results)
  - [Errors](#errors)
- [LICENSE](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Installation

This module is distributed via [npm][npm] which is bundled with [node][node] and
should be installed as one of your project's dependencies:

```
npm install --save prisma-nested-middleware
```

`@prisma/client` is a peer dependency of this library, so you will need to
install it if you haven't already:

```
npm install --save @prisma/client
```

## Usage

Pass a [middleware function](https://www.prisma.io/docs/concepts/components/prisma-client/middleware) to
`createNestedMiddleware`, the returned middleware can be passed to Prisma client's `$use` method:

```javascript
import { createNestedMiddleware } from 'prisma-nested-middleware'

client.$use(createNestedMiddleware(async (params, next) => {
  // update params here
  const result = await next(params)
  // update result here
  return result;
));
```

### Params

The params object passed to the middleware function is a normal Prisma.MiddlewareParams object with the following
differences:

- the `action` field adds the following options: 'connectOrCreate', 'connect', 'disconnect', 'include', 'select' and 'where'
- there is an additional `scope` field that contains information specific to nested relations:

  - the `parentParams` field contains the params object of the parent relation
  - the `modifier` field contains any modifiers the params were wrapped in, for example `some` or `every`.
  - the `logicalOperators` field contains any logical operators between the current relation and it's parent, for example `AND` or `NOT`.
  - the `relations` field contains an object with the relation `to` the current model and `from` the model back to it's parent.

For more information on the `modifier` and `logicalOperators` fields see the [Where](#Where) section.

For more information on the `relations` field see the [Relations](#Relations) section.

The type for the params object is:

```typescript
type NestedParams = Omit<Prisma.MiddlewareParams, "action"> & {
  action:
    | Prisma.PrismaAction
    | "where"
    | "include"
    | "select"
    | "connect"
    | "connectOrCreate"
    | "disconnect";
  scope?: {
    parentParams: NestedParams;
    relations: { to: Prisma.DMMF.Field; from: Prisma.DMMF.Field };
    modifier?: "is" | "isNot" | "some" | "none" | "every";
    logicalOperators?: ("AND" | "OR" | "NOT)[];
  };
};
```

### Nested Writes

The middleware function is called for every [nested write](https://www.prisma.io/docs/concepts/components/prisma-client/relation-queries#nested-writes)
operation in the query. The `action` field is set to the operation being performed, for example "create" or "update".
The `model` field is set to the model being operated on, for example "User" or "Post".

For example take the following query:

```javascript
const result = await client.user.update({
  data: {
    posts: {
      update: {
        where: { id: 1 },
        data: { title: "Hello World" },
      },
    },
  },
});
```

The middleware function will be called with:

```javascript
{
  action: 'update',
  model: 'Post',
  args: {
    where: { id: 1 },
    data: { title: 'Hello World' }
  },
  relations: {
    to: { kind: 'object', name: 'posts', isList: true, ... },
    from: { kind: 'object', name: 'author', isList: false, ... },
  },
  scope: [root params],
}
```

Some nested writes can be passed as an array of operations. In this case the middleware function is called for each
operation in the array. For example take the following query:

```javascript
const result = await client.user.update({
  data: {
    posts: {
      update: [
        { where: { id: 1 }, data: { title: "Hello World" } },
        { where: { id: 2 }, data: { title: "Hello World 2" } },
      ],
    },
  },
});
```

The middleware function will be called with:

```javascript
 {
  action: 'update',
  model: 'Post',
  args: {
    where: { id: 1 },
    data: { title: 'Hello World' }
  },
  relations: {
    to: { kind: 'object', name: 'posts', isList: true, ... },
    from: { kind: 'object', name: 'author', isList: false, ... },
  },
  scope: [root params],
}
```

and

```javascript
 {
  action: 'update',
  model: 'Post',
  args: {
    where: { id: 2 },
    data: { title: 'Hello World 2' }
  },
  relations: {
    to: { kind: 'object', name: 'posts', isList: true, ... },
    from: { kind: 'object', name: 'author', isList: false, ... },
  },
  scope: [root params],
}
```

#### Changing Nested Write Actions

The middleware function can change the action that is performed on the model. For example take the following query:

```javascript
const result = await client.user.update({
  data: {
    posts: {
      update: {
        where: { id: 1 }
        data: { title: 'Hello World' }
      },
    },
  },
});
```

The middleware function could be used to change the action to `upsert`:

```javascript
const middleware = createNestedMiddleware((params, next) => {
  if (params.model === "Post" && params.action === "update") {
    return next({
      ...params,
      action: "upsert",
      args: {
        where: params.args.where,
        create: params.args.data,
        update: params.args.data,
      },
    });
  }
  return next(params);
});
```

The final query would be modified by the above middleware to:

```javascript
const result = await client.user.update({
  data: {
    posts: {
      upsert: {
        where: { id: 1 },
        create: { title: "Hello World" },
        update: { title: "Hello World" },
      },
    },
  },
});
```

When changing the action it is possible for the action to already exist. In this case the resulting actions are merged.
For example take the following query:

```javascript
const result = await client.user.update({
  data: {
    posts: {
      update: {
        where: { id: 1 },
        data: { title: "Hello World" },
      },
      upsert: {
        where: { id: 2 },
        create: { title: "Hello World 2" },
        update: { title: "Hello World 2" },
      },
    },
  },
});
```

Using the same middleware defined before the update action would be changed to an upsert action, however there is
already an upsert action so the two actions are merged into a upsert operation array with the new operation added to
the end of the array. When the existing action is already a list of operations the new operation is added to the end of
the list. The final query in this case would be:

```javascript
const result = await client.user.update({
  data: {
    posts: {
      upsert: [
        {
          where: { id: 2 },
          create: { title: "Hello World 2" },
          update: { title: "Hello World 2" },
        },
        {
          where: { id: 1 },
          create: { title: "Hello World" },
          update: { title: "Hello World" },
        },
      ],
    },
  },
});
```

Sometimes it is not possible to merge the actions together in this way. The `createMany` action does not support
operation arrays so the `data` field of the `createMany` action is merged instead. For example take the following query:

```javascript
const result = await client.user.create({
  data: {
    posts: {
      createMany: {
        data: [{ title: "Hello World" }, { title: "Hello World 2" }],
      },
      create: {
        title: "Hello World 3",
      },
    },
  },
});
```

If the `create` action was changed to be a `createMany` action the `data` field would be added to the end of the existing
`createMany` action. The final query would be:

```javascript
const result = await client.user.create({
  data: {
    posts: {
      createMany: {
        data: [
          { title: "Hello World" },
          { title: "Hello World 2" },
          { title: "Hello World 3" },
        ],
      },
    },
  },
});
```

It is also not possible to merge the actions together by creating an array of operations for non-list relations. For
example take the following query:

```javascript
const result = await client.user.update({
  data: {
    profile: {
      create: {
        bio: "My personal bio",
        age: 30,
      },
      update: {
        where: { id: 1 },
        data: { bio: "Updated bio" },
      },
    },
  },
});
```

If the `update` action was changed to be a `create` action using the following middleware:

```javascript
const middleware = createNestedMiddleware((params, next) => {
  if (params.model === "Profile" && params.action === "update") {
    return next({
      ...params,
      action: "create",
      args: params.args.data,
    });
  }
  return next(params);
});
```

The `create` action from the `update` action would need be merged with the existing `create` action, however since
`profile` is not a list relation we must merge together the resulting objects instead, resulting in the final query:

```javascript
const result = await client.user.create({
  data: {
    profile: {
      create: {
        bio: "Updated bio",
        age: 30,
      },
    },
  },
});
```

#### Splitting Nested Write Actions

The middleware function can also split the action into multiple actions by passing an array of params to the `next`
function. For example take the following query:

```javascript
const result = await client.user.update({
  data: {
    posts: {
      delete: { id: 1 },
    },
  },
});
```

A middleware function that changes the `delete` into an `update` and `disconnect` could be defined as:

```javascript
const middleware = createNestedMiddleware((params, next) => {
  if (params.model === "Post" && params.action === "delete") {
    return next([
      {
        ...params,
        action: "update",
        args: {
          where: params.args,
          data: { deleted: true },
        },
      },
      {
        ...params,
        action: "disconnect",
        args: params.args.where,
      },
    ]);
  }
  return next(params);
});
```

The final query would be:

```javascript
const result = await client.user.update({
  data: {
    posts: {
      update: {
        where: { id: 1 },
        data: { deleted: true },
      },
      disconnect: { id: 1 },
    },
  },
});
```

#### Write Results

The `next` function of middleware calls for nested write actions always return `undefined` as their result. This is
because it the results returned from the root query may not include the data for a particular nested write.
For example take the following query:

```javascript
const result = await client.user.update({
  data: {
    profile: {
      create: {
        bio: "My personal bio",
        age: 30,
      },
    }
    posts: {
      updateMany: {
        where: {
          published: false,
        },
        data: {
          published: true,
        },
      },
    },
  },
  select: {
    id: true,
    posts: {
      where: {
        title: {
          contains: "Hello",
        },
      },
      select: {
        id: true,
      },
    },
  }
});
```

The `profile` field is not included in the `select` object so the result of the `create` action will not be included in
the root result. The `posts` field is included in the `select` object but the `where` object only includes posts with
titles that contain "Hello" and returns only the "id" field, in this case it is not possible to match the result of the
`updateMany` action to the returned Posts.

See [Modifying Results](#modifying-results) for more information on how to update the results of queries.

### Where

The `where` action is called for any relations found inside where objects in params.

Note that the `where` action is not called for the root where object, this is because you need the root action to know
what properties the root where object accepts. For nested where objects this is not a problem as they always follow the
same pattern.

To see where the `where` action is called take the following query:

```javascript
const result = await client.user.findMany({
  where: {
    posts: {
      some: {
        published: true,
      },
    },
  },
});
```

The where object above produces a call for "posts" relation found in the where object. The `modifier` field is set to
"some" since the where object is within the "some" field.

```javascript
{
  action: 'where',
  model: 'Post',
  args: {
    published: true,
  },
  scope: {
    parentParams: {...}
    modifier: 'some',
    relations: {...}
  },
}
```

Relations found inside where AND, OR and NOT logical operators are also found and called with the middleware function,
however the `where` action is not called for the logical operators themselves. For example take the following query:

```javascript
const result = await client.user.findMany({
  where: {
    posts: {
      some: {
        published: true,
        AND: [
          {
            title: "Hello World",
          },
          {
            comments: {
              every: {
                text: "Great post!",
              },
            },
          },
        ],
      },
    },
  },
});
```

The middleware function will be called with the params for "posts" similarly to before, however it will also be called
with the following params:

```javascript
{
  action: 'where',
  model: 'Comment',
  args: {
    text: "Great post!",
  },
  scope: {
    parentParams: {...}
    modifier: 'every',
    logicalOperators: ['AND'],
    relations: {...}
  },
}
```

Since the "comments" relation is found inside the "AND" logical operator the
middleware is called for it. The `modifier` field is set to "every" since the where object is in the "every" field and
the `logicalOperators` field is set to `['AND']` since the where object is inside the "AND" logical operator.

Notice that the middleware function is not called for the first item in the "AND" array, this is because the first item
does not contain any relations.

The `logicalOperators` field tracks all the logical operators between the `parentParams` and the current params. For
example take the following query:

```javascript
const result = await client.user.findMany({
  where: {
    AND: [
      {
        NOT: {
          OR: [
            {
              posts: {
                some: {
                  published: true,
                },
              },
            },
          ],
        },
      },
    ],
  },
});
```

The middleware function will be called with the following params:

```javascript
{
  action: 'where',
  model: 'Post',
  args: {
    published: true,
  },
  scope: {
    parentParams: {...}
    modifier: 'some',
    logicalOperators: ['AND', 'NOT', 'OR'],
    relations: {...},
  },
}
```

The `where` action is also called for relations found in the `where` field of includes and selects. For example:

```javascript
const result = await client.user.findMany({
  select: {
    posts: {
      where: {
        published: true,
      },
    },
  },
});
```

The middleware function will be called with the following params:

```javascript
{
  action: 'where',
  model: 'Post',
  args: {
    published: true,
  },
  scope: {...}
}
```

#### Where Results

The `next` function for a `where` action always resolves with `undefined`.

### Include

The `include` action will be called for any included relation. The `args` field will contain the object or boolean
passed as the relation include. For example take the following query:

```javascript
const result = await client.user.findMany({
  include: {
    profile: true,
    posts: {
      where: {
        published: true,
      },
    },
  },
});
```

For the "profile" relation the middleware function will be called with:

```javascript
{
  action: 'include',
  model: 'Profile',
  args: true,
  scope: {...}
}
```

and for the "posts" relation the middleware function will be called with:

```javascript
{
  action: 'include',
  model: 'Post',
  args: {
    where: {
      published: true,
    },
  },
  scope: {...}
}
```

#### Include Results

The `next` function for an `include` action resolves with the result of the `include` action. For example take the
following query:

```javascript
const result = await client.user.findMany({
  include: {
    profile: true,
  },
});
```

The middleware function for the "profile" relation will be called with:

```javascript
{
  action: 'include',
  model: 'Profile',
  args: true,
  scope: {...}
}
```

And the `next` function will resolve with the result of the `include` action, in this case something like:

```javascript
{
  id: 2,
  bio: 'My personal bio',
  age: 30,
  userId: 1,
}
```

For relations that are included within a list of parent results the `next` function will resolve with a flattened array
of all the models from each parent result. For example take the following query:

```javascript
const result = await client.user.findMany({
  include: {
    posts: true,
  },
});
```

If the root result looks like the following:

```javascript
[
  {
    id: 1,
    name: "Alice",
    posts: [
      {
        id: 1,
        title: "Hello World",
        published: false,
        userId: 1,
      },
      {
        id: 2,
        title: "My first published post",
        published: true,
        userId: 1,
      },
    ],
  },
  {
    id: 2,
    name: "Bob",
    posts: [
      {
        id: 3,
        title: "Clean Code",
        published: true,
        userId: 2,
      },
    ],
  },
];
```

The `next` function for the "posts" relation will resolve with the following:

```javascript
[
  {
    id: 1,
    title: "Hello World",
    published: false,
    userId: 1,
  },
  {
    id: 2,
    title: "My first published post",
    published: true,
    userId: 1,
  },
  {
    id: 3,
    title: "Clean Code",
    published: true,
    userId: 2,
  },
];
```

For more information on how to modify the results of an `include` action see the [Modifying Results](#modifying-results)

### Select

Similarly to the `include` action, the `select` action will be called for any selected relation with the `args` field
containing the object or boolean passed as the relation select. For example take the following query:

```javascript
const result = await client.user.findMany({
  select: {
    posts: true,
    profile: {
      select: {
        bio: true,
      },
    },
  },
});
```

and for the "posts" relation the middleware function will be called with:

```javascript
{
  action: 'select',
  model: 'Post',
  args: true,
  scope: {...}
}
```

For the "profile" relation the middleware function will be called with:

```javascript
{
  action: 'select',
  model: 'Profile',
  args: {
    bio: true,
  },
  scope: {...}
}
```

There is another case possible for selecting fields in Prisma. When including a model it is supported to use a select
object to select fields from the included model. For example take the following query:

```javascript
const result = await client.user.findMany({
  include: {
    profile: {
      select: {
        bio: true,
      },
    },
  },
});
```

From v4 the "select" action is _not_ called for the "profile" relation. This is because it caused two different kinds
of "select" action args, and it was not always possible to distinguish between them.
See [Modifying Selected Fields](#modifying-selected-fields) for more information on how to handle selects.

#### Select Results

The `next` function for a `select` action resolves with the result of the `select` action. This is the same as the
`include` action. See the [Include Results](#include-results) section for more information.

### Relations

The `relations` field of the `scope` object contains the relations relevant to the current model. For example take the
following query:

```javascript
const result = await client.user.create({
  data: {
    email: "test@test.com",
    profile: {
      create: {
        bio: "Hello World",
      },
    },
    posts: {
      create: {
        title: "Hello World",
      },
    },
  },
});
```

The middleware function will be called with the following params for the "profile" relation:

```javascript
{
  action: 'create',
  model: 'Profile',
  args: {
    bio: "Hello World",
  },
  scope: {
    parentParams: {...}
    relations: {
      to: { name: 'profile', kind: 'object', isList: false, ... },
      from: { name: 'user', kind: 'object', isList: false, ... },
    },
  },
}
```

and the following params for the "posts" relation:

```javascript
{
  action: 'create',
  model: 'Post',
  args: {
    title: "Hello World",
  },
  scope: {
    parentParams: {...}
    relations: {
      to: { name: 'posts', kind: 'object', isList: true, ... },
      from: { name: 'author', kind: 'object', isList: false, ... },
    },
  },
}
```

### Modifying Nested Write Params

When writing middleware that modifies the params of a query you should first write the middleware as if it were vanilla
middleware and then add conditions for nested writes.

Say you are writing middleware that sets a default value when creating a model for a particular model:

```javascript
client.$use(
  createNestedMiddleware((params, next) => {
    // ignore any non-root actions
    if (params.scope) {
      return next(params);
    }

    // we only want to add default values for the "Invite" model
    if (params.model !== "Invite") {
      return next(params);
    }

    // handle root actions
    if (params.action === "create") {
      // set default value for the "code" field
      if (!params.args.data.code) {
        params.args.data.code = createCode();
      }
    }

    if (params.action === "createMany") {
      // set default value for the "code" field
      params.args.data.forEach((data) => {
        if (!data.code) {
          data.code = createCode();
        }
      });
    }

    if (params.action === "upsert") {
      // set default value for the "code" field
      if (!params.args.create.code) {
        params.args.create.code = createCode();
      }
    }

    // pass params to next middleware
    return next(params);
  })
);
```

Then add conditions for the different args and actions that can be found in nested writes:

```javascript
client.$use(
  createNestedMiddleware((params, next) => {
    // we only want to add default values for the "Invite" model
    if (params.model !== "Invite") {
      return next(params);
    }

    // handle root actions
    if (params.action === "create") {
      // when the "create" action is from a nested write the data is not in the "data" field
      if (params.scope) {
        if (!params.args.code) {
          params.args.code = createCode();
        }
      } else {
        if (!params.args.data.code) {
          params.args.data.code = createCode();
        }
      }
    }

    // createMany and upsert do not change
    [...]

    // handle the "connectOrCreate" action
    if (params.action === "connectOrCreate") {
      if (!params.args.create.code) {
        params.args.create.code = createCode();
      }
    }

    // pass params to next middleware
    return next(params);
  })
);
```

### Modifying Selected Fields

When writing middleware that modifies the selected fields of a model you must handle all actions that can contain a
select object, this includes:

- `select`
- `include`
- `findMany`
- `findFirst`
- `findUnique`
- `findFirstOrThrow`
- `findUniqueOrThrow`
- `create`
- `update`
- `upsert`
- `delete`
 
This is because the `select` action is only called for relations found _within_ a select object. For example take the
following query:

```javascript
const result = await client.user.findMany({
  include: {
    comments: {
      select: {
        title: true,
        replies: {
          select: {
            title: true,
          },
        },
      },
    },
  },
});
```

For the above query the middleware function will be called with the following for the replies relation:

```javascript
{
  action: 'select',
  model: 'Comment',
  args: {
    select: {
      title: true,
    },
  },
  scope: {...}
}
```

and the following for the comments relation:

```javascript
{
  action: 'include',
  model: 'Comment',
  args: {
    select: {
      title: true,
      replies: {
        select: {
          title: true,
        }
      },
    },
  },
  scope: {...}
}
```

So if you wanted to ensure that the "id" field is always selected you could write the following middleware:

```javascript
client.$use(
  createNestedMiddleware((params, next) => {
    if ([
    'select',
    'include',
    'findMany',
    'findFirst',
    'findUnique',
    'findFirstOrThrow',
    'findUniqueOrThrow',
    'create',
    'update',
    'upsert',
    'delete',
    ].includes(params.action)) {
      if (typeof params.args === 'object' && params.args !== null && params.args.select) {
        return next({
          ...params,
          args: {
            ...params.args,
            select: {
              ...params.args.select,
              id: true,
            },
          },
        });
      }
    }

    return next(params)
  })
);
```

### Modifying Where Params

When writing middleware that modifies the where params of a query it is very important to first write the middleware as
if it were vanilla middleware and then handle the `where` action. This is because the `where` action is not called for
the root where object and so you will need to handle it manually.

Say you are writing middleware that excludes models with a particular field, let's call it "invisible" rather than
"deleted" to make this less familiar:

```javascript
client.$use(
  createNestedMiddleware((params, next) => {
    // ignore any non-root actions
    if (params.scope) {
      return next(params);
    }

    // handle root actions
    // don't handle actions that only accept unique fields such as findUnique or upsert
    if (
      params.action === "findFirst" ||
      params.action === "findMany" ||
      params.action === "updateMany" ||
      params.action === "deleteMany" ||
      params.action === "count" ||
      params.action === "aggregate"
    ) {
      return next({
        ...params,
        where: {
          ...params.where,
          invisible: false,
        },
      });
    }

    // pass params to next middleware
    return next(params);
  })
);
```

Then add conditions for the `where` action:

```javascript
client.$use(
  createNestedMiddleware((params, next) => {
    // handle the "where" action
    if (params.action === "where") {
      return next({
        ...params,
        args: {
          ...params.args,
          invisible: false,
        },
      });
    }

    // handle root actions
    // don't handle actions that only accept unique fields such as findUnique or upsert
    if (
      params.action === "findFirst" ||
      params.action === "findMany" ||
      params.action === "updateMany" ||
      params.action === "deleteMany" ||
      params.action === "count" ||
      params.action === "aggregate"
    ) {
      return next({
        ...params,
        where: {
          ...params.where,
          invisible: false,
        },
      });
    }

    // pass params to next middleware
    return next(params);
  })
);
```

### Modifying Results

When writing middleware that modifies the results of a query you should take the following process:

- handle all the root cases in the same way as you would with vanilla Prisma middleware.
- handle nested results using the `include` and `select` actions.

Say you are writing middleware that adds a timestamp to the results of a query. You would first handle the root cases:

```javascript
client.$use(
  createNestedMiddleware((params, next) => {
    // ignore any non-root actions
    if (params.scope) {
      return next(params);
    }

    // get result from next middleware
    const result = await next(params);

    // ensure result is defined
    if (!result) return result;

    // handle root actions
    if (
      params.action === 'findFirst' ||
      params.action === 'findUnique' ||
      params.action === 'create' ||
      params.action === 'update' ||
      params.action === 'upsert' ||
      params.action === 'delete'
    ) {
      result.timestamp = Date.now();
      return result;
    }

    if (params.action === 'findMany') {
      const result = await next(params);
      result.forEach(model => {
        model.timestamp = Date.now();
      })
      return result;
    }

    return result;
  })
)
```

Then you would handle the nested results using the `include` and `select` actions:

```javascript
client.$use(
  createNestedMiddleware((params, next) => {
    // get result from next middleware
    const result = await next(params);

    // ensure result is defined
    if (!result) return result;

    // handle root actions
    [...]

    // handle nested actions
    if (
      params.action === 'include' ||
      params.action === 'select'
    ) {
      if (Array.isArray(result)) {
        result.forEach(model => {
          model.timestamp = Date.now();
        })
      } else {
        result.timestamp = Date.now();
      }
      return result
    }

    return result;
  })
)
```

You could also write the above middleware by creating new objects for each result rather than mutating the existing
objects:

```javascript
client.$use(
  createNestedMiddleware((params, next) => {
    [...]

    if (
      params.action === 'include' ||
      params.action === 'select'
    ) {
      if (Array.isArray(result)) {
        return result.map(model => ({
          ...model,
          timestamp: Date.now(),
        }))
      } else {
        return {
          ...result,
          timestamp: Date.now(),
        }
      }
    }

    return result;
  })
)
```

NOTE: When modifying results from `include` or `select` actions it is important to either mutate the existing objects or
spread the existing objects into the new objects. This is because `createNestedMiddleware` needs some fields from the
original objects in order to correct update the root results.

### Errors

If any middleware throws an error at any point then the root query will throw with that error. Any middleware that is
pending will have it's promises rejects at that point.

## LICENSE

Apache 2.0

[npm]: https://www.npmjs.com/
[node]: https://nodejs.org
[build-badge]: https://github.com/olivierwilkinson/prisma-nested-middleware/workflows/prisma-nested-middleware/badge.svg
[build]: https://github.com/olivierwilkinson/prisma-nested-middleware/actions?query=branch%3Amaster+workflow%3Aprisma-nested-middleware
[version-badge]: https://img.shields.io/npm/v/prisma-nested-middleware.svg?style=flat-square
[package]: https://www.npmjs.com/package/prisma-nested-middleware
[downloads-badge]: https://img.shields.io/npm/dm/prisma-nested-middleware.svg?style=flat-square
[npmtrends]: http://www.npmtrends.com/prisma-nested-middleware
[license-badge]: https://img.shields.io/npm/l/prisma-nested-middleware.svg?style=flat-square
[license]: https://github.com/olivierwilkinson/prisma-nested-middleware/blob/master/LICENSE
[prs-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square
[prs]: http://makeapullrequest.com
[coc-badge]: https://img.shields.io/badge/code%20of-conduct-ff69b4.svg?style=flat-square
[coc]: https://github.com/olivierwilkinson/prisma-nested-middleware/blob/master/other/CODE_OF_CONDUCT.md
