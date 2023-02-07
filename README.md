<div align="center">
<h1>Prisma Nested Middleware</h1>

<p>Util for calling Prisma middleware for nested write operations.</p>

<p>Existing Prisma middleware is called once for every operation, but due to some operations containing <a href="https://www.prisma.io/docs/concepts/components/prisma-client/relation-queries#nested-writes">nested writes</a> it can become complex to ensure middleware is applied in all scenarios. See the <a href="https://github.com/prisma/prisma/issues/4211">existing issue regarding nested middleware</a> for more information.

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
  - [Lifecycle](#lifecycle)
  - [Operations Nested in Lists](#operations-nested-in-lists)
- [LICENSE](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Installation

This module is distributed via [npm][npm] which is bundled with [node][node] and
should be installed as one of your project's dependencies:

```
npm install --save prisma-nested-middleware
```

## Usage

Pass a [middleware function](https://www.prisma.io/docs/concepts/components/prisma-client/middleware) to `createNestedMiddleware`, the returned middleware can be passed to Prisma client's `$use` method:

```javascript
import { createNestedMiddleware } from 'prisma-nested-middleware'

client.$use(createNestedMiddleware(async (params, next) => {
  // update params here
  const result = await next(params)
  // update result here
  return result;
));
```

The middleware function passed to `createNestedMiddleware` is called for every
[nested write](https://www.prisma.io/docs/concepts/components/prisma-client/relation-queries#nested-writes) operation.

There are some differences to note when using nested middleware:

- the list of actions that might be in params is expanded to include `connectOrCreate`, `include` and `select`.
- The parent operation's params have been added to the params of nested middleware as a `scope` object. This is useful when the parent is relevant, for example when handling a `connectOrCreate` and you need to know the parent being connected to.
- the return value of `next` matches the part of the response that the middleware was called for. For example if the middleware function is called for a nested create, the `next` function resolves with the value of that create.
- if a relation is not included using `include` then that middleware's `next` function will resolve with `undefined`.
- if a nested operation's result is within an array then the nested operation's `next` function returns a flattened array of all the models found in the parent array. See [Operations Nested in Lists](#operations-nested-in-lists) for more information.

### Lifecycle

It is helpful to walk through the lifecycle of an operation:

For the following update

```javascript
client.user.update({
  where: { id: 1 },
  data: {
    comments: {
      update: {
        where: { id: 2 },
        data: {
          post: {
            connectOrCreate: {
              where: { id: 3 },
              create: {
                title: 'Hello World',
              },
            },
          },
        },
      },
    },
  },
  include: {
    comments: {
      include: {
        post: {
          select: {
            title: true,
          },
        },
      },
    },
  },
});
```

`createNestedMiddleware` calls the passed middleware function from the most deeply nested operation up to the top level operation. For the above example the middleware function is called in the following order:

1. `{ model: 'Post', action: 'connectOrCreate', args: { create: {...}, connect: {...} } }`
2. `{ model: 'Post', action: 'select', args: { title: true } }`
3. `{ model: 'Post', action: 'include', args: { select: { title: true } } }`
4. `{ model: 'Comment', action: 'update', args: { where: { id: 2 }, data: {...} } }`
5. `{ model: 'Comment', action: 'include', args: { include: { post: { select: { title: true } } } } }`
6. `{ model: 'User', action: 'update', args: { where: { id: 1 }, data: {...} } }`

The params object passed to the `next` function will modify the relevant part of the original params object. Once all the middleware calls have called `next` the updated params object is passed to the Prisma client.

The result of the Prisma client operation is then returned from the `next` functions according to the part of the result they are concerned with. So the `next` function called for the `User` model resolves with the `User` model's result, the `next` function called for the `Comment` model resolves with the `Comment` model's result, and so on.

Modifications to the result are made in the same way as modifications to the params. Once all the middleware calls have returned their slice of the result the combined result object is returned from the Prisma client method, in this case `client.user.update`.

If any middleware throws an error at any point then `client.country.update` will throw with that error.

### Operations Nested in Lists

When a `next` function needs to return a relation that is nested within a list it combines all the relation values into a single flat array. This means middleware only has to handle flat arrays of results which makes modifying the result before it is returned easier. If the result's parent is needed then it is possible to go through the parent middleware and traverse that relation; only a single depth of relation needs to be traversed as the middleware will be called for each layer.

For example if a comment is created within an array of posts, the `next` function for comments returns a flattened array of all the comments found within the posts array. When the flattened array is returned at the end of the middleware function the comments are put back into their corresponding posts.

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
