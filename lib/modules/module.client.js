piccolo.require = (function () {

  var callbacks = {},
      head = document.getElementsByTagName('head')[0],
      requirePath = "window.piccolo.require",
      callbackPath = "window.piccolo.requireCallbacks";

  // Create module cache
  var requireCache = piccolo.requireCache = {};
  var requireCallbacks = piccolo.requireCallbacks = {};

  // Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
  // because the buffer-to-string conversion in `fs.readFile()`
  // translates it to FEFF, the UTF-16 BOM.
  function removeBOM(content) {
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }
    return content;
  }

  // Compile an async module
  function compileAsyncModule(filename, callback) {
    // create HTTP request object
    var requester = new XMLHttpRequest();
    requester.open("GET", filename, true);

    // call callback when all the content is rescived
    requester.onreadystatechange = function () {
      if (requester.readyState !== 4) return;

      if (requester.status !== 200 && requester.status !== 304) {
        var error = new Error('Could not request module ' + filename + ', got status code: ' +
                              requester.status + ' ' + requester.statusText);
        return callback(error, null);
      }

      // Do only execute callback once
      var called = false;

      // Create a exports function there execute the callback
      var exports = function (exports) {
        if (called) return;
        called = true;

        // Detect if exports is an error
        var isError = (exports instanceof Error);

        callback(isError ? exports : null, isError ? null : exports);
      };

      // store callback in global scope
      requireCallbacks[filename] = exports;

      // create script tag where content will be evaluated
      var script = document.createElement('script');

      // Create a functional wrapper
      var wrapper = ';(function (exports, require) {' +
                      removeBOM(requester.responseText) +
                    '})(' + callbackPath + '["' + filename + '"], ' + requirePath + ');';

      try {
        script.appendChild(document.createTextNode(wrapper));
        head.appendChild(script);
      } catch (vmError) {
        if (called) return piccolo.emit('error', vmError);
        called = true;
        callback(vmError, null);
      }
    };

    requester.send(null);
  }

  // In order to support multiply requests of the same module
  // there don't exist in the cache.
  function callbackHandler(filename) {
    return new mutiplyLoader(function (error, exports) {
        // cleanup by deleteing callbackHandler and script tag reference
        delete callbacks[filename];

        // relay errors to piccolo object
        if (error) return piccolo.emit('error', error);

        // save module exports in cache
        requireCache[filename] = exports;
    });
  }

  // the exposed piccolo.require function
  function require(filename, callback) {

    if (!callback) return piccolo.emit('error', new Error("missing callback in require"));

    // Return native module object
    if (NativeModule[filename]) {
      callback(null, NativeModule[filename]);
      return;
    }

    // resolve the filename
    filename = NativeModule.url.format(NativeModule.url.resolve(window.location, filename));

    // Check if the module is stored in cache
    if (requireCache[filename]) {
      callback(null, requireCache[filename]);
      return;
    }

    // If load is on progress add callback to handler list
    var handler = callbacks[filename];
    if (handler) {
      handler.list.push(callback);
      return;
    }

    // Create a new module load handler
    handler = callbacks[filename] = callbackHandler(filename);
    handler.push(callback);

    // Get an async module
    compileAsyncModule(filename, function (error, exports) {
      if (error) {
        piccolo.emit('error', error);
        handler.done(error, null);
        return;
      }

      handler.done(null, exports);
    });
  }

  return require;
})();
