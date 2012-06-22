
var path = require('path');
var async = require('async');
var flower = require('flower');

var common = require('../common.js');
var readdir = common.load('helpers', 'readdir');
var readfile = common.load('helpers', 'file');

function remove(list, name) {
  return list.splice(list.indexOf(name), 1)[0];
}

function loadfile(file, callback) {
  readfile(file.path, function (error, fileobject) {
    if (error) return callback(error, null);

    // add module name to fileobject
    if (file.module) {
      fileobject.module = file.module;
    }

    callback(null, fileobject);
  });
}

function writeFile(start, buffer, file) {
  file.copy(buffer, start, 0, file.length);
  return start + file.length;
}

function writeString(start, buffer, string) {
  buffer.write(string, start);
  return start + string.length;
}

function ClientCore(piccolo, callback) {
  if (!(this instanceof ClientCore)) return new ClientCore(piccolo, callback);

  var self = this;

  async.parallel({
    bindings: readdir.bind(null, common.find('bindings', null)),
    modules: readdir.bind(null, common.find('modules', null)),
    core: readdir.bind(null, common.find('client', null))
  }, function (error, list) {
    if (error) return callback(error, null);

    var head, foot, loadlist;

    // remove head and foot file from core list
    head = { path: remove(list.core, common.find('client', 'head')) };
    foot = { path: remove(list.core, common.find('client', 'foot')) };

    list.modules = list.modules
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

    // resolve filepaths to include modulename
    list.modules = list.modules.map(function (filepath) {
      var modulename = path.basename(filepath, ".js");

      return {
        path: filepath,
        module: modulename
      };
    });

    // Add router module
    list.modules.push({
      path: piccolo.get('router'),
      module: 'router'
    });

    // resolve core files
    list.core = list.core.map(function (filepath) {
      return { path: filepath };
    });

    // create load list
    loadlist = [];
    loadlist.push(head);
    loadlist.push.apply(loadlist, list.bindings);
    loadlist.push.apply(loadlist, list.modules);
    loadlist.push.apply(loadlist, list.core);
    loadlist.push(foot);

    // load all files
    async.map(loadlist, loadfile, function (error, files) {
      if (error) return callback(error, null);

      var file, mtime = 0, size = 0, i = 0, timestamp = 0, start = 0, l = files.length;

      // calculate the mtime and file size
      for (i = 0; i < l; i++) {
        file = files[i];

        timestamp = file.mtime.getTime();
        if (timestamp > mtime) {
          mtime = timestamp;
        }

        if (file.module) {
          file.wrapper = {
            start: 'NativeModule.' + file.module + ' = (function (module, exports, require) {\n',
            end: '  \n});\n'
          };
        } else if (file.binding) {
          file.wrapper = {
            start: 'NativeBinding.' + file.binding + ' = (function (module, exports) {\n',
            end: '  \n});\n'
          };
        }

        if (file.wrapper) {
          size += file.wrapper.start.length;
          size += file.wrapper.end.length;
        }

        // a newline is added before each file, that is why we add "1"
        size += file.size + 1;
      }

      // set mtime date
      self.mtime = new Date(mtime);

      // create output buffer
      var buffer = new Buffer(size);

      for (i = 0; i < l; i++) {
        file = files[i];

        // add newline
        start = writeString(start, buffer, "\n");

        // add module wrapper
        if (file.module) start = writeString(start, buffer, file.wrapper.start);

        start = writeFile(start, buffer, file.content);

        // add module wrapper
        if (file.module) start = writeString(start, buffer, file.wrapper.end);
      }

      // create memory stream
      self.memory = flower.memoryStream();
      flower.buffer2stream(buffer).pipe(self.memory);

      // return client object
      callback(null, self);
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

  // emit ready on next tick
  process.nextTick(function () {
    stream.emit('ready');
  });

  return stream;
};
