
var connect = require('connect');

var common = require('../common.js');
var structure = common.getCore('structure');
var router = common.getCore('router');

exports.setup = function (piccolo) {
  var handle = connect();

  handle.use( connect.compress() );

  // setup static file server
  handle.use( connect['static'](piccolo.directories.statics, piccolo.settings) );
  handle.use( connect.staticCache() );

  // ignore favicon.ico for now
  handle.use(function (req, res, next) {
    if (req.url === '/favicon.ico') return res.end();
    next();
  });

  handle.use( structure(piccolo) );
  handle.use( router(piccolo) );

  connect.errorHandler.title = 'piccolo';
  handle.use (connect.errorHandler() );

  return handle;
};
