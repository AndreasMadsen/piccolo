
var common = require('../common.js');
var requires = common.core('require');

// handel all none-javascript requests
function plugin(piccolo) {

  var url = requires.NativeModule.url;

  // get route module
  var RouteModule = require(piccolo.modules.router);
  var routeParser = new RouteModule(piccolo);

  // set structure key in progress tracker
  piccolo.progress.set('route');

  return function router(req, res) {

    // Parse query using route
    routeParser.parse(query.pathname, function (path, method, args) {

      // Get change table resource
      common.asyncRequire(path, function (error, Resource) {
        if (error) return piccolo.emit('error', error);

        // Execute change table method with given arguments
        var changeTable = new Resource(req, res);
            changeTable[method](args);
      });
    });
  };
}
module.exports = plugin;
