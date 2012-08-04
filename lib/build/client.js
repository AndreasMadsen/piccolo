
var path = require('path');
var async = require('async');
var flower = require('flower');
var safedir = require('safedir');
var uglify = require("uglify-js");

var common = require('../common.js');
var utils = common.load('utils');
var readfile = common.load('helpers', 'file');
var createETag = common.load('helpers', 'etag');
var routerBuild = common.load('build', 'router');

function remove(list, name) {
  return list.splice(list.indexOf(name), 1)[0];
}

function loadfile(file, callback) {
  if (!file.path) {
    return callback(null, file);
  }

  readfile(file.path, function (error, fileobject) {
    if (error) return callback(error, null);

    // convert buffer to stringt
    fileobject.content = fileobject.content.toString();

    // add input properties to fileobject
    callback(null, utils.extend(fileobject, file));
  });
}

function ClientCore(piccolo, callback) {
  if (!(this instanceof ClientCore)) return new ClientCore(piccolo, callback);

  var self = this;

  async.parallel({
    bindings: safedir.bind(null, common.find('bindings', null), { safe: false }),
    modules: safedir.bind(null, common.find('modules', null), { safe: false }),
    core: safedir.bind(null, common.find('client', null), { safe: false })
  }, function (error, list) {
    if (error) return callback(error, null);

    // remove head and foot file from core list
    var head = { path: remove(list.core, common.find('client', 'head')) };
    var foot = { path: remove(list.core, common.find('client', 'foot')) };
    var init = { path: remove(list.core, common.find('client', 'init')) };

    list.bindings = list.bindings
      // remove server files from modules
      .filter(function (filepath) {
        return (filepath.indexOf('.server.js') === -1);
      })
      // resolve filepaths to include modulename
      .map(function (filepath) {
        var bindingname = path.basename(filepath, ".client.js");

        return {
          path: filepath,
          binding: bindingname
        };
      });

    // Link domstream-client module
    list.bindings.push({
      path: require.resolve('domstream-client'),
      binding: 'domstream'
    });

    // resolve filepaths to include modulename
    list.modules = list.modules.map(function (filepath) {
      var modulename = path.basename(filepath, ".js");

      return {
        path: filepath,
        module: modulename
      };
    });

    // resolve core files
    list.core = list.core.map(function (filepath) {
      return { path: filepath };
    });

    // create stringified dependencies map
    var dependenciesMap = (function () {
      var build = piccolo.build.dependencies.build;
      var mtime = 0;
      var map = {
        dirMap: build.dirMap,
        packageMap: build.packageMap
      };

      // Calculate mtime
      Object.keys(build.mtime).forEach(function (filename) {
        var timestamp = build.mtime[filename];
        if (timestamp > mtime) {
          mtime = timestamp;
        }
      });

      // return fileobject
      return {
        content: 'build.dependencies = ' + JSON.stringify(map),
        mtime: new Date(mtime)
      };
    })();

    // create stringified template map
    var templateMap = (function () {
      var build = piccolo.build.templates;
      var files = Object.keys(build.files);

      return {
        content: 'build.template = ' + JSON.stringify(files),
        mtime: new Date(build.mtime)
      };
    })();

    routerBuild.include(piccolo, function (error, routeContent) {
      if (error) return callback(error, null);

      // create load list
      var loadlist;
      loadlist = [];
      loadlist.push(head);
      loadlist.push(templateMap);
      loadlist.push(dependenciesMap);
      loadlist.push.apply(loadlist, list.bindings);
      loadlist.push.apply(loadlist, list.modules);
      loadlist.push(init);
      loadlist.push(routeContent);
      loadlist.push.apply(loadlist, list.core);
      loadlist.push(foot);

      // load all files
      async.map(loadlist, loadfile, function (error, files) {
        if (error) return callback(error, null);

        var mtime = 0, content = "";
        var jsp = uglify.parser;
        var pro = uglify.uglify;

        files.forEach(function (file) {
          // calculate the mtime
          var timestamp = file.mtime.getTime();
          if (timestamp > mtime) {
            mtime = timestamp;
          }

          // Add module content as a string so it can be compiled separately
          if (file.module) {
            // store source code in object property value
            content += 'build.NativeModuleSource.' + file.module + ' = ';

            // Compress content if settings says
            if (piccolo.get('compress')) {
              var ast = jsp.parse(file.content.toString());
                  ast = pro.ast_mangle(ast);
                  ast = pro.ast_squeeze(ast);

              file.content = pro.gen_code(ast);
            }

            // escape and add content
            content += JSON.stringify(file.content);

            // End JS quote
            content += ';';
          }
          // Add binding content in an function wrapper
          else if (file.binding) {
            content += 'build.NativeBinding.' + file.binding + ' = function (exports, require, module, piccolo, __filename, __dirname) {\n';
            content += file.content;
            content += '\n};';
          }
          // Add normal JS code
          else {
            content += file.content;
          }

          // Add linebreak (they are so beautiful)
          content += "\n";
        });

        // set mtime date
        self.mtime = new Date(mtime);
        self.etag = createETag(content);

        // Compress content if settings says
        if (piccolo.get('compress')) {
          var ast = jsp.parse(content);
              ast = pro.ast_mangle(ast);
              ast = pro.ast_squeeze(ast);

          content = pro.gen_code(ast);
        }

        // create memory stream
        self.memory = flower.memoryStream();
        flower.buffer2stream(content).pipe(self.memory);

        // return client object
        callback(null, self);
      });
    });
  });

}
module.exports = ClientCore;

ClientCore.prototype.read = function () {
  var stream = this.memory.relay();
      stream.pause();

  // add metadata properties
  stream.type = 'application/javascript';
  stream.mtime = this.mtime;
  stream.etag = this.etag;

  // emit ready on next tick
  process.nextTick(function () {
    stream.emit('ready');
  });

  return stream;
};
