
var path = require('path');

// list all native modules in dependency order
exports.natives = ['util', 'url', 'events'];

// find lib and root folder
exports.lib = path.dirname(module.filename);
exports.root = path.join(exports.lib, '../');

// create filepath resolve shortcuts
['core', 'helpers', 'defaults', 'modules', 'client'].forEach(function (folder) {
  exports[folder] = function (part) {
    return path.join(exports.lib, folder, part + '.js');
  };
});

// return a core module object
exports.getCore = function (part) {
  return require(exports.core(part));
};

// return a helper module object
exports.getHelper = function (part) {
  return require(exports.helpers(part));
};

// preload common modules
exports.utils = require('./utils.js');

var requires = exports.getCore('require');
exports.asyncRequire = requires.asyncRequire;
exports.staticRequire = requires.staticRequire;
exports.NativeModule = requires.NativeModule;
