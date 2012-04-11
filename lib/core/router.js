
var path = require('path');

var common = require('../common.js');
var utils = common.utils;
var requires = common.getCore('require');
var url = requires.NativeModule.url;

// These modules will be quickly accessible from the change table abstract
var modules = {
  fs: require('fs'),
  path: require('path')
};

function createRouters(piccolo) {
  // get route module
  var routeParser = new piccolo.router();

  // set structure key in progress tracker
  piccolo.progress.set('route');

  function handleQuery(req, res, query, executes) {
    var filepath = path.join(piccolo.directories.presenter, executes.path);

    // Check that changeTable exists
    utils.exists(filepath, function (exists) {

      if (exists === false) {
        var err = new Error('change table ' + executes.path + ' not found.');
            err.status = 404;
        return handleError(req, res, err, query);
      }

      // Get change table resource
      piccolo.require(filepath, true, function (error, Resource) {
        if (error) return;

        if (!Resource.prototype.hasOwnProperty(executes.method)) {
          var err = new Error('change table method ' + executes.method + ' do not exist in ' + executes.path);
              err.status = 404;
          return handleError(req, res, err, query);
        }

        // Execute change table method with given arguments
        var changeTable = new Resource(req, res, query, piccolo, modules);
            changeTable[executes.method].apply(changeTable, executes.args);
      });
    });
  }

  function handleError(req, res, error, query) {
    // Set status code
    if (error.status) res.statusCode = error.status;
    if (error.statusCode < 400) res.statusCode = 500;

    // Parse query using route
    if (query === undefined) {
      query = url.parse(req.url);
    }

    // Parse errors
    var executes = routeParser.error(res.statusCode, error);

    // Handle execute instructions
    handleQuery(req, res, query, executes);
  }

  // set route handler
  function router(req, res) {

    // Parse query using route
    var query = url.parse(req.url);
    var executes = routeParser.parse(query.pathname);
    handleQuery(req, res, query, executes);
  }

  return {
    handle: handleQuery,
    error: handleError,
    plugin: router
  };
}
module.exports.createRouters = createRouters;
