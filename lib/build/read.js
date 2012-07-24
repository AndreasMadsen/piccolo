
var fs = require('fs');
var path = require('path');
var async = require('async');
var safedir = require('safedir');

function directoryContent(dirname, onlyExt, callback) {

  safedir(dirname, function (error, list) {
    if (error) return callback(error, null);

    // filter none ext path
    list = list.filter(function (filename) {
      var ext = filename.slice(filename.length - onlyExt.length, filename.length);
      return (ext === onlyExt);
    });

    // read files
    function read(filename, callback) {
      fs.readFile(path.resolve(dirname, './' + filename), 'utf8', function (error, content) {
        if (error) return callback(error, null);

        callback(null, {
          key: path.basename(filename, onlyExt),
          value: content
        });
      });
    }

    async.map(list, read, function (error, results) {
      if (error) return callback(error, null);

      var map = {};
      results.forEach(function (obj) {
        map[obj.key] = obj.value;
      });

      callback(null, map);
    });
  });
}
module.exports = directoryContent;
