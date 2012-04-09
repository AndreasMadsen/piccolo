
var path = require('path');
var url = require('url');

var common = require('../common.js');
var utils = common.utils;
var coreBuilder = common.getHelper('builder');
var createFileObject = common.getHelper('file').fileObject;
var requires = common.getCore('require');

// handle all /piccolo/ requests
function plugin(piccolo) {

  var callbacks = {};
  var cache = {
    changeTable: {}
  };

  var track = new utils.ProgressTracker(piccolo.progress.set.bind(piccolo.progress, 'structure'));
  track.add(['core']);

  // Create client core file
  coreBuilder(piccolo, function (buffer) {
    cache.core = {
      'content': buffer,
      'length': buffer.length,
      'modified': (new Date()).toUTCString()
    };
    track.set('core');
  });

  function sendResource(res, resource) {
    // Set cache control
    // TODO: handle If-Modified-Since
    if (piccolo.settings.maxAge !== 0) {
      res.setHeader('Cache-Control', 'public, max-age=' + (piccolo.settings.maxAge / 1000));
    }

    // Send static file
    res.setHeader('Last-Modified', resource.modified);
    res.setHeader('Content-Length', resource.length);
    res.end(resource.content);
  }

  function callbackHandler(path) {
    return new utils.mutiplyLoader(function (error, resource) {
      // save exports in cache
      if (!error) {
        cache.changeTable[path] = resource;
      }

      // cleanup by deleteing callbackHandler and script tag reference
      delete callbacks[path];
    });
  }

  // get route module
  var routeParser = new requires.NativeModule.router();

  return function structure(req, res, next) {

    // Skip if there is no prefix
    if (req.url.indexOf('/piccolo/') !== 0) return next();

    // Strip url so the prefix is removed and parse url
    var parsed = url.parse(req.url.substr(8), true);

    // Set content type to javascript
    res.setHeader('Content-Type', 'application/javascript');

    // Translate framework to piccolo.core
    if (parsed.pathname === '/framework.js') {
      return sendResource(res, cache.core);
    }

    // Translate changeTable directory to map property
    if (parsed.pathname.indexOf('/changeTable/') === 0 && typeof parsed.query.path === 'string') {

      // Parse path query
      var query = routeParser.parse(parsed.query.path).path;

      // Check the cache for the changeTable
      var resource = cache.changeTable[query];
      if (resource) {
        return sendResource(res, resource);
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
          if (error) {
            res.statusCode = 500;
            res.end();
            return;
          }

          // send resource if the file was read
          sendResource(res, resource);
      });

      // get the changeTable file
      if (firstTime) {
        var filepath = path.join(piccolo.directories.project, query);
        createFileObject(filepath, function (error, resource) {
          if (error) {
            handler.done(error, null);
            piccolo.emit('error', error);
            return;
          }

          // handler will execute all callbacks in list
          handler.done(null, resource);
        });
      }

      return;
    }

    // Send a 400 error in case no resource was send
    return next(utils.httpError(400));
  };
}

module.exports = plugin;
