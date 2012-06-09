
var fs = require('fs');
var path = require('path');
var async = require('async');

function Directory(path, callback) {
  if (!(this instanceof Directory)) return new Directory(path, callback);

  var self = this;

  // save given path
  this.path = path;

  async.parallel({
    // create directory map
    dirMap: directoryMap.bind(null, path)
  }, function (error, result) {
    if (error) return callback(error, null);

    result.dirMap = result.dirMap.map(function (value) {
      return '/' + value;
    });

    self.cache = result;
    callback(null, self);
  });
}
module.exports = Directory;

Directory.prototype.exist = function (filename) {
  return (this.cache.dirMap.indexOf(filename) !== -1);
};

function directoryMap(pathname, callback) {

  // resolved filepaths
  var result = [];

  // deep read directory query
  var query = [];

  fs.readdir(pathname, function (error, files) {
    if (error) return callback(error, null);

    // run stat on all files and directorys
    files = files.map(function (name) {
      return path.resolve(pathname, name);
    });

    async.map(files, fs.stat, function(error, stats) {
      if (error) return callback(error, null);

      // divide intro result and query
      stats.forEach(function (stat, index) {
        var filepath = files[index];

        if (stat.isDirectory()) {
          return query.push(filepath);
        }

        result.push(filepath);
      });

      // nothing to do, return result
      if (query.length === 0) {
        return callback(null, result);
      }

      // resolve directorys, when done
      async.map(query, directoryMap, function (error, resolved) {
        if (error) return callback(error, null);

        // add resolved filemap to result
        callback( null, result.concat.apply(result, resolved) );
      });

    });
  });
}
