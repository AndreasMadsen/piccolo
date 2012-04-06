
var path = require('path');
var common = require('../common.js');

// handel all none-javascript requests
function plugin(piccolo) {

  // get route module
  var routeParser = new common.NativeModule.router();
  var url = common.NativeModule.url;

  // set structure key in progress tracker
  piccolo.progress.set('route');

  // set route handler
  return function router(req, res) {

    // Parse query using route
    var query = routeParser.parse(url.parse(req.url).pathname);
    var filepath = path.join(piccolo.directories.project, query.path);

    // Get change table resource
    common.asyncRequire(filepath, function (error, Resource) {
      if (error) return piccolo.emit('error', error);

      // Execute change table method with given arguments
      var changeTable = new Resource(req, res);
          changeTable[query.method](query.args);
    });
  };
}
module.exports = plugin;
