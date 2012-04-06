
// RegExp is from http://blog.stevenlevithan.com/archives/parseuri
var urlParser = /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
    queryParser = /(?:^|&)([^&=]*)=?([^&]*)/g;

// copy an object without depth
function copyObject(obj) {
  var ret = {}, name;
  for (name in obj) {
    if (obj.hasOwnProperty(name)) {
      ret[name] = obj[name];
    }
  }
  return ret;
}

// construct host property
function setHost(uri) {
  if (uri.auth || uri.hostname || uri.port) {
    uri.host = '';
    if (uri.auth) uri.host += uri.auth + '@';
    if (uri.hostname) uri.host += uri.hostname;
    if (uri.port) uri.host += ':' + uri.port;
  }
}

// construct href property
function setHref(uri) {
  uri.href = '';
  if (uri.protocol) uri.href += uri.protocol + '//';
  if (uri.host) uri.href += uri.host;
  if (uri.path) uri.href += uri.path;
  if (uri.hash) uri.href += uri.hash;
}

// construct path property
function setPath(uri) {
  if (!uri.path && (uri.pathname || uri.search)) {
    uri.path = '';
    if (uri.pathname) uri.path += uri.pathname;
    if (uri.search) uri.path += uri.search;
  }
}

// construct search property
function setSearch(uri) {
  if (typeof uri.query === 'string') {
    uri.search = '?' + uri.query;
    return;
  }

  var name, filled = false;
  if (!uri.search && uri.query) {
    uri.search = '?';

    for (name in uri.query) {
      filled = true;
      uri.search += name + '=' + uri.query[name];
    }

    if (filled) {
      uri.search = uri.search.substr(0, uri.search.length - 1);
    }
  }
}

// split filepath from filename
function parseFilepath(path) {
  if (path === undefined) {
    return {filename: null, list: []};
  }

  var list = path.split('/'),
      isDir = (path[path.length - 1] === '/') || (list[list.length - 1].indexOf('.') === -1);

  return {
    filename: isDir ? null : list.pop(),
    list: list
  };
}

exports.parse = function (url, parseQuery) {
  var result = urlParser.exec(url),
      uri = {};

  if (result[1]) uri.protocol = result[1].toLowerCase() + ':';
  if (result[3]) uri.auth = result[3];
  if (result[6]) uri.hostname = result[6].toLowerCase();
  if (result[7]) uri.port = result[7];
  if (result[9]) uri.pathname = result[9];
  if (result[12]) uri.search = '?' + result[12];
  if (result[12]) uri.query = result[12];
  if (result[13]) uri.hash = '#' + result[13];

  // construct main properties
  setHost(uri);
  setPath(uri);

  // construct href property
  setHref(uri);

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

exports.format = function (uri) {

  if (typeof uri === 'string') {
    return uri;
  }

  if (uri.href) {
    return uri.href;
  }

  uri = copyObject(uri);

  // construct main properties
  setHost(uri);
  setPath(uri);
  setSearch(uri);

  // construct href property
  setHref(uri);

  return uri.href;
};

exports.resolve = function (source, relative) {
  var queryParse,
      sourcePath, relativePath, path,
      result, parts,
      i, name, filename, dir;

  // detect if query was parsed
  queryParse = (typeof source.query === 'object' || typeof relative.query === 'object');

  // resolve source and relative individual
  source = exports.parse(exports.format(source));
  relative = exports.parse(exports.format(relative));

  // prioritise relative
  parts = ['protocol', 'auth', 'hostname', 'port', 'search', 'query', 'hash'];
  result = {};
  i = parts.length;
  while(i--) {
    name = parts[i];
    result[name] = relative[name] || source[name];
  }

  // if the new path is a absolute path
  if (relative.pathname[0] === '/') {
    result.pathname = relative.pathname;
  } else {
    // parse pathname
    sourcePath = parseFilepath(source.pathname);
    relativePath = parseFilepath(relative.pathname);

    // get filename
    filename = relativePath.filename || sourcePath.filename;

    // combine directories
    path = sourcePath.list.concat(relativePath.list);

    i = 0;
    while (i !== path.length) {
      dir = path[i];

      // delete current directoy
      if (dir === '' || dir === '.') {
        path.splice(i, 1);
        continue;
      }

      // delete parent directory
      if (dir === '..') {
        path.splice(i, 1);

        if (i !== 0) {
          i -= 1;
          path.splice(i, 1);
        }
        continue;
      }

      // move to next path if it was a normal dir name
      i += 1;
    }
    result.pathname = '/';
    if (path.length !== 0) {
      result.pathname += path.join('/') + '/';
    }
    result.pathname += (filename || '');
  }

  // resolve new url object
  return exports.parse(exports.format(result), queryParse);
};
