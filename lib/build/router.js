
var vm = require('vm');
var fs = require('graceful-fs');

var common = require('../common.js');
var readfile = common.load('helpers', 'file');

var routepath = common.find('defaults', 'router');

exports.create = function (piccolo, callback) {
  // userland router module
  // use the standart require interface
  if (piccolo.get('router')) {
    piccolo.require(piccolo.get('router'), function (error, Router) {
      if (error) return callback(error, null);

      callback(null, new Router());
    });
    return;
  }

  // very minimal evaluation of the default router module
  // not CommonJS compatible
  fs.readFile(routepath, 'utf8', function (error, sourcecode) {
    if (error) return callback(error, null);

    var module = { exports: {} };
    var wrapper = [
      '(function (exports, module) {',
      '\n});'
    ];

    var fn = vm.runInThisContext(wrapper[0] + sourcecode + wrapper[1], '/piccolo/router.js');
    fn(module.exports, module);

    callback(null, module.exports);
  });
};

exports.include = function (piccolo, callback) {
  fs.stat(module.filename, function (error, stat) {
    if (error) return callback(error, null);

    // userland router module
    if (piccolo.get('router')) {
      callback(null, {
        content: "startup.piccoloRouter = function (piccolo) {\n" +
                 "  piccolo.require('" + piccolo.get('router') + "', function (error, router) {\n" +
                 "    piccolo.build.router = router;\n" +
                 "    piccolo.emit('ready.router');\n" +
                 "  });\n" +
                 "};",
        mtime: stat.mtime
      });
      return;
    }

    readfile(routepath, function (error, file) {
      if (error) return callback(error, null);

      callback(null, {
        content: "var routeModule = function (exports, module) {\n" +
                   file.content +
                 "};\n" +
                 "\n" +
                 "startup.piccoloRouter = function (piccolo) {\n" +
                 "  var module = { exports: {} };\n" +
                 "  routeModule(module.exports, module);\n" +
                 "\n" +
                 "  piccolo.build.router = module.exports;\n" +
                 "  piccolo.emit('ready.router');\n" +
                 "};",
        mtime: file.mtime > stat.mtime ? file.mtime : stat.mtime
      });
    });
  });
};
