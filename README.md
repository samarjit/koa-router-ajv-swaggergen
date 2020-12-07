# koa-router-ajv-swaggergen

> Thanks to fastify-swagger, fastify-oas, koa-mapper. A lot of inspiration was taken from these libraries
> Thanks for koa-joi-swagger, and I did take inspiration from this lib as well.

This module does 3 things. This does not reimplement koa-router instead creates wrapper around koa-router. In fact these libraries were inspiration for building this wrapper module.

1. Define schema while defining router
2. Schema will be used for validation of queryparams, headers, pathparams, body
3. Schema will be used for generating openapi 3 json.

You can open this openapi3 json in http://editor.swagger.io to view the document.
Optionally you can integrate swagger viewer in your application. Follow the index.js to see how it is done. Following snippet shows the main parts.

## Quick start Example

Create a new folder test. Run `npm init -y` inside the new folder.
Run `npm install koa-router-ajv-swaggergen` in your project. 
Additioally if want to setup swagger viewer
Run `npm install -D swagger-ui-dist`

Install peer dependencies if not already part of your project
Run `npm install koa @koa/router ajv formidable json-schema-resolver qs`

> You can replace npm with yarn commands above if you prefer yarn. Yarn 2 is also supported which will not create node_modules.

Create index.js file with the below content

```js
const Koa = require('koa')
const Router = require('@koa/router');
const Myrouter = require('koa-router-ajv-swaggergen');
const router = new Myrouter(new Router(), 'prefix');

const app = new Koa();

// // requires `npm install -D swagger-ui-dist` to run swagger ui locally, otherwise comment this line
Myrouter.setupSwaggerUI(router, 'prefix');

// // pass 'router' for json error response for this router, or pass 'app' for all errors to be converted to json
Myrouter.setupJsonErrors(router); 

router.get('/',
  {
    schema: {
      summary: 'Minimal example',
      description: 'This is a minimal setup',
      querystring: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          excitement: { type: 'integer' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            hello: { type: 'string' }
          }
        }
      }
    }
  },
  (ctx) => {
    console.log('reqId', ctx.query.name);
    ctx.body = { hello: ctx.query.name, excitement:  ctx.query.excitement};
  }
);

app.use(router.routes());

app.listen(3000, () => {
  console.log(`server listening on 3000`)
})
```

If you are using npm. That is your node_modules folder got created. Then you cna run `node index.js`
or,
If you are using yarn 2 add scripts. Run project `yarn dev`
```json
"scripts": {
  "dev": "node index.js"
}
```

Open browser http://localhost:3000/prefix/openapi.json
If you have setup swagger ui viewer open in browser http://localhost:3000/swagger

![openapi json](docs/openapijson.jpg)
![swagger ui](docs/swagger.jpg)
![swagger error](docs/validationerror.jpg)

## Some more details


```js
const Router = require('@koa/router');
const Myrouter = require('../../routerwrapper');
const router = new Myrouter(new Router(), 'prefix'); // prefix is required to access different routes
```

Now you can use the `router` object like you would use koa-router i.e. even without a schema. But you can add schema which will start showing this route in swagger json and do schema validation.

```js
router.get('/auth/get-user-profile', {
    schema: {
        querystring: {
            username: { type: 'string' }
        },
        responses: {
            '200': {
                description: 'returns user details or redirect url /auth/login if not logged in'
            },
        }
    }
}, async (ctx) => {
  ctx.body = '';
})
```
Now the apidoc json is available at http://localhost:<port>/prefix.openapi.json. You can have other router instances wrapped with a different prefix, and those will be available http://localhost:<port>/anotherprefix.openapi.json.

### Reusable schema
You can register schema globally in the router and reuse it in multiple routes

```js
router.addSchema('commonSchema', {
  type: 'object',
  properties: {
    hello: { type: 'string' }
  }
})

router.post('/', {
  schema: {
    body: { $ref: '#/components/schemas/commonSchema' },
    headers: { $ref: '#/components/schemas/commonSchema' }
  }
}, (ctx) => { ctx.body = 'post /'; })
```

### Validation 
A more complete example, in fact this is directly taken from fastify-swagger documentation.
Note the querystring and pathparams objects can be simplified as in this example. But if you need to control required then expanded format will need to be defined.  

```js
const bodyJsonSchema = {
  type: 'object',
  required: ['requiredKey'],
  properties: {
    someKey: { type: 'string' },
    someOtherKey: { type: 'number' },
    requiredKey: {
      type: 'array',
      maxItems: 3,
      items: { type: 'integer' }
    },
    nullableKey: { type: ['number', 'null'] }, // or { type: 'number', nullable: true }
    multipleTypesKey: { type: ['boolean', 'number'] },
    multipleRestrictedTypesKey: {
      oneOf: [
        { type: 'string', maxLength: 5 },
        { type: 'number', minimum: 10 }
      ]
    },
    enumKey: {
      type: 'string',
      enum: ['John', 'Foo']
    },
    notTypeKey: {
      not: { type: 'array' }
    }
  }
}

// This is less verbose way of defining schema which works for querystring and params 
// You can choose more verbose way of defining schema in the ajv way
const queryStringJsonSchema = {
  name: { type: 'string' }, // add required: true if you want to make it required
  excitement: { type: 'boolean' } // query strings are normally strings but it is coerced to boolean and then validated
}

const paramsJsonSchema = {
  par1: { type: 'string' },
  par2: { type: 'number' }
}

const headersJsonSchema = {
  type: 'object',
  properties: {
    'x-foo': { type: 'string' }
  },
  required: ['x-foo']
}

const schema = {
  body: bodyJsonSchema,
  querystring: queryStringJsonSchema,
  params: paramsJsonSchema,
  headers: headersJsonSchema
}

router.post('/the/url/:par1/:par2', { schema }, (ctx) => {
  ctx.body = 'post /the/url';
})
```

## Integrating swagger viewer

Integrating swagger viewer is trivial. Get the static distribution instead of serving static directory from node_modules, serve it and rewrite content as required. I found this is the easiest way to mount into a different directory other than root. Swagger js and css'es do not understand relative paths 

```
npm install -D swagger-ui-dist
```
Easy way is to use a provided helper method. `Myrouter.setupSwaggerUI(router, 'prefix');`

Here is what this helper function essentially does. 

```javascript
//** This works for npm only which has package.json. For yarn2 refer implementation in src/routerwrapper.js **//

const swaggerUiAssetPath = require("swagger-ui-dist").getAbsoluteFSPath();
// Mount in your favourite path eg. '/swagger'
router.get('/swagger', ctx => {
  ctx.type = 'html';
  let fileAsString = fs.readFileSync(`${swaggerUiAssetPath}/index.html`);//
  ctx.body = String(fileAsString).replace(/url\: \"https.*/m, `url: "prefix/openapi.json",`);
});
// Following static assets do not recognize relative paths.
router.get('/swagger-ui.css', ctx => {
  ctx.type = "text/css"
  ctx.body = fs.createReadStream(`${swaggerUiAssetPath}/swagger-ui.css`);
});
router.get('/swagger-ui-bundle.js', ctx => {
  ctx.type = "application/javascript"
  ctx.body = fs.createReadStream(`${swaggerUiAssetPath}/swagger-ui-bundle.js`);
});
router.get('/swagger-ui-standalone-preset.js', ctx => {
  ctx.type = "application/javascript"
  ctx.body = fs.createReadStream(`${swaggerUiAssetPath}/swagger-ui-standalone-preset.js`);
});
```

## For developers of this library
Git clone the repository.
Run `npm install`
You run the `node src\index-test.js` or simply run `npm run dev`. It has a few samples to get started.
Open browser at [http://localhost:3000/swagger](http://localhost:3000/swagger)


## Release Notes

2020-12-06: 
  * Moved dependencies to peerDependencies so that client projects are fee to choose their versions. Unfortunately this also adds burden on developer to maintain all the dependencies. `npm install koa @koa/router ajv delegates extend flatten formidable json-schema-resolver qs clone`
  * Added support for yarn 2/berry
  * Removed dependencies flatten, clone, extend, delegates
  * Added parsing body without `.type`
  * Fixed validation with schema reference as full-path
  * Fixed delete method handling so that it appears in swagger
