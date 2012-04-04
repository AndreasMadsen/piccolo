
// RegExp is from http://blog.stevenlevithan.com/archives/parseuri
var urlParser = /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/;
var queryParser = /(?:^|&)([^&=]*)=?([^&]*)/g;

exports.parse = function (url, parseQuery) {
  var result = urlParser.exec(url);
  var uri = {};

  if (result[1]) uri.protocol = result[1].toLowerCase() + ':';
  if (result[3]) uri.auth = result[3];
  if (result[6]) uri.hostname = result[6].toLowerCase();
  if (result[7]) uri.port = result[7];
  if (result[9]) uri.pathname = result[9];
  if (result[12]) uri.search = '?' + result[12];
  if (result[12]) uri.query = result[12];
  if (result[13]) uri.hash = '#' + result[13];

  // construct host property
  if (uri.auth || uri.hostname || uri.port) {
    uri.host = '';
    if (uri.auth) uri.host += uri.auth + '@';
    if (uri.hostname) uri.host += uri.hostname;
    if (uri.port) url.host += ':' + uri.port;
  }

  // construct path property
  if (uri.pathname || uri.search) {
    uri.path = '';
    if (uri.pathname) uri.path += uri.pathname;
    if (uri.search) uri.path += uri.search;
  }

  // construct href property
  uri.href = '';
  if (uri.protocol) uri.href += uri.protocol + '//';
  if (uri.host) uri.href += uri.host;
  if (uri.path) uri.href += uri.path;
  if (uri.hash) uri.href += uri.hash;

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
