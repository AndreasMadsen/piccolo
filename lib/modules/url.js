
// RegExp is from http://blog.stevenlevithan.com/archives/parseuri
var urlParser = /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/;
var queryParser = /(?:^|&)([^&=]*)=?([^&]*)/g;

exports.parse = function (url, parseQuery) {
  var result = urlParser.exec(url);
  var uri = {
    href: result[0],
    protocol: result[1].toLowerCase() + ':',
    host: result[2].toLowerCase(),
    auth: result[3],
    hostname: result[6],
    port: result[7],
    pathname: result[9],
    search: '?' + result[12],
    path: result[9] + '?' + result[12],
    query: result[12],
    hash: '#' + result[13]
  };

  // parse query string
  if (parseQuery) {
    var object = {};
    uri.query.replace(queryParser, function ($0, $1, $2) {
      if ($1) object[$1] = $2;
    });
    uri.query = object;
  }

  return uri;
};
