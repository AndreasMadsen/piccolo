
var path = require('path');
var common = require('../common.js');
var requires = common.getCore('require');

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

  // set route handler
  return function router(req, res) {

    // Parse query using route
    var query = url.parse(req.url);
    var executes = routeParser.parse(query.pathname);
    var filepath = path.join(piccolo.directories.project, executes.path);

    // Get change table resource
    piccolo.require(filepath, true, function (error, Resource) {
      if (error) return piccolo.emit('error', error);

      // Execute change table method with given arguments
      var changeTable = new Resource(req, res, query, piccolo, modules);
          changeTable[executes.method](executes.args);
    });
  };
}
module.exports = plugin;
