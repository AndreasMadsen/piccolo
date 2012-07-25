
var xhr = require.binding('xhr');

var fileCache = {};

module.exports = function (filepath, callback) {
  // file already read
  if (fileCache[filepath]) {
    piccolo.nextTick(function () {
      callback(null, fileCache[filepath]);
    });
    return;
  }

  // make xhr request
  var e = encodeURIComponent;
  var url = '/piccolo/static/?path=' + e(filepath);

  xhr(url, function (error, res) {
    if (error) return callback(error, null);
    fileCache[filepath] = res.responseText;
    callback(null, res.responseText);
  });
};
