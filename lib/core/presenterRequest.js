
var common = require('../common.js');
var utils = common.load('utils');

module.exports = function handle_presenterRequest() {
  var self = this;
  var piccolo = this.piccolo;

  var res = this.response;

  var route = this.cache.route;

  // Get change table resource
  piccolo.require.presenter(route.path, function (error, Resource) {
    if (error) return self.emit('error', utils.httpError(500, error));

    if (!Resource.prototype.hasOwnProperty(route.method)) {
      var err = new Error('change table method ' + route.method + ' do not exist in ' + route.path);
      return self.emit('error', utils.httpError(404, err));
    }

    if (res.statusCode < 400) res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');

    var stream = self.open();
    if (stream) {
      // Execute change table method with given arguments
      var changeTable = new Resource(self.url, stream);
          changeTable[route.method].apply(changeTable, route.args);
    }
  });
};
