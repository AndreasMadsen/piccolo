
var url = require('url');
var fs = require('fs');
var path = require('path');
var connect = require('connect');

var common = require('../common.js');
var utils = common.utils;

exports.setup = function (piccolo) {
  var handle = connect();

  handle.use( connect.compress() );

  // Force none cache control
  if (piccolo.settings.maxAge) {
    handle.use(function (req, res, next) {

      res.setHeader('Expires', 'Mon, 26 Jul 1997 05:00:00 GMT');
      res.setHeader('Cache-Control', 'no-cache, private, must-revalidate, ' +
                                     'max-stale=0, post-check=0, pre-check=0 no-store');
      res.setHeader('Pragma', 'no-cache');

      next();
    });
  }

  // setup static file server
  handle.use( connect['static'](piccolo.directories['static'], piccolo.settings) );
  handle.use( connect.staticCache() );

  // ignore favicon.ico for now
  handle.use(function (req, res, next) {
    if (req.url === '/favicon.ico') return res.end();
    next();
  });

  handle.use( structure(piccolo) );
  handle.use( route(piccolo) );

  connect.errorHandler.title = 'piccolo';
  handle.use (connect.errorHandler() );

  return handle;
};

// handle all /piccolo/ requests
function structure(piccolo) {

  var cache = {};
  var startTime = (new Date()).toUTCString();

  // Read the client core file immediately for performance
  function readFile(file) {
    var context = fs.readFileSync(file);
    return {
      'context': context,
      'length': context.length
    };
  }

  // Read core file
  cache.core = readFile(path.join(common.lib, 'core/client.js'));

  // Read modules
  cache.modules = {};
  Object.keys(piccolo.modules).forEach(function (name) {
    cache.modules[name] = readFile(piccolo.modules[name]);
  });

  // set structure key in progress tracker
  piccolo.progress.set('structure');

  return function(req, res, next) {
    // Skip if there is no prefix
    if (req.url.indexOf('/piccolo/') !== 0) return next();

    // Strip url so the prefix is removed and parse url
    var parsed = url.parse(req.url.substr(8), true);

    // Set content type to javascript
    res.setHeader('Content-Type', 'application/javascript');

    // Set cache control
    if (piccolo.settings.maxAge !== 0) {
      res.setHeader('Cache-Control', 'public, max-age=' + (piccolo.settings.maxAge / 1000));
      res.setHeader('Last-Modified', startTime);
    }

    // Send static files
    if (parsed.pathname === '/framework.js') {
      res.setHeader('Content-Length', cache.core.length);
      res.end(cache.core.context);
      return;
    }

    // Get file name without .js
    var name = path.basename(parsed.pathname, '.js');

    // translate directory to map property
    var resource;
    if (parsed.pathname.indexOf('/module/') === 0) {
      resource = cache.modules[name];
    }

    // Check that module exist
    if (resource === undefined) {
      return next(utils.httpError(400));
    }

    // Security: do not attempt to understand large callbackID (they are properly not numbers)
    if (parsed.query.id.length > 10) {
      return next(utils.httpError(400));
    }

    // Parse callbackID
    var callbackID = parseInt(parsed.query.id, 10);

    // Could not parse (NaN check)
    if (callbackID !== callbackID) {
      return next(utils.httpError(400));
    }

    // create prefix and postfix
    var prefix = ';(function() {\n  var exports = {}; \n';
    var postfix = '\n  window.piccolo.loaded(' + callbackID + ', exports);\n})();';

    // Calculate content length
    res.setHeader('Content-Length', prefix.length + resource.length + postfix.length);

    // Send module context
    res.write(prefix);
    res.write(cache.modules[name].context);
    res.end(postfix);
  };
}

function route(piccolo) {

  var handler;

  // Get the route module
  utils.require(piccolo.modules.route, function (route) {

    // set route method
    handler = function (req, res) {

      // Parse query string
      var query = url.parse(req.url);

      // Parse query using route
      var change = route.parse(query);

      // Require the change table
      utils.require(change.path, function (Resource) {

        // Execute change table method with given arguments
        var changeTable = new Resource(req, res);
            changeTable[change.method].apply(changeTable, change.args);
      });
    };

    // set structure key in progress tracker
    piccolo.progress.set('route');
  });

  // TODO: A better design for this is need
  return function(req, res) { handler(req, res); };
}
