
var path = require('path');

var common = require('../common.js');
var requires = common.getCore('require');
var utils = common.utils;

// handel all none-javascript requests
function plugin(piccolo) {

  // get route module
  var routeParser = new piccolo.router();
  var url = requires.NativeModule.url;

  // set structure key in progress tracker
  piccolo.progress.set('route');

  // These modules will be quickly accessible from the change table abstract
  var modules = {
    fs: require('fs'),
    path: require('path')
  };

  function handleQuery(req, res, query, executes) {
    var filepath = path.join(piccolo.directories.presenter, executes.path);

    // Check that changeTable exists
    utils.exists(filepath, function (exists) {

      if (exists === false) {
        var err = new Error('change table ' + executes.path + ' not found.');
        return handleQuery(req, res, query, routeParser.error(404, err));
      }

      // Get change table resource
      piccolo.require(filepath, true, function (error, Resource) {
        if (error) return;

        if (!Resource.prototype.hasOwnProperty(executes.method)) {
          var err = new Error('change table method ' + executes.method + ' do not exist in ' + executes.path);
          return handleQuery(req, res, query, routeParser.error(404, err));
        }

        // Execute change table method with given arguments
        var changeTable = new Resource(req, res, query, piccolo, modules);
            changeTable[executes.method].apply(changeTable, executes.args);
      });
    });
  }

  // set route handler
  return function router(req, res) {

    // Parse query using route
    var query = url.parse(req.url);
    var executes = routeParser.parse(query.pathname);
    handleQuery(req, res, query, executes);
  };
}
module.exports = plugin;
