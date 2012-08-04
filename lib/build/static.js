
var fs = require('graceful-fs');
var path = require('path');
var mime = require('mime');
var safedir = require('safedir');

var common = require('../common.js');
var createETag = common.load('helpers', 'etag');

function StaticFile(piccolo, callback) {
  if (!(this instanceof StaticFile)) return new StaticFile(piccolo, callback);

  var self = this;

  // save given path
  this.path = piccolo.get('static');

  safedir(path, function (error, result) {
    if (error) return callback(error, null);

    self.cache = result;
    callback(null, self);
  });
}
module.exports = StaticFile;

StaticFile.prototype.exist = function (filename) {
  return (this.cache.indexOf(filename) !== -1);
};

StaticFile.prototype.readClient = function (filename) {
  filename = path.resolve(this.path, './' + filename);

  var stream = fs.createReadStream(filename);
      stream.pause();

  fs.stat(filename, function (error, stat) {
    if (error) return stream.emit('error', error);

    stream.mtime = stat.mtime;
    stream.etag = createETag(stat.ino + '/' + stat.mtime + '/' + stat.size);
    stream.type = mime.lookup(filename);
    stream.size = stat.size;
    stream.emit('ready');
  });

  return stream;
};

StaticFile.prototype.readServer = function (filepath, callback) {
  filepath = path.resolve(this.path, './' + filepath);
  fs.readFile(filepath, 'utf8', callback);
};
