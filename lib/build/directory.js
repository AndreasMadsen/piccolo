
var path = require('path');
var async = require('async');
var wrench = require('wrench');

module.exports = function Directory(path, callback) {
  var self = this;

  // save given path
  this.path = path;

  async.parallel({
    // create directory map
    dirMap: wrench.readdirRecursive.bind(wrench, path)
  }, function (error, result) {
    if (error) return callback(error, null);

    result.dirMap = result.dirMap.map(function (value) {
      return '/' + value;
    });

    self.cache = result;
    callback(self);
  });
};

Directory.prototype.exist = function (filename) {
  return (this.cache.dirMap.indexOf(filename) !== -1);
};
