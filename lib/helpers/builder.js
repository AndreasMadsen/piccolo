
var common = require('../common.js');
var configs = common.load('config.json');
var createFileObject = common.load('helpers', 'file').fileObject;
function builder(piccolo, callback) {

  // the lastest changed timestamp
  var lastestChange = 0;

  var files = {
    head: common.find('client', 'head'),
    natives: [],
    core: ['helpers', 'init', 'nextTick', 'require', 'link'],
    router: piccolo.get('router'),
    foot: common.find('client', 'foot')
  };

  // Define include order
  var parts = ['head', 'natives', 'core', 'router', 'foot'];

  // Add native modules
  configs.natives.forEach(function (name) {
    files.natives.push({
      name: name,
      path: common.find('modules', name)
    });
  });
  files.natives.push({
    name: 'changeTable',
    path: common.find('client', 'changeTable')
  });

  // Add main core
  files.core.forEach(function (part, index) {
    files.core[index] = common.find('client', part);
  });


  // calculate the number of async callbacks and normalize files
  var missing = 0;
  parts.forEach(function (name) {
    var obj = files[name];

    if (typeof obj === 'string') {
      files[name] = [obj];
    }

    files[name].forEach(function (filepath, index) {
      if (typeof filepath === 'string') {
        files[name][index] = { path: filepath };
      }
    });

    missing += files[name].length;
  });

  // expand a filepath with file size and fd
  parts.forEach(function (name) {
    files[name].forEach(function (prefile, index) {

      createFileObject(prefile.path, function (error, object) {
        if (error) return piccolo.emit('error', error);

        // Append name to object
        object.name = prefile.name;
        files[name][index] = object;

        // Lookup the change time
        var timestamp = object.modified.getTime();
        if (timestamp > lastestChange) {
          lastestChange = timestamp;
        }

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

  function createCore() {
    var start = 0;

    // Create wrapper objects
    files.natives.forEach(function (file) {
      // create native module wrapper
      file.wrapper = {
        start: 'NativeModule.' + file.name + ' = (function (exports, require) {\n',
        end: '  return exports;\n})({}, null);\n'
      };
    });
    files.router.forEach(function (file) {
      // create route wrapper
      file.wrapper = {
        start: 'var routeConstructor = (function (exports, require) {\n',
        end: '  \n});\n'
      };
    });

    // Calculate buffer size
    var size = 0;
    var parts = Object.keys(files);
    parts.forEach(function (name) {

      files[name].forEach(function (file) {
        size += file.length + 1;

        if (file.wrapper) {
          size += file.wrapper.start.length;
          size += file.wrapper.end.length;
        }
      });
    });

    // Allocate buffer
    var buffer = new Buffer(size);

    // copy all content to buffer in correct order
    parts.forEach(function (name) {

      files[name].forEach(function (file) {

        start = writeString(start, buffer, "\n");
        if (file.wrapper) start = writeString(start, buffer, file.wrapper.start);
        start = writeFile(start, buffer, file);
        if (file.wrapper) start = writeString(start, buffer, file.wrapper.end);
      });
    });

    // return buffer
    var date = new Date(lastestChange);
    callback({
      'content': buffer,
      'length': buffer.length,
      'modified': date,
      'modifiedString': date.toUTCString()
    });
  }
}
module.exports = builder;
