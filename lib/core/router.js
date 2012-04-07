
var path = require('path');
var common = require('../common.js');

// handel all none-javascript requests
function plugin(piccolo) {

  // get route module
  var routeParser = new common.NativeModule.router();
  var url = common.NativeModule.url;

  // set structure key in progress tracker
  piccolo.progress.set('route');

  // These modules will be quickly accessible from the changeTable abstract
  var modules = {
    fs: require('fs'),
    path: require('path'),
    plates: common.NativeModule.plates
  };

  // set route handler
  return function router(req, res) {

    // Parse query using route
    var query = url.parse(req.url);
    var executes = routeParser.parse(query.pathname);
    var filepath = path.join(piccolo.directories.project, executes.path);

    // Get change table resource
    common.asyncRequire(filepath, function (error, Resource) {
      if (error) return piccolo.emit('error', error);

      // Execute change table method with given arguments
      var changeTable = new Resource(req, res, query, piccolo, modules);
          changeTable[executes.method](executes.args);
    });
  };
}
module.exports = plugin;
