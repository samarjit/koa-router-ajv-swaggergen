// const delegate = require('delegates');
// const flatten = require('flatten');
// const clone = require('clone');
const Validator = require('./schemavalidator/validator');
const extend = require('./schemavalidator/utils').extend;
const { transformSchema, propsToSchema } = require('./schemavalidator/utils');

const clone = items =>
  items.map(item => (Array.isArray(item) ? clone(item) : item));

const flatten = (arr) => Array.isArray(arr)
  ? arr.reduce((a, b) => a.concat(flatten(b)), [])
  : [arr];

function Router(koaRouter, prefix) {
  if (!(this instanceof Router)) {
    return new Router();
  }
  this.swaggerPrefix = prefix;
  this.internalRoutes = [];
  this.router = koaRouter;
  this.validator = new Validator({});
  this.rootDoc = {
    openapi: '3.0.2',
    info: {
      "title": "Test swagger",
      "description": "testing the swagger api",
      "version": "0.1.0"
    },
    tags: [],
    servers: [],
  };

  const router = this.router;
  this._addRoute = function addRoute(spec) {
    this.internalRoutes.push(spec);
    if (spec.schema) {
      // this.validator.addSchema(spec.path, spec.schema);
    }
    const preHandlers = spec.pre ? flatten(spec.pre) : [];
    const handlers = flatten(spec.handler);
    const specExposer = makeSpecExposer(spec);
    const validator = makeValidator(spec, this.validator);
    const args = [
      spec.path
    ].concat(preHandlers, [
      specExposer,
      validator ? validator : (ctx, next) => next(),
    ], handlers);
    spec.method = spec.method.split(' ')
    spec.method.forEach((method) => {
      router[method].apply(router, args);
    });
  }

  this.apiMiddleware = () => {
    return (ctx) => {
      const { rootDoc, validator } = this;
      const { schemas } = validator;
      const paths = {};
      this.internalRoutes.forEach(stk => {
        if (stk.schema) {
          extend(true, paths, transformSchema(stk, schemas));
        }
      })
      // stack.forEach((layer) => {
      //   extend(true, paths, layer.getPathItem());
      // });
      ctx.body = { ...rootDoc, paths, components: { schemas } };
    };
  }

  router.get(`/swagger/${this.swaggerPrefix}/openapi.json`, this.apiMiddleware());
  // this.middleware = function middleware() {
  //   return this.router.routes();
  // }
  this.routes = function middleware() {
    return this.router.routes();
  }
  this.addSchema = function (name, props, options) {
    this.validator.addSchema(name, props, options);
    return this;
  }

  this.use = (...x) => this.router.use.apply(this.router, x);
  this.prefix = (...x) => this.router.prefix.apply(this.router, x);
  this.param = (...x) => this.router.param.apply(this.router, x);
  this.allowedMethods = (...x) => this.router.allowedMethods.apply(this.router, x);
}


// delegate(Router.prototype, 'router')
// .method('prefix')
// .method('use')
// .method('param')
// .method('allowedMethods')

// Router.prototype.use = function () {
//   console.log('this.router', this.router)
//   this.router.use.apply(this.router, arguments);
// }

/**
 * Exposes route spec
 * @param {Object} spec The route spec
 * @returns {async Function} Middleware
 * @api private
 */
function makeSpecExposer(spec) {
  const defn = Object.assign({}, spec);
  return async function specExposer(ctx, next) {
    ctx.state.route = defn;
    await next();
  };
}

function toSchemaObj(op) {
  return (op.type || op.$ref) ? op : { type: 'object', properties: op }
}

function makeValidator(spec, validator) {
  let bodyValidator, paramsValidator, queryValidator, headerValidator;
  try {
    if (spec.schema && spec.schema.body) {
      bodyValidator = validator.compile(propsToSchema(spec.schema.body));
    }
    if (spec.schema && spec.schema.params) {
      paramsValidator = validator.compile(propsToSchema(spec.schema.params));
    }
    if (spec.schema && spec.schema.querystring) {
      queryValidator = validator.compile(propsToSchema(spec.schema.querystring));
    }
    if (spec.schema && spec.schema.headers) {
      headerValidator = validator.compile(propsToSchema(spec.schema.headers));
    }

    if (!spec.schema) {
      return;
    }
  } catch (e) {
    console.log(e, spec.schema)
    return;
  }
  return async (ctx, next) => {
    try {
      // console.log(spec)
      if (bodyValidator) {
        var isValid = bodyValidator(ctx.request.body);
        if (!isValid) {
          // ctx.throw(400, 'request body ' + validator.ajv.errorsText(bodyValidator.errors));
          throwValidationError(bodyValidator.errors, 'request body');
        }
      }
      if (paramsValidator) {
        var isValid = paramsValidator(ctx.params);
        if (!isValid) {
          // ctx.throw(400, 'params ' + validator.ajv.errorsText(paramsValidator.errors));
          throwValidationError(paramsValidator.errors, 'path params')
        }
      }
      if (queryValidator) {
        var isValid = queryValidator(ctx.request.query);
        if (!isValid) {
          // ctx.throw(400, 'query ' + validator.ajv.errorsText(queryValidator.errors));
          throwValidationError(queryValidator.errors, 'querystring');
        }
      }
      if (headerValidator) {
        var isValid = headerValidator(ctx.request.headers);
        if (!isValid) {
          // ctx.throw(400, 'header ' + validator.ajv.errorsText(headerValidator.errors));
          throwValidationError(headerValidator.errors, 'header');
        }
      }
    } catch (err) {
      console.log(err)
      ctx.throw(400, err)
    }
    await next()
  }
}

function throwValidationError(errors, prefix) {
  const details = {};
  const message = errors.map((e) => {
    if (e.instancePath) { // for ajv 8+
      const key = e.instancePath.replace(/^\//, '').replace(/\//, '.');
      const msg = `${e.message}${e.params && e.params.allowedValues ? ' ' + e.params.allowedValues : ''}`;
      details[key] = msg;
      return `[${key}] ${msg}`;
    } else if (e.dataPath) {
      const key = e.dataPath.replace(/^./, '');
      const msg = `${e.message}${e.params && e.params.allowedValues ? ' ' + e.params.allowedValues : ''}`;
      details[key] = msg;
      return `[${key}] ${msg}`;
    } else if (e.keyword === 'required') {
      const key = e.params && e.params.missingProperty;
      const msg = `${e.message}${e.params && e.params.missingProperty ? ' ' + e.params.missingProperty : ''}`;
      details[key] = e.keyword;
      return `[${key}] ${msg}`;
    } else {
      return e.message;
    }
  }).join('\n');
  const err = new Error(`${prefix} ${message}`);
  err.status = 400;
  err.statusCode = 400;
  err.expose = true;
  err.validationErrors = { [prefix]: details };
  throw err;
}

const methods = ['get', 'put', 'post', 'del'];
methods.forEach((method) => {
  method = method.toLowerCase();

  Router.prototype[method] = function (path) {
    // path, handler1, handler2, ...
    // path, config, handler1
    // path, config, handler1, handler2, ...
    // path, config, [handler1, handler2], handler3, ...

    let fns;
    let config;

    if (typeof arguments[1] === 'function' || Array.isArray(arguments[1])) {
      config = {};
      fns = Array.prototype.slice.call(arguments, 1);
    } else if (typeof arguments[1] === 'object') {
      config = arguments[1];
      fns = Array.prototype.slice.call(arguments, 2);
    }

    const spec = {
      path: path,
      method: method,
      handler: fns
    };

    Object.assign(spec, config);

    this._addRoute(spec);
    return this;
  };
});

Router.setupSwaggerUI = (router, defaultPrefix) => {
  const fs = require('fs')
  const swaggerUiAssetPath = require("swagger-ui-dist").getAbsoluteFSPath();
  // Mount in your favourite path eg. '/swagger'
  router.get('/swagger', ctx => {
    ctx.type = 'html';
    let fileAsString = fs.readFileSync(`${swaggerUiAssetPath}/index.html`);//
    ctx.body = String(fileAsString).replace(/url\: \"https.*/m, `url: "${defaultPrefix}/openapi.json",`);
  });
  // Following static assets do not recognize relative paths.
  router.get('/swagger/swagger-ui.css', ctx => {
    ctx.type = "text/css";
    ctx.body = fs.readFileSync(require.resolve("swagger-ui-dist/swagger-ui.css")); // fs.createReadStream(`${swaggerUiAssetPath}\\swagger-ui.css`);
  });
  router.get('/swagger/swagger-ui-bundle.js', ctx => {
    ctx.type = "application/javascript"
    ctx.body = fs.readFileSync(require.resolve("swagger-ui-dist/swagger-ui-bundle.js")); // fs.createReadStream(`${swaggerUiAssetPath}\\swagger-ui-bundle.js`);
  });
  router.get('/swagger/swagger-ui-standalone-preset.js', ctx => {
    ctx.type = "application/javascript"
    ctx.body = fs.readFileSync(require.resolve("swagger-ui-dist/swagger-ui-standalone-preset.js")); //  fs.createReadStream(`${swaggerUiAssetPath}\\swagger-ui-standalone-preset.js`);
  });
}
Router.setupJsonErrors = (app) => {
  app.use((ctx, next) => {
    return next().catch(err => {
      const { statusCode, message, validationErrors } = err;
      ctx.type = 'json';
      ctx.status = statusCode || 500;
      ctx.body = {
        status: 'error',
        message,
        validationErrors,
      };
      ctx.app.emit('error', err, ctx);
    });
  });
}
module.exports = Router;