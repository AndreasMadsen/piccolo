
var connect = require('connect');

exports.setup = function (piccolo) {
  var handle = connect();
  
  handle.use( connect.compress() );
  handle.use( connect['static'](piccolo.directories['static']) );
  handle.use( connect.staticCache() );
  
  return handle;
};
