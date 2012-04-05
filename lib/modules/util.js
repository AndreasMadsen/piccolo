
// create a map there translate Object.prototype.toString to useful text
var typeMap = {
  'boolean': '[object Boolean]',
  'number': '[object Number]',
  'string': '[object String]',
  'function': '[object Function]',
  'array': '[object Array]',
  'date': '[object Date]',
  'regexp': '[object RegExp]'
};

// detect type using typeMap
function type(input) {

  //If the input value is null, undefined or NaN the toStringTypes object shouldn't be used
  if (input === null || input === undefined || (input !== input && String(input) === "NaN")) {
    return String(input);
  }

  // use the typeMap to detect the type and fallback to object if the type wasn't found
  return typeMap[Object.prototype.toString.call(input)] || "object";
}
exports.type = type;

// shorthand for util.type
exports.isBoolean  = function (input) { return exports.type(input) === 'boolean';  };
exports.isNumber   = function (input) { return exports.type(input) === 'number';   };
exports.isString   = function (input) { return exports.type(input) === 'string';   };
exports.isFunction = function (input) { return exports.type(input) === 'function'; };
exports.isArray    = function (input) { return exports.type(input) === 'array';    };
exports.isDate     = function (input) { return exports.type(input) === 'date';     };
exports.isRegExp   = function (input) { return exports.type(input) === 'regexp';   };
exports.isObject   = function (input) { return exports.type(input) === 'object';   };

// Inherit the prototype methods from one constructor into another
function inherits(constructor, superConstructor) {
  constructor.super_ = superConstructor;
  constructor.prototype = Object.create(superConstructor.prototype, {
    'constructor': {
      'value': constructor,
      'enumerable': false,
      'writable': true,
      'configurable': true
    }
  });
}
exports.inherits = inherits;
