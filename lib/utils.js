
var fs = require('fs');
var path = require('path');
var http = require('http');

// Compatibility with node 0.7
exports.exists = fs.exists || path.exists;
exports.existsSync = fs.existsSync || path.existsSync;

// go though each property in an object
exports.each = function (object, self, method) {
  // if self is not given use nothing (global in non-strict mode)
  if (arguments.length === 2) {
    method = self;
    self = null;
  }

  Object.keys(object).forEach(function (name) {
    method.call(self, object[name], name);
  });
};

// create a HTTP connect error
exports.httpError = function (code, error) {
  var err = new Error(http.STATUS_CODES[code]);
      err.statusCode = code;

  if (error) err.origin = error;

  return err;
};

// extend one object onto another
exports.extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || typeof add !== 'object') return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};
