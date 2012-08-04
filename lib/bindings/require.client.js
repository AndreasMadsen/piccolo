
var xhr = require.binding('xhr');

module.exports = function (modulename, cache, callback) {
  var e = encodeURIComponent;
  var url = '/piccolo/require/' +
              '?name=' + e(modulename) +
              '&cache=' + e(JSON.stringify(cache));

  xhr(url, function (error, res) {
    if (error) return callback(error, null);

    var modules = res.responseXML.getElementsByTagName('module');
    var map = {};

    var i = modules.length;
    while (i--) {
      var elem = modules[i];
      map[elem.getAttribute('path')] = elem.firstChild.textContent;
    }

    callback(null, map);
  });
};
