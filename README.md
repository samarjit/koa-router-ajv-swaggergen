# koa-router-ajv-swaggergen

> Thanks to fastify-swagger, fastify-oas, koa-mapper. A lot of inspiration was taken from these libraries
> Thanks for koa-joi-swagger, and I did take inspiration from this lib as well.

This module does 3 things. This does not reimplement koa-router instead creates wrapper around koa-router. In fact these libraries were inspiration for building this wrapper module.

1. Define schema while defining router
2. Schema will be used for validation of queryparams, headers, pathparams, body
3. Schema will be used for generating openapi 3 json.

You can open this openapi3 json in http://editor.swagger.io to view the document.
Optionally you can integrate swagger viewer in your application. Follow the index.js to see how it is done. Following snippet shows the main parts.


## Usage install this package using npm
`npm install koa-router-ajv-swaggergen` in your project. 

```js
const Router = require('@koa/router');
const Myrouter = require('../../routerwrapper');
const router = new Myrouter(new Router(), 'prefix'); // prefix is optional but nice to have if you have multiple routes
```

Now you can use the `router` object like you would use koa-router. Optionally you can add schema which will start showing this route in apidoc and do schema validation

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

const queryStringJsonSchema = {
  name: { type: 'string' },
  excitement: { type: 'boolean' }
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

### Complete Example

```js
const koa = require('koa')
const Router = require('@koa/router');
const Myrouter = require('koa-router-ajv-swaggergen');
const router = new Myrouter(new Router(), 'prefix');

const app = new koa();

// requires `npm install -D swagger-ui-dist` to run swagger ui locally, otherwise comment this line
Myrouter.setupSwaggerUI(router, 'prefix'); 
// pass 'router' for json error response for this router, or pass 'app' for all errors as json
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
    ctx.body = { hello: 'world' };
  }
);

app.use(router.routes());

app.listen(3000, () => {
  console.log(`server listening on 3000`)
})
```
Open browser http://localhost:3000/prefix/openapi.json
If you have setup swagger ui viewer open in browser http://localhost:3000/swagger

## Integrating swagger viewer

Integrating swagger viewer is trivial. Get the static distribution instead of serving static directory from node_modules, serve it and rewrite content as required. I found this is the easiest way to mount into a different directory other than root. Swagger js and css'es do not understand relative paths 

```
npm install -D swagger-ui-dist
```

```javascript
const swaggerUiAssetPath = require("swagger-ui-dist").getAbsoluteFSPath();
// Mount in your favourite path eg. '/swagger'
router.get('/swagger', ctx => {
  ctx.type = 'html';
  let fileAsString = fs.readFileSync(`${swaggerUiAssetPath}/index.html`);//
  ctx.body = String(fileAsString).replace(/url\: \"https.*/m, `url: "openapi.json",`);
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
## Testing locally via git
Git clone the repository.
Run `npm install`
You run the `node src\index-test.js` or simply run `npm run dev`. It has a few samples to get started.
Open browser at (http://localhost:3000/swagger)[http://localhost:3000/swagger]