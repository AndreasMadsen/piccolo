
var path = require('path');

module.exports = function (filepath, callback) {
  // make filepath safe
  filepath = path.resolve('/', filepath);

  // return file
  piccolo.build.staticFile.readServer(filepath, callback);
};
