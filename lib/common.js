
var path = require('path');

// find lib and root folder
exports.lib = path.dirname(module.filename);
exports.root = path.join(exports.lib, '../');

exports.find = function () {
  var args = Array.prototype.slice.call(arguments);

  // get filename (last argument)
  var filename = args.pop();

  // create folder path
  var folder = path.join.apply(path, [exports.lib].concat(args));

  // if filename is set to null, just return the folder
  if (filename === null) {
    return folder + '/';
  }

  // add file extention
  if (filename.indexOf('.') === -1) {
    filename += '.js';
  }

  // return full filepath
  return path.join(folder, filename);
};

exports.load = function () {
  return require(exports.find.apply(exports, arguments));
};
