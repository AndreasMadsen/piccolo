
var fs = require('fs');

// Read file content and stat data
function fileObject(path, callback) {
  var ret = { 'path': path };

	fs.open(path, 'r', function (error, fd) {
    if (error) return callback(error, null);

    fs.fstat(fd, function (error, stat) {
      if (error) return callback(error, null);
      ret.modified = stat.mtime;
      ret.modifiedString = stat.mtime.toUTCString();

      ret.length = stat.size;
      ret.content = new Buffer(stat.size);

      fs.read(fd, ret.content, 0, stat.size, 0, function (error) {
        if (error) return callback(error, null);

        fs.close(fd, function () {
          callback(null, ret);
        });
      });
    });
	});
}
exports.fileObject = fileObject;
