var url = require('url');

var common = require('../common.js');

// handel all none-javascript requests
function route(piccolo) {

  var handler;

  // Get the route module
  common.require(piccolo.modules.route, function (route) {

    // set route method
    handler = function (req, res) {

      // Parse query string
      var query = url.parse(req.url);

      // Parse query using route
      var change = route.parse(query);

      // Require the change table
      common.require(change.path, function (Resource) {

        // Execute change table method with given arguments
        var changeTable = new Resource(req, res);
            changeTable[change.method].apply(changeTable, change.args);
      });
    };

    // set structure key in progress tracker
    piccolo.progress.set('route');
  });

  // TODO: A better design for this is need
  return function(req, res) {
    handler(req, res);
  };
}
module.exports = route;
