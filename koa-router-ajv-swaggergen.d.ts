declare module "koa-router-ajv-swaggergen" {
  import KoaRouter from "@koa/router"
  import { JSONSchemaType } from "ajv"
  import { PropertiesSchema } from "ajv/dist/types/json-schema"
  // type SchemaRouterMethod = "del" | "get" | "post" | "put"

  type Handler =
      | ((
            this: Router,
            path: string,
            schema: {
                // schema: JSONSchemaType<any>,
                schema: {
                    /** {type: 'object',
                         properties: {
                            'foo': { type: 'string' }
                        },
                        required: [<never>'foo']}
                        or
                        {
                            par1: { type: "string",  nullable: true},
                        }
                    */
                    querystring?: PropertiesSchema<any> | JSONSchemaType<{}>
                    /** {type: 'object',
                         properties: {
                            'foo': { type: 'string' }
                        },
                        required: [<never>'foo']}
                        or
                        {
                            par1: { type: "string",  nullable: true},
                        }
                    */
                    params?: PropertiesSchema<any> | JSONSchemaType<{}>
                    /** {type: 'object',
                         properties: {
                            'foo': { type: 'string' }
                        }
                    */
                    body?: JSONSchemaType<any>
                    /** {type: 'object',
                         properties: {
                            'foo': { type: 'string' }
                        },
                        required: [<never>'foo']}
                        or
                        {
                            par1: { type: "string",  nullable: true},
                        }
                    */
                    headers?: PropertiesSchema<any> | JSONSchemaType<{}>
                }
            },
            ...handlers: KoaRouter.Middleware[]
        ) => ReturnType<KoaRouter.Middleware>)
    //   | ((
    //         this: Router,
    //         path: string,
    //         config: { schema?: object; pre?: KoaRouter.Middleware[] },
    //         ...handlers: KoaRouter.Middleware[]
    //     ) => ReturnType<KoaRouter.Middleware>)

  export default class Router {
      rootDoc: {
          openapi: string
          info: {
              title: string
              description: string
              version: string
          }
          tags: string[]
          servers: string[]
      }

      constructor(router: KoaRouter, prefix: string)

      routes: KoaRouter["routes"]
      use: KoaRouter["use"]
      prefix: KoaRouter["prefix"]
      param: KoaRouter["param"]
      allowedMethods: KoaRouter["allowedMethods"]

    //   get(
    //       path: string,
    //       schema: JSONSchemaType<any>,
    //       ...handlers: KoaRouter.Middleware[]
    //   ): ReturnType<KoaRouter.Middleware>
      get: Handler
      post: Handler
      put: Handler
      del: Handler
    //   static setupSwaggerUI(router: Router, prefix: string): void
      static setupJsonErrors(app: any): void
  }
}