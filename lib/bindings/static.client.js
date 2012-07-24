
var xhr = require.binding('xhr');

module.exports = function (filepath, callback) {
  var e = encodeURIComponent;
  var url = '/piccolo/static/?path=' + e(filepath);

  xhr(url, function (error, res) {
    if (error) return callback(error, null);
    callback(null, res.responseText);
  });
};
