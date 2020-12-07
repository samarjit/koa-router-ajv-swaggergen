const fs = require('fs');
const qs = require('qs');

// const fetch = require('node-fetch');
// const _ = require('lodash')
// const debug = require('debug')('koa-mapper');
const Ref = require('json-schema-resolver')

// const extend = require('extend');
exports.extend = extend;
// This might be error prone solution
function extend(unused, current, updates) {
  for (key of Object.keys(updates)) {
    if (!current.hasOwnProperty(key) || typeof updates[key] !== 'object') current[key] = updates[key];
    else if (current[key] instanceof Array && updates[key] instanceof Array) current[key] = current[key].concat(updates[key])
    else extend('', current[key], updates[key]);
  }
  return current;
}

exports.safeDecodeURIComponent = safeDecodeURIComponent;
function safeDecodeURIComponent(text) {
  try {
    return decodeURIComponent(text);
  } catch (e) {
    return text;
  }
}

exports.assert = assert;
function assert(value, message) {
  if (value) return;
  throw new Error(message);
}

exports.validateError = validateError;
function validateError(errors) {
  const message = errors.map((e) => {
    if (e.dataPath) {
      const key = e.dataPath.replace(/^./, '');
      return `[${key}] ${e.message}`;
    } else {
      return e.message;
    }
  }).join('\n');
  const err = new Error(message);
  err.status = 400;
  err.expose = true;
  throw err;
}

function toURI(base, query) {
  if (!query) return base;
  if (typeof query === 'string') {
    query = qs.parse(query);
  }
  const str = qs.stringify(query);
  if (!str) return base;
  if (base.indexOf('?') >= 0) {
    return `${base}&${str}`;
  } else {
    return `${base}?${str}`;
  }
}

function takeInOptions(opts, key) {
  const map = {
    path: ['summary', 'description'],
    method: [
      'tags', 'summary', 'description', 'externalDocs', 'responses',
      'callbacks', 'deprecated', 'security', 'servers', 'requestBody'
    ],
    schema: [
      'items', 'title', 'multipleOf', 'maximum', 'exclusiveMaximum', 'minimum',
      'exclusiveMinimum', 'maxLength', 'minLength', 'pattern', 'maxItems', 'minItems',
      'uniqueItems', 'maxProperties', 'minProperties', 'enum', 'default', 'format'
    ],
    param: [
      'name', 'in', 'description', 'required', 'deprecated', 'allowEmptyValue',
      'style', 'explode', 'allowReserved', 'schema', 'example', 'examples'
    ]
  };
  const obj = {};
  map[key].forEach((k) => {
    if (opts[k] !== undefined) {
      obj[k] = opts[k];
    }
  });
  return obj;
}

exports.takeInOptions = takeInOptions;

const TYPES = ['array', 'boolean', 'integer', 'null', 'number', 'object', 'string'];
const FORMATS = ['date', 'time', 'date-time', 'regex'];

exports.ref = ref;
function ref(name) {
  return `#/components/schemas/${name}`;
}

function getMixType(type) {
  const types = {
    file: { type: 'object', file: true }
  };
  TYPES.forEach((t) => {
    types[t] = { type: t };
  });
  FORMATS.forEach((t) => {
    types[t] = { type: 'string', format: t, convert: true };
  });
  types.datetime = types['date-time'];

  const hasAnd = /&/.test(type);
  const hasOr = /\|/.test(type);
  if (hasAnd && hasOr) {
    throw new Error('& and | can only have one');
  }
  const arr = [];
  type.split(/[&|]/).forEach((t) => {
    t = t.trim();
    if (t) {
      const simple = types[t.toLowerCase()];
      arr.push(simple || { $ref: ref(t) });
    }
  });
  if (arr.length > 1) {
    return hasAnd ? { allOf: arr } : { oneOf: arr };
  } else {
    return arr[0];
  }
}

exports.transformExtends = transformExtends;
function transformExtends(name) {
  const arr = name.split(/:/);
  const clz = { name: arr[0].trim(), parents: [] };
  if (arr[1]) {
    arr[1].split(/,/).forEach((str) => {
      const parent = str.trim();
      if (parent) {
        clz.parents.push({ $ref: ref(parent) });
      }
    });
  }
  return clz;
}

exports.transformType = transformType;
function transformType(type) {
  if (type) {
    type = type.trim();
  }
  if (!type) return {};

  const arrayRE = /array\s?<([^<>]+)>/i;
  const m = arrayRE.exec(type);
  if (m) {
    const str = m[1].trim();
    if (!str) {
      return { type: 'array' };
    }
    return {
      type: 'array',
      items: getMixType(str)
    };
  } else {
    return getMixType(type);
  }
}
exports.propsToSchema = propsToSchema;
function propsToSchema(props, options = {}) {
  if (props && typeof props === 'string') {
    return { $ref: ref(props) };
  }
  if (props && props.$ref) {
    return props;
  }
  if (props && props.type) {
    return props;
  }
  if (props && Object.keys(props).length) {
    const properties = {};
    const requiredArr = options.required || [];
    Object.keys(props).forEach((k) => {
      const { type, required, ...others } = props[k];
      const typeObj = transformType(type);
      properties[k] = extend(true, others, typeObj);
      if (required) {
        requiredArr.push(k);
      }
    });
    const required = [...new Set(requiredArr)];
    const schema = { type: 'object', properties };
    if (required.length) {
      schema.required = required;
    }
    return schema;
  }
  return null;
}

const isURL = s => /^https?:\/\//gi.test(s);

// exports.loadSchema = function loadSchema(url, options) {
//   if (isURL(url)) {
//     return fetch(url, options).then(res => res.json());
//   }
//   return new Promise((resolve, reject) => {
//     fs.readFile(url, (err, data) => {
//       if (err) {
//         return reject(err);
//       }
//       resolve(JSON.parse(data));
//     });
//   });
// }

// fastify start
function transformSchema(opts, componentSchemas) {
  const swaggerObject = {
    definitions: componentSchemas,
  }
  const externalSchemas = []; // Object.keys(componentSchemas).map(i => { return { $id: i, ...componentSchemas[i] }; }); // Array.from(sharedSchemasMap.values())
  const ref = Ref({ clone: true, applicationUri: 'todo.com', externalSchemas })

  const transform = opts.transform;

  const schema = transform
    ? transform(opts.schema)
    : opts.schema
  let path = opts.path;
  const url = formatParamUrl(path)

  swaggerObject.paths = {}
  const swaggerRoute = swaggerObject.paths[url] || {}

  const swaggerMethod = {}
  const parameters = []

  // route.method should be either a String, like 'POST', or an Array of Strings, like ['POST','PUT','PATCH']
  const methods = typeof opts.method === 'string' ? [opts.method] : opts.method

  for (var method of methods) {
    let methodWithDelete = method.toLowerCase();
    if (methodWithDelete === 'del') {
      methodWithDelete = 'delete'
    }
    swaggerRoute[methodWithDelete] = swaggerMethod
  }

  if (schema) {
    if (schema.querystring) {
      getQueryParams(parameters, schema.querystring)
    }
    if (schema.summary) {
      swaggerMethod.summary = schema.summary
    }

    if (schema.description) {
      swaggerMethod.description = schema.description;
    }

    if (schema.tags) {
      swaggerMethod.tags = schema.tags;
    }

    if (schema.operationId) {
      swaggerMethod.operationId = schema.operationId;
    }

    if (schema.body) {
      if (true /* openapi */) {
        // // openapi
        swaggerMethod.requestBody = {};
        genBody(swaggerMethod.requestBody,
          (schema.body.type || schema.body.$ref) ? schema.body : { type: 'object', properties: schema.body },
          schema.consumes ||
          [
            'application/json',
            'application/x-www-form-urlencoded',
          ]
        );
      } else {
        const consumesAllFormOnly =
          consumesFormOnly(schema) || consumesFormOnly(swaggerObject)
        consumesAllFormOnly
          ? getFormParams(parameters, (schema.body.type || schema.body.$ref) ? schema.body : { type: 'object', properties: schema.body })
          : getBodyParams(parameters, (schema.body.type || schema.body.$ref) ? schema.body : { type: 'object', properties: schema.body })
      }
    }

    if (schema.params) {
      getPathParams(parameters, schema.params)
    }

    if (schema.headers) {
      getHeaderParams(parameters, schema.headers)
    }

    if (parameters.length) {
      swaggerMethod.parameters = parameters
    }

    if (schema.deprecated) {
      swaggerMethod.deprecated = schema.deprecated
    }

    if (schema.security) {
      swaggerMethod.security = schema.security
    }

    for (const key of Object.keys(schema)) {
      if (key.startsWith('x-')) {
        swaggerMethod[key] = schema[key]
      }
    }
  }

  swaggerMethod.responses = schema.responses ? schema.responses : genResponse(null)

  swaggerObject.paths[url] = swaggerRoute
  return swaggerObject.paths;


  function getBodyParams(parameters, body) {
    const bodyResolved = ref.resolve(body)

    const param = {}
    param.name = 'body'
    param.in = 'body'
    param.schema = bodyResolved
    parameters.push(param)
  }

  function getFormParams(parameters, form) {
    const resolved = ref.resolve(form)
    const add = plainJsonObjectToSwagger2('formData', resolved, swaggerObject.definitions)
    add.forEach(_ => parameters.push(_))
  }

  function getQueryParams(parameters, query) {
    const resolved = ref.resolve(query)
    const add = plainJsonObjectToSwagger2('query', resolved, swaggerObject.definitions)
    add.forEach(_ => parameters.push(_))
  }

  function getPathParams(parameters, path) {
    const resolved = ref.resolve(path)
    const add = plainJsonObjectToSwagger2('path', resolved, swaggerObject.definitions)
    add.forEach(_ => parameters.push(_))
  }

  function getHeaderParams(parameters, headers) {
    const resolved = ref.resolve(headers)
    const add = plainJsonObjectToSwagger2('header', resolved, swaggerObject.definitions)
    add.forEach(_ => parameters.push(_))
  }
}

function consumesFormOnly(schema) {
  const consumes = schema.consumes
  return (
    consumes &&
    consumes.length === 1 &&
    (consumes[0] === 'application/x-www-form-urlencoded' ||
      consumes[0] === 'multipart/form-data')
  )
}
function formatParamUrl(url) {
  var start = url.indexOf('/:')
  if (start === -1) return url

  var end = url.indexOf('/', ++start)

  if (end === -1) {
    return url.slice(0, start) + '{' + url.slice(++start) + '}'
  } else {
    return formatParamUrl(url.slice(0, start) + '{' + url.slice(++start, end) + '}' + url.slice(end))
  }
}
function plainJsonObjectToSwagger2(container, jsonSchema, externalSchemas) {
  const obj = localRefResolve(jsonSchema, externalSchemas)
  let toSwaggerProp
  switch (container) {
    case 'query':
      toSwaggerProp = function (properyName, jsonSchemaElement) {
        jsonSchemaElement.in = container
        jsonSchemaElement.name = properyName
        return jsonSchemaElement
      }
      break
    case 'formData':
      toSwaggerProp = function (properyName, jsonSchemaElement) {
        delete jsonSchemaElement.$id
        jsonSchemaElement.in = container
        jsonSchemaElement.name = properyName

        // https://json-schema.org/understanding-json-schema/reference/non_json_data.html#contentencoding
        if (jsonSchemaElement.contentEncoding === 'binary') {
          delete jsonSchemaElement.contentEncoding // Must be removed
          jsonSchemaElement.type = 'file'
        }

        return jsonSchemaElement
      }
      break
    case 'path':
      toSwaggerProp = function (properyName, jsonSchemaElement) {
        jsonSchemaElement.in = container
        jsonSchemaElement.name = properyName
        jsonSchemaElement.required = true
        return jsonSchemaElement
      }
      break
    case 'header':
      toSwaggerProp = function (properyName, jsonSchemaElement) {
        return {
          in: 'header',
          name: properyName,
          required: jsonSchemaElement.required,
          description: jsonSchemaElement.description,
          type: jsonSchemaElement.type
        }
      }
      break
  }

  return Object.keys(obj).reduce((acc, propKey) => {
    acc.push(toSwaggerProp(propKey, obj[propKey]))
    return acc
  }, [])
}
function localRefResolve(jsonSchema, externalSchemas) {
  if (jsonSchema.type && jsonSchema.properties) {
    // for the shorthand querystring/params/headers declaration
    const propertiesMap = Object.keys(jsonSchema.properties).reduce((acc, h) => {
      const required = (jsonSchema.required && jsonSchema.required.indexOf(h) >= 0) || false
      const newProps = Object.assign({}, jsonSchema.properties[h], { required })
      return Object.assign({}, acc, { [h]: newProps })
    }, {})

    return propertiesMap
  } else if (!jsonSchema.$ref) {
    return jsonSchema;
  }

  // $ref is in the format: #/definitions/<resolved definition>/<optional fragment>
  const localReference = jsonSchema.$ref.split('/')[3]
  return localRefResolve(externalSchemas[localReference], externalSchemas)
}
function genResponse(fastifyResponseJson) {
  // if the user does not provided an out schema
  if (!fastifyResponseJson) {
    return { 200: { description: 'Default Response' } }
  }

  const responsesContainer = {}

  Object.keys(fastifyResponseJson).forEach(key => {
    // 2xx is not supported by swagger

    const rawJsonSchema = fastifyResponseJson[key]
    const resolved = ref.resolve(rawJsonSchema)

    responsesContainer[key] = {
      schema: resolved,
      description: 'Default Response'
    }
  })

  return responsesContainer
}

// openapi3
function genBody(dst, src, consumes) {
  convertSchemaTypes(src);
  const body = src;
  const mediaTypes = consumes;
  dst.content = {};
  if (body.description) {
    dst.description = body.description;
    delete body.description;
  }

  if (body.required) {
    dst.required = true;
  }

  for (const mediaType of mediaTypes) {
    dst.content[mediaType] = {};
    if (body.examples) {
      dst.content[mediaType].examples = body.examples.reduce(
        (res, { name, ...rest }) => {
          res[name] = rest;
          return res;
        },
        {}
      );
      delete body.examples;
    } else if (body.example) {
      dst.content[mediaType].example = body.example;
      delete body.example;
    }
    dst.content[mediaType].schema = (body);
  }
};

function convertSchemaTypes(schema) {
  const obj = schema;

  if (Array.isArray(obj.type)) {
    if (obj.type.includes('null')) obj.nullable = true;
    obj.type = obj.type.filter((type) => type !== 'null');

    if (obj.type.length > 1) {
      obj.oneOf = [];
      obj.type.forEach((type) => obj.oneOf.push({ type }));
      delete obj.type;
    } else {
      obj.type = obj.type[0];
    }
  }

  if (obj.properties) {
    Object.values(obj.properties).forEach((prop) => convertSchemaTypes(prop));
  }
}
// fastify end

function transformSchemaOld(opts) {
  const { params, body } = opts.schema;
  let parameters = []
  let operations = opts.method
  let tmp = {}
  let path = opts.path;
  const inPath = {};
  // query-path start
  if (params) {
    let indx = 0;
    require('lodash').forEach(params, (value, key) => {
      const name = String(key);
      if (value.in !== 'path') {
        return;
      }
      inPath[name] = { indx };
      indx++;
      parameters.push({
        name,
        in: 'path',
        required: !key.optional,
        schema: { type: 'string' }
      });
    })
  }

  // .map((key, index) => {
  //   const name = String(key.name);
  //   inPath[name] = { index };
  //   return {
  //     name,
  //     in: 'path',
  //     required: !key.optional,
  //     schema: { type: 'string' }
  //   };
  // });
  params && Object.keys(params).forEach((name) => {
    const obj = params[name] || {};
    const param = takeInOptions(obj, 'param');
    const schema = takeInOptions(obj, 'schema');

    param.name = name;

    if (obj.type) {
      extend(true, schema, transformType(obj.type));
    }
    if (Object.keys(schema).length) {
      param.schema = extend(true, param.schema, schema);
    }
    const find = inPath[name];
    if (find) {
      const { index } = find;
      parameters[index] = extend(true, parameters[index], param);
      assert(parameters[index].in === 'path', `${name} must be in path`);
    } else {
      parameters.push(param);
    }
  });
  // query-path end
  // body start
  this.bodySchema = propsToSchema(body);
  // body end
  if (operations.length) {
    const obj = takeInOptions(opts.schema, 'method');
    if (parameters.length) {
      extend(true, obj, { parameters });
    }
    if (this.bodySchema) {
      const map = {
        json: 'application/json',
        form: 'application/x-www-form-urlencoded',
        multipart: 'multipart/form-data'
      };
      const bodyType = opts.bodyType || ['json', 'form'];
      const requestBody = { content: {} };
      [].concat(bodyType).forEach((t) => {
        const type = map[t] || t;
        requestBody.content[type] = { schema: this.bodySchema };
      });
      extend(true, obj, { requestBody });
    }
    operations.forEach((m) => {
      tmp[m.toLowerCase()] = obj;
    });
  } else {
    tmp = takeInOptions(opts, 'path');
    if (parameters.length) {
      extend(true, tmp, { parameters });
    }
  }
  return { [path]: tmp };
}
exports.transformSchema = transformSchema;