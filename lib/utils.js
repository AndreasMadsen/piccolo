
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
exports.require = (function (callback) {
  var cache = {};

  return function (filename) {

    // search in cache for module
    var cachedModule = cache[filename];
    if (cachedModule) {
      callback(cachedModule);
    }

    // create module
    fs.readFile(filename, 'utf8', function (err, content) {
      if (err) throw err;

      // Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
      // because the buffer-to-string conversion in `fs.readFile()`
      // translates it to FEFF, the UTF-16 BOM.
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
      }

      // when the content has been executed this object will be filled
      var exports = cache[filename] = {};

      // create functional wrapper there will create an empty scope for the module
      var wrapper = '(function (exports) { var global = undefined; ' + content + '\n});';

      try {
        // compile wrapper using VM
        var compiledWrapper = vm.runInThisContext(wrapper, filename);
            compiledWrapper.apply({}, [exports]);
      } catch (vmError) {
        delete cache[filename];
        throw vmError;
      }

      // reply exports result
      callback(exports);
    });
  };
})();
