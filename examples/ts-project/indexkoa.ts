import Koa from "koa";
import Router from "@koa/router";
// const Myrouter = require('koa-router-ajv-swaggergen');
import Myrouter from "koa-router-ajv-swaggergen";
// import "koa-router-ajv-swaggergen/koa-router-ajv-swaggergen.d.ts";
import { JSONSchemaType } from "ajv";
import bodyparser from 'koa-bodyparser';
import { PropertiesSchema } from "ajv/dist/types/json-schema"
const setupSwaggerUI = require('koa-router-ajv-swaggergen/util/setupSwaggerUI');

const router = new Myrouter(new Router({prefix: '/api/'}), "prefix");

const app = new Koa();
app.use(bodyparser());
// // requires `npm install -D swagger-ui-dist` to run swagger ui locally, otherwise comment this line
setupSwaggerUI(router, "prefix");

Myrouter.setupJsonErrors(router);

const paramsJsonSchema = {
  par1: { type: 'string' },
  par2: { type: 'number' }
}

interface MyType {
  foo: number;
  bar: string;
}

router.post("/test/:par1/:par2", {
  schema: {
    headers: {
      type: 'object',
      properties: {
        'foo': { type: 'string' },
        'bar': { type: 'number' },
      },
      required: ['foo']   // see if you pass MyType interface you dont need to cast to never[]
    } as JSONSchemaType<MyType>, // This usage is ideal, i.e. by passing interface eg. MyType
    params: {
      par1: { type: "string",  nullable: true},
      par2: { type: "number", nullable: true },
    } as PropertiesSchema<any>, // pass empty type or else make them explicit interface eg. MyType
    querystring: {
      name: { type: "string",  nullable: true},
      excitement: { type: "number",  nullable: true }
    }, // Not passing any type behaves like above PropertiesSchema
    body: {
      type: 'object',
      required: [<never> 'requiredKey'], 
      properties: {
        someKey: { type: 'string',},
        someOtherKey: { type: 'number',},
        requiredKey: {
          type: 'array',
          maxItems: 3,
          items: { type: 'integer'},
          nullable: true
        },
        nullableKey: { type: ['number', 'null']}, // or { type: 'number', nullable: true }
        multipleTypesKey: { type: ['boolean', 'number']},
        multipleRestrictedTypesKey: {
          oneOf: [
            { type: 'string', maxLength: 5},
            { type: 'number', minimum: 10 }
          ],
        },
        enumKey: {
          type: 'string',
          enum: ['John', 'Foo'],
        },
        notTypeKey: {
          not: { type: 'array', nullable: true },
        }
      }
    }  as JSONSchemaType<{}>,   
  },
},
async (ctx) => {
  console.log(ctx.body) 
  ctx.body = { hello: ctx.query.name, excitement: ctx.query.excitement };
});


router.get(
  "/",
  {
    schema: {
      querystring: {
        name: { type: "string" },
        excitement: { type: "number" },
      } as PropertiesSchema<{}>,
      params: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
        required: [<never>"id"],
      } as JSONSchemaType<{}>,
    },
  },

  async (ctx) => {
    console.log("reqId", ctx.query.name); 
    ctx.body = { hello: "world" };
  }
);

app.use(router.routes());

app.listen(3000, () => {
  console.log(`server listening on 3000`);
});
