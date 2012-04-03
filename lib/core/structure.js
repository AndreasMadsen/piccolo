
var path = require('path');
var url = require('url');

var common = require('../common.js');
var utils = common.utils;
var coreBuilder = common.helper('builder');
var createFileObject = common.helper('file').fileObject;

// handle all /piccolo/ requests
function structure(piccolo) {

  var cache = {
    modules: {}
  };
  var natives = ['events'];
  var modules = Object.keys(piccolo.modules);

  var track = new utils.ProgressTracker(piccolo.progress.set.bind(piccolo.progress, 'structure'));
  track.add(['core']);
  track.add(modules);
  track.add(natives);

  // Create client core file
  coreBuilder(function (buffer) {
    cache.core = {
      'content': buffer,
      'length': buffer.length,
      'modified': (new Date()).toUTCString()
    };
    track.set('core');
  });

  // Read user defined / default modules
  modules.forEach(function (name) {
    createFileObject(piccolo.modules[name], function (object) {
      cache.modules[name] = object;
      track.set(name);
    });
  });

  // Read native modules
  natives.forEach(function (name) {
    createFileObject(common.modules(name), function (object) {
      cache.modules[name] = object;
      track.set(name);
    });
  });

  function route(req, res, next) {
    // Skip if there is no prefix
    if (req.url.indexOf('/piccolo/') !== 0) return next();

    // Strip url so the prefix is removed and parse url
    var parsed = url.parse(req.url.substr(8), true);

    // Set content type to javascript
    res.setHeader('Content-Type', 'application/javascript');

    var resource;

    // Translate framework to piccolo.core
    if (parsed.pathname === '/framework.js') {
      resource = cache.core;
    }

    // Translate directory to map property
    else if (parsed.pathname.indexOf('/module/') === 0) {
      // Get from cache using filename without .js
      resource = cache.modules[ path.basename(parsed.pathname, '.js') ];
    }

    // Check that the resource exist
    if (resource === undefined) {
      return next(utils.httpError(400));
    }

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

  return route;
}

module.exports = structure;
