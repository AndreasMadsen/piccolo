
var path = require('path');

function Router(piccolo) {
  // Save presenter directory
  this.directory = piccolo.directories.presenter;
}
module.exports = Router;

Router.prototype.parse = function (filepath) {

  // Parse path
  var args = filepath.split('/');

  // Get resource and method from path
  var resource = args.splice(0, 1)[0] || '';
  var method = args.splice(0, 1)[0] || '';

  // Translate empty path to index
  if (resource === '') {
    resource = 'index';
    method = 'index';
  }

  // Translate empty method to index
  if (method === '') {
    method = 'index';
  }

  return {
    path: path.join(this.directory, resource, 'changeTable.js'),
    method: method,
    args: args
  };
};

Router.prototype.error = function (code, error) {

  // Create a JSON stringify able error object
	var out = {};
	for (var name in error) {
		out[name] = error[name];
	}
	out.message = error.message;
	out.stack = error.stack;
	out.type = error.type;
	out.construct = error.constructor.name;

  return {
    filepath: path.join(this.directory, 'error', 'changeTable.js'),
    method: 'error' + code,
    args: [out]
  };
};
