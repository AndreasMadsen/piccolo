
var path = require('path');

// list all native modules in dependency order
exports.natives = ['util', 'url', 'events'];

// find lib and root folder
exports.lib = path.dirname(module.filename);
exports.root = path.join(exports.lib, '../');

// return a core module object
exports.core = function (part) {
  return require(path.join(exports.lib, 'core', part + '.js'));
};

// return a helper module object
exports.helper = function (part) {
  return require(path.join(exports.lib, 'helpers', part + '.js'));
};

// return a filepath to a default submodule
exports.defaults = function (part) {
  return path.join(exports.lib, 'defaults', part + '.js');
};

// return a filepath to a native module
exports.modules = function (part) {
  return path.join(exports.lib, 'modules', part + '.js');
};

// return a filepath to a client part
exports.client = function (part) {
  return path.join(exports.lib, 'client', part + '.js');
};

// preload common modules
exports.utils = require('./utils.js');

var requires = exports.core('require');
exports.asyncRequire = requires.asyncRequire;
exports.staticRequire = requires.staticRequire;
