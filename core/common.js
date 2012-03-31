
var path = require('path');
var fs = require('fs');

exports.exists = fs.exists || path.exists;
exports.existsSync = fs.existsSync || path.existsSync;

// find root
exports.root = path.join(path.dirname(module.filename), '../');

// return a filepath to a default submodule
exports.defaults = function (part) {
  return path.join(exports.root, 'defaults', part + '.js');
};
