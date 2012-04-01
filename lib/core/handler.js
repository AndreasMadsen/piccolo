
var url = require('url');
var fs = require('fs');
var path = require('path');
var connect = require('connect');

var common = require('../common.js');

exports.setup = function (piccolo) {
  var handle = connect();

  handle.use( connect.compress() );
  handle.use( connect['static'](piccolo.directories['static']) );
  handle.use( connect.staticCache() );

  handle.use( structure );
  handle.use( route );

  return handle;
};

// Read the client core file immediately for performance
var clientCore = fs.readFileSync(path.join(common.lib, 'core/client.js'));
var clientCoreLength = clientCore.length;
var cilentCoreModified = (new Date()).toUTCString();

// handle all /piccolo/ requests
function structure(req, res, next) {
  // skip if there is no prefix
  if (req.url.indexOf('/piccolo/') !== 0) return next();

  // strip url so the prefix is removed and parse url
  var parsed = url.parse(req.url.substr(8), true);

  // send framework file
  if (parsed.pathname === '/framework.js') {
    res.setHeader('Last-Modified', cilentCoreModified);
    res.setHeader('Content-Length', clientCoreLength);
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'public, max-age=0');
    return res.end(clientCore);
  }
}

function route(req, res) { }
