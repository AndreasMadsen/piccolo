
var fs = require('fs');
var vm = require('vm');
var http = require('http');

// create a HTTP connect error
exports.httpError = function (code){
  var err = new Error(http.STATUS_CODES[code]);
      err.status = code;

  return err;
};

// an async require function
exports.require = (function () {

  var cache = {};
  var callbacks = {};

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
        var i = this.callback.length;
        while(i--) this.callback[i](exports);
      }
    };
  }

  // the exposed require function
  function require(filename, callback) {
    // module loaded: use cache
    if (cache[filename]) return callback(cache[filename]);

    // loading in progress: add callback to handler list
    var handler = callbacks[filename];
    if (handler) return handler.list.push(callback);

    // begin new module loading
    handler = callbacks[filename] = callbackHandler(filename);
    handler.list.push(callback);

    request(filename, function (content) {

      var wrapper = '(funcion (exports, require) {' +
                      content +
                    '});';

      try {
        // compile wrapper using VM
        var compiledWrapper = vm.runInThisContext(wrapper, filename);
            compiledWrapper.apply({}, [handler.done.bind(handler), require]);
      } catch (vmError) {
        delete cache[filename];
        throw vmError;
      }
    });
  }

  // expose also these internal objects
  require.cache = cache;
  require.callbacks = callbacks;

  return require;
})();
