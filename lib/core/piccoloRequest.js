
var path = require('path');
var url = require('url');

var common = require('../common.js');
var utils = common.load('utils');
var createFileObject = common.load('helpers', 'file').fileObject;

// handle all /piccolo/ requests
function plugin(piccolo) {

  var callbacks = {};
  var cache = {
    core: piccolo.build.client,
    changeTable: {}
  };

  function sendResource(req, res, resource) {

    // Check if a 304 respond should be send
    var useCache;
    if (req.headers['if-modified-since'] === undefined  || piccolo.get('cache') === 'none') {
      useCache = false;
    } else {
      useCache = Date.parse(req.headers['if-modified-since']) >= resource.modified.getTime();
    }

    // send 304 code if client should use the cache
    res.statusCode = useCache ? 304 : 200;

    // Set content type to javascript
    res.setHeader('Content-Type', 'application/javascript');

    // Set static file meta data
    res.setHeader('Last-Modified', resource.modifiedString);
    res.setHeader('Content-Length', resource.length);

    // Set cache control headers
    if (piccolo.get('cache') === 'none') {
      res.setHeader('Expires', 'Mon, 26 Jul 1997 05:00:00 GMT');
      res.setHeader('Cache-Control', 'no-cache, private, must-revalidate, ' +
                                     'max-stale=0, post-check=0, pre-check=0 no-store');
      res.setHeader('Pragma', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=' + piccolo.get('cache'));
    }

    // Write content
    if (useCache) {
      res.end();
    } else {
      res.end(resource.content);
    }
  }

  function callbackHandler(path) {
    return new utils.mutiplyLoader(function (error, resource) {
      // cleanup by deleteing callbackHandler and script tag reference
      delete callbacks[path];

      // relay errors to piccolo object
      if (error) return piccolo.emit('error', error);

      // save exports in cache
      cache.changeTable[path] = resource;
    });
  }

  // get route module
  var routeParser = new piccolo.router();

  return function structure(req, res, next) {

    // Skip if there is no prefix
    if (req.url.indexOf('/piccolo/') !== 0) return next();

    // Strip url so the prefix is removed and parse url
    var parsed = url.parse(req.url.substr(8), true);

    // Translate framework to piccolo.core
    if (parsed.pathname === '/framework.js') {
      return sendResource(req, res, cache.core);
    }

    // Translate changeTable directory to map property
    if (parsed.pathname.indexOf('/changeTable/') === 0 && typeof parsed.query.path === 'string') {

      // Parse path query
      var query = routeParser.parse(parsed.query.path).path;

      // Check the cache for the changeTable
      var resource = cache.changeTable[query];
      if (resource) {
        return sendResource(req, res, resource);
      }

      // Detect if the file is being read
      var firstTime = !callbacks[query];

      // Get or construct file reader handler
      if (firstTime) {
        callbacks[query] = callbackHandler(query);
      }
      var handler = callbacks[query];

      // add client callback to the handler list
      handler.push(function (error, resource) {
          if (error) return next(utils.httpError(500, error));

          // send resource if the file was read
          sendResource(req, res, resource);
      });

      // get the changeTable file
      if (firstTime) {
        var filepath = path.join(piccolo.get('presenter'), query);
        createFileObject(filepath, function (error, resource) {
          if (error) {
            handler.done(error, null);
            return;
          }

          // handler will execute all callbacks in list
          handler.done(null, resource);
        });
      }

      return;
    }

    // Send a 400 error in case no resource was send
    return next(utils.httpError(400, new Error('Framework acess denied')));
  };
}

module.exports = plugin;
