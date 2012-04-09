
var fs = require('fs');
var vm = require('vm');
var path = require('path');

var common = require('../common.js');
var utils = common.utils;

var callbacks = {};
var NativeModule = {};

// Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
// because the buffer-to-string conversion in `fs.readFile()`
// translates it to FEFF, the UTF-16 BOM.
function removeBOM(content) {
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  return content;
}

// Compile a sync module (internal only)
function compileSyncModule(filepath) {
  var content = fs.readFileSync(filepath, 'utf8');

  // Primitive require method, do only support native modules
  var requireNative = function (name) {
    if (NativeModule[name]) return NativeModule[name];

    throw new Error("The module " + name + " is not a native module");
  };

  // Will be overwriten by the module wrapper
  var exports = {};

  var wrapper = '(function (exports, require) {' +
                  removeBOM(content) +
                'return exports; });';

  try {
    // compile wrapper using VM
    var compiledWrapper = vm.runInThisContext(wrapper, filepath);
    exports = compiledWrapper.call({}, exports, requireNative);
  } catch (vmError) {
    throw vmError;
  }

  return exports;
}

// Compile an async module
function compileAsyncModule(piccolo, filepath, callback) {
  // Read content from file
  fs.readFile(filepath, 'utf8', function (err, content) {
    if (err) return callback(err, null);

    // Do only execute callback once
    var called = false;

    // Create a exports function there execute the callback
    var exports = function (exports) {
      if (called) return;
      called = true;
      callback(null, exports);
    };

    // Create a functional wrapper
    var wrapper = '(function (exports, require) {' +
                    removeBOM(content) +
                  '});';

    try {
      // Compile wrapper using VM
      var compiledWrapper = vm.runInThisContext(wrapper, filepath);
          compiledWrapper.call({}, exports, piccolo.require.bind(piccolo));
    } catch (vmError) {
      if (called) throw vmError;
      called = true;
      callback(vmError, null);
    }
  });
}

// Setup NativeModule cache with isomorphic modules
common.natives.forEach(function (name) {
  NativeModule[name] = compileSyncModule(common.modules(name));
});

// Setup the NativeModule cache with server side abstracts
['changeTable'].forEach(function (name) {
  NativeModule[name] = compileSyncModule(common.core(name));
});

// Exports native modules object
exports.NativeModule = NativeModule;

// In order to support multiply requests of the same module
// there don't exist in the cache.
function callbackHandler(piccolo, filename) {
  return new utils.mutiplyLoader(function (error, exports) {
      // save module exports in cache
      if (!error) {
        piccolo.requireCache[filename] = exports;
      }

      // cleanup by deleteing callbackHandler and script tag reference
      delete callbacks[filename];
  });
}

// Async require a module given by exact filename or NativeModule name
function asyncRequire(piccolo, filename, callback) {

  if (!callback) throw new Error("missing callback in require");

  // Return native module object
  if (NativeModule[filename]) {
    callback(null, NativeModule[filename]);
    return;
  }

  // Resolve the filename, will make the cache more robust
  filename = path.normalize(filename);

  // Check if the module is stored in cache
  if (piccolo.requireCache[filename]) {
    callback(null, piccolo.requireCache[filename]);
    return;
  }

  // If load is on progress add callback to handler list
  var handler = callbacks[filename];
  if (handler) {
    handler.list.push(callback);
    return;
  }

  // Create a new module load handler
  handler = callbacks[filename] = callbackHandler(piccolo, filename);
  handler.push(callback);

  // Get an async module
  compileAsyncModule(piccolo, filename, function (error, exports) {
    if (error) {
      piccolo.emit('error', error);
      handler.done(error, null);
      return;
    } else {
      handler.done(null, exports);
    }
  });
}

// exports asyncRequire function
module.exports.requireModule = asyncRequire;
