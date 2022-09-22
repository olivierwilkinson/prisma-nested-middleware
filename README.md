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
- the list of actions that might be in params is expanded to include `connectOrCreate`
- If a relation is not included using `include` then that middleware's `next` function will resolve with `undefined`.
- The parent operation's params have been added to the params of nested middleware as a `scope` object. This is useful when the parent is relevant, for example when handling a `connectOrCreate` and you need to know the parent being connected to.
- when handling a nested `create` action `params.args` does not include a `data` field, that must be handled manually. You can use the existence of `params.scope` to know when to handle a nested `create`.

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

Once all of the nested middleware have passed params to `next` the params for the `Country` model are updated with any changes made; these params are then passed to the `Country` model's `next` function.

When the `Country` model's `next` resolves the `next` of the nested middleware are also resolved with the slice relevent to them. So the middleware called for the `Recipe` model resolves with the `nationalDish`, the middleware for the `Food` resolves with the `keyIngredient`.

Finally the return values from the nested middleware are used to modify the `Country` result in a similar way to params,
and that modified object is the one `client.country.update` resolves with.

If any middleware throws an error then `client.country.update` will throw with that error.

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
