
var path = require('path');
var fs = require('fs');

exports.utils = require('./utils.js');

exports.exists = fs.exists || path.exists;
exports.existsSync = fs.existsSync || path.existsSync;

// find lib and root folder
exports.lib = path.dirname(module.filename);
exports.root = path.join(exports.lib, '../');

// return a filepath to a default submodule
exports.defaults = function (part) {
  return path.join(exports.lib, 'defaults', part + '.js');
};

// return a filepath to a default submodule
exports.core = function (part) {
  return require(path.join(exports.lib, 'core', part + '.js'));
};
