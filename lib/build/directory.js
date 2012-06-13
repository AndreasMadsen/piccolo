
var fs = require('fs');
var mime = require('mime');
var async = require('async');

var common = require('../common.js');
var readdir = common.load('helpers', 'readdir');

function Directory(path, callback) {
  if (!(this instanceof Directory)) return new Directory(path, callback);

  var self = this;

  // save given path
  this.path = path;

  async.parallel({
    // create directory map
    dirMap: readdir.bind(null, path)
  }, function (error, result) {
    if (error) return callback(error, null);

    self.cache = result;
    callback(null, self);
  });
}
module.exports = Directory;

Directory.prototype.exist = function (filename) {
  return (this.cache.dirMap.indexOf(filename) !== -1);
};

Directory.prototype.read = function (filename) {
  var stream = fs.createReadStream(filename);
      stream.pause();

  fs.stat(filename, function (error, stat) {
    if (error) return stream.emit('error', error);

    stream.mtime = stat.mtime;
    stream.type = mime.lookup(filename);
    stream.emit('ready');
  });

  return stream;
};
