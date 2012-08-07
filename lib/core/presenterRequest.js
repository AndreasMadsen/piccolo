
var common = require('../common.js');
var utils = common.load('utils');

module.exports = function handle_presenterRequest() {
  var self = this;
  var piccolo = this.piccolo;

  var res = this.response;

  var route = this.cache.route;

  this.log('info', 'Require presenter module: ' + this.cache.filepath);

  // Get change table resource
  piccolo.require(this.cache.filepath, function (error, Resource) {
    if (error) return self.emit('error', utils.httpError(500, error));

    self.log('info', 'Got ' + self.cache.filepath + ' presenter, now checking presenter.' + route.method);

    if (!Resource.prototype.hasOwnProperty(route.method)) {
      var err = new Error('change table method ' + route.method + ' do not exist in ' + route.path);
      return self.emit('error', utils.httpError(404, err));
    }

    self.log('info', 'Opening stream pipe to client from presenter (' + self.cache.filepath + ', ' + route.method + ') output');

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
