
var connect = require('connect');

var common = require('../common.js');
var structure = common.core('structure');
var route = common.core('route');

exports.setup = function (piccolo) {
  var handle = connect();

  handle.use( connect.compress() );

  // Force none cache control
  if (piccolo.settings.maxAge) {
    handle.use(function (req, res, next) {

      res.setHeader('Expires', 'Mon, 26 Jul 1997 05:00:00 GMT');
      res.setHeader('Cache-Control', 'no-cache, private, must-revalidate, ' +
                                     'max-stale=0, post-check=0, pre-check=0 no-store');
      res.setHeader('Pragma', 'no-cache');

      next();
    });
  }

  // setup static file server
  handle.use( connect['static'](piccolo.directories.statics, piccolo.settings) );
  handle.use( connect.staticCache() );

  // ignore favicon.ico for now
  handle.use(function (req, res, next) {
    if (req.url === '/favicon.ico') return res.end();
    next();
  });

  handle.use( structure(piccolo) );
  handle.use( route(piccolo) );

  connect.errorHandler.title = 'piccolo';
  handle.use (connect.errorHandler() );

  return handle;
};
