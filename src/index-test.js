

const Koa = require('koa');
const Router = require('@koa/router');
const fs = require('fs');
const bodyParser = require('koa-bodyparser');
const cors = require('@koa/cors');
const Myrouter = require('./routerwrapper');
const setupSwaggerUI = require('../util/setupSwaggerUI');
const { transformType } = require('./schemavalidator/utils');

const app = new Koa();
// const router = new Router();
const router = new Myrouter(new Router({ prefix: '/api/' }), 'testprefix');

// const swaggerUiAssetPath = require("swagger-ui-dist").getAbsoluteFSPath()

// Koa-router won't execute a middleware if there's no matching route.
app.use(cors());
app.use(bodyParser());

// console.log(swaggerUiAssetPath);
// fs.mkdir('./temp-public', () => { console.log('dir created'); })
// fs.readdirSync(swaggerUiAssetPath).forEach(function (childItemName) {

//   fs.copyFileSync(`${swaggerUiAssetPath}\\${childItemName}`, './temp-public/');
// });
Myrouter.setupJsonErrors(router);
setupSwaggerUI(router, 'testprefix');

router.use('/', async (ctx, next) => {
  console.log('middle req set');
  await next();
  console.log('middle req set2');
  const rt = ctx.response.get('X-Response-Time');
  console.log(`Response time : ${ctx.method} ${ctx.url} - ${rt}`);
});


router.use('/(.*)', async (ctx, next) => {
  console.log('middle resp log');
  const start = Date.now();
  await next();
  console.log('middle resp log2');
  const ms = Date.now() - start;
  ctx.set('X-Response-Time', `${ms}ms`);
});

router.get('/', (ctx, next) => {
  // ctx.router available
  console.log('user');
  ctx.body = 'webapp is working';
  next();
});

// function validate(schema) {
//   let ajv = require('ajv')({ schemaId: 'auto' });
//   ajv.addSchema(schema)
//   return async function (ctx, next) {
//     try {
//       const isValid = ajv.validate(schema.querystring, ctx.request['query'])
//       if (!isValid) {
//         ctx.throw(400, ajv.errors[0].message);
//         return;
//       }
//     } catch (err) {
//       console.log(err)
//       ctx.throw(400, err)
//     }
//     await next()
//   }
// }
router.addSchema('commonSchema', {
  // $id: 'commonSchema',
  type: 'object',
  properties: {
    hello: { type: 'number' }
  }
})

router.post('/', {
  schema: {
    body: { $ref: '#/components/schemas/commonSchema' },
    headers: { $ref: '#/components/schemas/commonSchema' }
  }
}, (ctx) => { ctx.body = 'post /'; })

const bodyJsonSchema = {
  type: 'object',
  required: ['requiredKey'],
  properties: {
    someKey: { type: 'string' },
    someOtherKey: { type: 'number' },
    requiredKey: {
      type: 'array',
      minItems: 3,
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

router.post('/pet/:petId', {
  schema: {
    tags: ['pet'],
    summary: 'Updates a pet in the store with form data',
    operationId: 'updatePetWithForm',
    params: {
      petId: {
        type: 'integer',
        format: 'int64',
        description: 'ID of pet to update',
        required: true
      }
    },
    body: {
      name: {
        type: 'number',
        description: 'Updated name of the pet'
      },
      status: {
        type: 'string',
        description: 'Updated status of the pet'
      }
    },
    responses: {
      '405': { description: 'Invalid input' }
    }
  }
}, [(ctx, next) => { ctx.body = { x: 'y' }; next(); },
(ctx) => { ctx.body = { new: 'body' }; }]);

router.del('/pet/:petId/:api_key', {
  schema: {
    tags: ['pet'],
    summary: 'Deletes a pet',
    operationId: 'deletePet',
    params: {
      api_key: {
        type: 'string',
        in: 'header',
        required: false
      },
      petId: {
        type: 'integer',
        format: 'int64',
        description: 'ID of pet to delete',
        required: true
      }
    },
    responses: {
      '400': { description: 'Invalid ID supplied' },
      '404': { description: 'Pet not found' }
    }
  }
}, (ctx) => { ctx.body = {}; });

router.addSchema('Pet', {
  id: { type: 'integer', format: 'int64' },
  category: { type: 'Category' },
  name: { type: 'string' },
  photoUrls: { type: 'array<string>' },
  tags: { type: 'array<Tag>' },
  status: { type: 'string', enum: ['available', 'pending', 'sold'] }
}, {
  required: ['name', 'photoUrls']
});
router.addSchema('User', {
  id: { type: 'number', required: true },
  name: { type: 'string', required: true }
});

router.get('/hello',
  {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          firstName: {
            type: 'string'
          },
          lastName: {
            type: 'string'
          },
          age: {
            description: 'Age in years',
            type: 'integer',
            minimum: 10
          }
        },
        required: ['firstName', 'lastName']
      }
    }
  }, (ctx, next) => {
    // ctx.router available
    console.log('user');
    ctx.body = 'hello';
    next();
  });

router.addSchema('Category', {
  category: { type: 'string', required: true }
});
router.addSchema('Tag', {
  tag: { type: 'string', required: false }
});
router.get('/pet/findByTags', {
  schema: {
    tags: ['pet'],
    summary: 'Finds pets by tags',
    operationId: 'findPetsByTags',
    deprecated: true,
    querystring: {
      tags: {
        in: 'query',
        // schema auto generate
        // schema: transformType('array<integer>'),
        // Long format
        // schema: { type: 'array', items: { type: 'integer' } },
        // shorthand type: 'array<integer>'
        type: 'array<integer>',
        required: true,
        explode: true,
        description: 'Tags to filter by'
      }
    },
    responses: {
      '200': {
        description: 'successful response',
        content: {
          'application/json': { schema: transformType('array<Pet>') }
        }
      },
      '400': { description: 'Invalid tag value' }
    }
  }
}, (ctx) => { ctx.body = [{ result: 'scuccess' }]; });

var posts = new Router();

posts.get('/', (ctx, next) => { ctx.body = '/'; });
posts.get('/:pid', (ctx, next) => { ctx.body = '/:pid'; });
router.use('/forums/:fid/posts', posts.routes(), posts.allowedMethods());


app
  .use(router.routes())
  .use(router.allowedMethods()); //@koa/router

console.log(router)

app.listen(3000, () => {
  console.log('listening on 3000');
});
