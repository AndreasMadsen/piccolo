
var connect = require('connect');

var common = require('../common.js');
var structure = common.load('core', 'structure');
var createRouters = common.load('core', 'router').createRouters;

exports.setup = function (piccolo) {

  // create route methods
  var routers = createRouters(piccolo);

  var handle = connect();

  handle.use( connect.compress() );

  // setup static file server
  handle.use( connect['static'](piccolo.get('static'), {maxAge: piccolo.get('cache')}) );
  handle.use( connect.staticCache() );

  // ignore favicon.ico for now
  handle.use(function (req, res, next) {
    if (req.url === '/favicon.ico') return res.end();
    next();
  });

  handle.use( structure(piccolo) );
  handle.use( routers.plugin );

  // parse errors through the change table error handler
  handle.use( routers.error );

  return handle;
};
