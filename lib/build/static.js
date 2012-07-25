
var fs = require('graceful-fs');
var path = require('path');

var common = require('../common.js');
var Directory = common.load('build', 'directory');

function StaticFile(piccolo, callback) {
  if (!(this instanceof StaticFile)) return new StaticFile(piccolo, callback);

  this.path = piccolo.get('static');
  this.cache = new Directory(this.path, callback);
}
module.exports = StaticFile;

StaticFile.prototype.exist = function () {
  return this.cache.exist.apply(this.cache, arguments);
};

StaticFile.prototype.readClient = function () {
  return this.cache.read.apply(this.cache, arguments);
};

StaticFile.prototype.readServer = function (filepath, callback) {
  filepath = path.resolve(this.path, './' + filepath);
  fs.readFile(filepath, 'utf8', callback);
};
