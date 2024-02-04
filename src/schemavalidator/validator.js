const Ajv = require('ajv');
const File = require('formidable').File;
const moment = require('moment');
const {
  assert, transformExtends, ref, propsToSchema, loadSchema,
  takeInOptions, transformType,
} = require('./utils');

const converts = {
  date: v => moment.utc(v, 'YYYY-MM-DD').toDate(),
  time: v => moment.utc(v, 'HH:mm:ssZ.SSS').toDate(),
  'date-time': v => moment.utc(v).toDate(),
};

// eslint-disable-next-line no-restricted-properties
const INT32_MIN = -1 * Math.pow(2, 31);
// eslint-disable-next-line no-restricted-properties
const INT32_MAX = Math.pow(2, 31) - 1;

class Validator {
  constructor(opts = {}) {
    this.ajv = new Ajv({
      coerceTypes: 'array',
      useDefaults: true,
      // unknownFormats: 'ignore',  deprecated// shows invalid conf warning in ajv 8
      formats: true,
      // /* start of ajv 8 */
      strictSchema: 'log',
      // ignoreUnknownFormats: true,
      // ignoreUnknownKeywords: true,
      // allowMatchingProperties: true,
      allowUnionTypes: true,
      /* end of ajv 8 */
      allErrors: true,
      // loadSchema,
      ...opts,
    });
    this.ajv.addKeyword('in');
    this.ajv.addKeyword('explode');
    this.ajv.addKeyword({
      keyword: 'convert',
      compile(convert, schema) {
        const fn = convert === true
          ? converts[schema.format]
          : convert;
        if (fn && typeof fn === 'function') {
          return (value, fullKey, data, key) => {
            data[key] = fn(value);
            return true;
          };
        }
        return () => true;
      },
    });
    this.ajv.addKeyword({
      keyword: 'file',
      compile(checkFile, schema) {
        if (checkFile) {
          return (value) => {
            if (value && value instanceof File) {
              return true;
            }
            return false;
          };
        }
        return () => true;
      },
    });
    this.ajv.addFormat('int32', {
      type: 'number',
      validate(n) {
        return Number.isSafeInteger(n) && n >= INT32_MIN && n <= INT32_MAX;
      },
    });
    this.ajv.addFormat('int64', {
      type: 'number',
      validate(n) {
        return Number.isSafeInteger(n);
      },
    });
    this.schemas = {};
  }

  getSchemas() {
    return this.schemas;
  }

  addSchema(schemaName, props, options = {}) {
    assert(schemaName, 'schemaName is required');

    const { name, parents } = transformExtends(schemaName);
    let schema = props.type ? props : propsToSchema(props, options);

    if (parents.length) {
      if (schema) {
        parents.push(schema);
      }
      if (parents.length === 1) {
        schema = { ...options, ...parents[0] };
      } else {
        schema = { ...options, allOf: parents };
      }
    } else {
      schema = { ...options, ...schema };
    }

    this.schemas[name] = schema;
    this.ajv.addSchema(schema, ref(name));
  }

  compile(schema) {
    return this.ajv.compile(schema);
  }

  compileAsync(schema) {
    return this.ajv.compileAsync(schema);
  }
}

module.exports = Validator;
