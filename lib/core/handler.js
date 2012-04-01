
var url = require('url');
var fs = require('fs');
var path = require('path');
var connect = require('connect');

var common = require('../common.js');
var utils = common.utils;

exports.setup = function (piccolo) {
  var handle = connect();

  handle.use( connect.compress() );
  handle.use( connect['static'](piccolo.directories['static'], { maxAge: piccolo.settings }) );
  handle.use( connect.staticCache() );

  handle.use( structure(this) );
  handle.use( route(this) );

  connect.errorHandler.title = 'piccolo';
  handle.use (connect.errorHandler() );

  return handle;
};

// handle all /piccolo/ requests
function structure(piccolo) {

  // Read the client core file immediately for performance
  var clientCore = fs.readFileSync(path.join(common.lib, 'core/client.js'));
  var clientCoreLength = clientCore.length;
  var cilentCoreModified = (new Date()).toUTCString();

  return function(req, res, next) {
    // skip if there is no prefix
    if (req.url.indexOf('/piccolo/') !== 0) return next();

    // strip url so the prefix is removed and parse url
    var parsed = url.parse(req.url.substr(8), true);

    // send framework file
    if (parsed.pathname === '/framework.js') {
      res.setHeader('Last-Modified', cilentCoreModified);
      res.setHeader('Content-Length', clientCoreLength);
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Cache-Control', 'public, max-age=' + (piccolo.settings.maxAge / 1000));
      return res.end(clientCore);
    }

    // create httpError error
    return next(utils.httpError(400));
  };
}

function route(piccolo) {

  // Get the route module
  var route = require(piccolo.modules.route);

  return function(req, res) { };
}
