
function Router() {}

Router.prototype.parse = function (filepath) {

  // Parse path
  var args = filepath.split('/').filter(function (path) {
    return (path.trim() !== '');
  });

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
    path: '/' + resource + '/changeTable.js',
    method: method,
    args: args
  };
};

Router.prototype.error = function (code, error) {
  return {
    path: '/error/changeTable.js',
    method: 'error' + code,
    args: [error]
  };
};

exports(Router);

