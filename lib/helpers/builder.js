
var path = require('path');

var common = require('../common.js');
var createFileObject = common.helper('file').fileObject;

function builder(callback) {
  var files = {
    head: [ common.client('head') ],
    foot: [ common.client('foot') ],
    core: [],
    natives: []
  };
  var parts = Object.keys(files);

  // main core
  files.core.push(common.client('nextTick'));
  files.core.push(common.client('require'));

  // native modules
  common.natives.forEach(function (name) {
    files.natives.push(common.modules(name));
  });

  // calculate the number of async callbacks
  var missing = 0;
  parts.forEach(function (name) {
    missing += files[name].length;
  });

  // expand a filepath with file size and fd
  parts.forEach(function (name) {
    files[name].forEach(function (filepath, index) {
      createFileObject(filepath, function (error, object) {
        if (error) throw error;

        files[name][index] = object;

        missing -= 1;
        if (missing === 0) {
          createCore();
        }
      });
    });
  });

  function writeFile(start, buffer, file) {
    file.content.copy(buffer, start, 0, file.length);
    return start + file.length;
  }

  function writeString(start, buffer, string) {
    buffer.write(string, start);
    return start + string.length;
  }

  function moduleWrapper(name) {
    return {
      start: 'NativeModule.' + name + ' = (function (exports, require) {\n',
      end: '  return exports;\n})({}, piccolo.require);\n'
    };
  }

  function createCore() {
    var start = 0;

    // Calculate buffer size
    var size = 0;
    files.head.forEach(function (file) { size += file.length + 1; });
    files.core.forEach(function (file) { size += file.length + 1; });
    files.natives.forEach(function (file) {
      // create module wrapper
      file.wrapper = moduleWrapper( path.basename(file.path, '.js') );
      size += file.length + file.wrapper.start.length + file.wrapper.end.length + 1;
    });
    files.foot.forEach(function (file) { size += file.length + 1; });

    // Allocate buffer
    var buffer = new Buffer(size);

    // copy head files intro buffer
    files.head.forEach(function (file) {
      start = writeString(start, buffer, "\n");
      start = writeFile(start, buffer, file);
    });

    // copy core files intro buffer
    files.core.forEach(function (file) {
      start = writeString(start, buffer, "\n");
      start = writeFile(start, buffer, file);
    });

    // copy native module files intro buffer
    files.natives.forEach(function (file) {
      start = writeString(start, buffer, "\n");
      start = writeString(start, buffer, file.wrapper.start);
      start = writeFile(start, buffer, file);
      start = writeString(start, buffer, file.wrapper.end);
    });

    // copy foot files intro buffer
    files.foot.forEach(function (file) {
      start = writeString(start, buffer, "\n");
      start = writeFile(start, buffer, file);
    });

    // return buffer
    callback(buffer);
  }
}
module.exports = builder;
