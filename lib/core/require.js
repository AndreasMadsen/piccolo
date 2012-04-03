
var fs = require('fs');
var vm = require('vm');

var common = require('../common.js');

var cache = {};
var callbacks = {};
var NativeModule = {};

// precompile all native modules
function compileNativeModule(name) {
  var filepath = common.modules(name);
  var content = fs.readFileSync(filepath, 'utf8');

  var exports;
  var wrapper = '(function (exports, require) {' +
                  content +
                'return exports; });';

  try {
    // compile wrapper using VM
    var compiledWrapper = vm.runInThisContext(wrapper, filepath);
    exports = compiledWrapper.call({}, {}, require);
  } catch (vmError) {
    throw vmError;
  }

  return exports;
}
common.natives.forEach(function (name) {
  NativeModule[name] = compileNativeModule(name);
});

// async read module file
function request(filepath, callback) {
  // read content from file
  fs.readFile(filepath, 'utf8', function (err, content) {
    if (err) throw err;

    // Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
    // because the buffer-to-string conversion in `fs.readFile()`
    // translates it to FEFF, the UTF-16 BOM.
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }

    callback(content);
  });
}

function callbackHandler(filename) {
  return {
    list: [],
    done: function (exports) {
      // save exports in cache
      cache[filename] = exports;

      // cleanup by deleteing callbackHandler and script tag reference
      delete callbacks[filename];

      // execute all callbacks in the list
      var i = this.list.length;
      while(i--) this.list[i](exports);
    }
  };
}

// the exposed require function
function asyncRequire(filename, callback) {

  if (!callback) throw new Error("missing callback in require");

  // translate native module names to filepath
  if (NativeModule[filename]) {
    callback(NativeModule[filename]);
    return;
  }

  // module loaded: use cache
  if (cache[filename]) {
    callback(cache[filename]);
    return;
  }

  // loading in progress: add callback to handler list
  var handler = callbacks[filename];
  if (handler) {
    handler.list.push(callback);
    return;
  }

  // begin new module loading
  handler = callbacks[filename] = callbackHandler(filename);
  handler.list.push(callback);

  request(filename, function (content) {

    var wrapper = '(function (exports, require) {' +
                    content +
                  '});';

    try {
      // compile wrapper using VM
      var compiledWrapper = vm.runInThisContext(wrapper, filename);
          compiledWrapper.call({}, handler.done.bind(handler), require);
    } catch (vmError) {
      delete cache[filename];
      throw vmError;
    }
  });
}

// expose also these internal objects
asyncRequire.cache = cache;
asyncRequire.callbacks = callbacks;

module.exports = asyncRequire;
