
var path = require('path');

var common = require('../common.js');
var utils = common.load('utils');
var requires = common.load('modules', 'module.server');
var url = requires.NativeModule.url;

// These modules will be quickly accessible from the change table abstract
var nodeModules = {
  fs: require('fs'),
  path: require('path')
};

module.exports = function handle_presenterRequest() {
  var piccolo = this.piccolo;

  var req = this.request;
  var res = this.response;

  var route = this.cache.route;
  var filepath = this.cache.filepath;

  // Get change table resource
  piccolo.require(filepath, true, function (error, Resource) {
    if (error) return next(utils.httpError(500, error));

    if (!Resource.prototype.hasOwnProperty(route.method)) {
      var err = new Error('change table method ' + route.method + ' do not exist in ' + route.path);
      return next(utils.httpError(404, err));
    }

    // Execute change table method with given arguments
    var changeTable = new Resource(req, res, piccolo, nodeModules);
        changeTable[route.method].apply(changeTable, route.args);
  });
};
