
var fs = require('graceful-fs');
var path = require('path');
var mime = require('mime');
var safedir = require('safedir');

function Directory(path, callback) {
  if (!(this instanceof Directory)) return new Directory(path, callback);

  var self = this;

  // save given path
  this.path = path;

  safedir(path, function (error, result) {
    if (error) return callback(error, null);

    self.cache = result;
    callback(null, self);
  });
}
module.exports = Directory;

Directory.prototype.exist = function (filename) {
  return (this.cache.indexOf(filename) !== -1);
};

Directory.prototype.read = function (filename) {
  filename = path.resolve(this.path, './' + filename);

  var stream = fs.createReadStream(filename);
      stream.pause();

  fs.stat(filename, function (error, stat) {
    if (error) return stream.emit('error', error);

    stream.mtime = stat.mtime;
    stream.type = mime.lookup(filename);
    stream.size = stat.size;
    stream.emit('ready');
  });

  return stream;
};
