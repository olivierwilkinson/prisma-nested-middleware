<div align="center">
<h1>Prisma Nested Middleware</h1>

<p>Util for calling Prisma middleware for nested write operations.</p>

<p>Existing Prisma middleware is called once for every operation, but due to some operations containing nested write operations it can become complex to ensure middleware is applied in all scenarios. See the existing <a href="https://github.com/prisma/prisma/issues/4211">issue regarding nested middleware</a> for more information.  

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
- [LICENSE](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Installation

This module is distributed via [npm][npm] which is bundled with [node][node] and
should be installed as one of your project's dependencies:

```
npm install --save prisma-nested-middleware
```

## Usage

To make nested middleware you pass a [middleware function](https://www.prisma.io/docs/concepts/components/prisma-client/middleware) to `createNestedMiddleware` which returns modified middleware to be passed to Prisma client's `$use` method:

```javascript
import { createNestedMiddlware } from 'prisma-nested-middleware'

client.$use(createNestedMiddleware((params, next) => {
  // update params here
  const result = await next(params)
  // update result here
  return result;
));
```

Middleware passed to `createNestedMiddleware` is called for every nested relation.

There are some differences to note when using nested middleware:
- the list of actions that might be in params is expanded to include 'connectOrCreate'
- If a relation is not included using `include` then that middleware's `next` function will resolve with `undefined`.
- sometimes the parent params are relevent, for instance if being connected you need to know the parent you are being connected to. To resolve this I added a `scope` object to params of nested middleware which is the parent params.
- when handling nested `create` actions `params.args` does not include a `data` field, that must be handled manually. You can use the existence of `params.scope` to know when to handle a nested `create`.

It is helpful to walk through the lifecycle of an operation:

For the following update

```javascript
client.country.update({
  where: { id: 'imagination-land' },
  data: {
    nationalDish: {
      update: {
        where: { id: 'stardust-pie' },
        data: {
          keyIngredient: {
            connectOrCreate: {
              create: { name: 'Stardust' },
              connect: { id: 'stardust' },
            },
          },
        },
      },
    },
  },
});
```

`createNestedMiddleware` calls the passed middleware function with params in the following order:
1. `{ model: 'Recipe', action: 'update', args: { where: { id: 'stardust-pie' }, data: {...} } }`
2. `{ model: 'Food', action: 'connectOrCreate', args: { create: {...}, connect: {...} } }`
3. `{ model: 'Country', action: 'update', args: { where: { id: 'imagination-land', data: {...} } }`

Then it waits for all the nested `next` functions to have been passed params, updates the top level params object with those objects and awaits the top level `next` function, in this case the `next` where model is 'Country'.

Once the top level `next` function resolves with a result the `next` functions of the nested middleware are resolved with the slice of the result relevent to them. So the middleware called for the 'Recipe' model receives the recipe object, the middleware for the 'Food' receives the food object.

Then the return values from the nested middleware are used to modify the top level result that is finally returned from the top level middleware.

## LICENSE

Apache 2.0

[npm]: https://www.npmjs.com/
[node]: https://nodejs.org
[build-badge]: https://github.com/olivierwilkinson/prisma-nested-middleware/workflows/prisma-nested-middleware/badge.svg
[build]: https://github.com/olivierwilkinson/prisma-nested-middleware/actions?query=branch%3Amaster+workflow%3Aprisma-nested-middleware
[version-badge]: https://img.shields.io/npm/v/prisma-nested-middleware.svg?style=flat-square
[package]: https://www.npmjs.com/package/prisma-nested-middleware
[downloads-badge]:https://img.shields.io/npm/dm/prisma-nested-middleware.svg?style=flat-square
[npmtrends]: http://www.npmtrends.com/prisma-nested-middleware
[license-badge]: https://img.shields.io/npm/l/prisma-nested-middleware.svg?style=flat-square
[license]: https://github.com/olivierwilkinson/prisma-nested-middleware/blob/master/LICENSE
[prs-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square
[prs]: http://makeapullrequest.com
[coc-badge]: https://img.shields.io/badge/code%20of-conduct-ff69b4.svg?style=flat-square
[coc]: https://github.com/olivierwilkinson/prisma-nested-middleware/blob/master/other/CODE_OF_CONDUCT.md
