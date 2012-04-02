;(function (window, document, undefined) {

  var piccolo = window.piccolo = {};

  piccolo.require = (function () {

    var cache = {};
    var callbacks = {};
    var head = document.getElementsByTagName('head')[0];
    var path = "window.piccolo.require";

    function request(url, callback) {
      var requester;

      // create HTTP request object
      requester = new XMLHttpRequest();
      requester.open("GET", url, false);

      // call callback when all the content is rescived
      requester.onreadystatechange = function () {
        if (request.readyState !== 4) return;
        callback(request.responseText);
      };

      requester.send(null);
    }

    function callbackHandler(script, filename) {
      return {
        list: [],
        done: function (exports) {
          // save exports in cache
          cache[filename] = exports;

          // cleanup by deleteing callbackHandler and script tag reference
          delete callbacks[filename];
          head.removeChild(script);

          // execute all callbacks in the list
          var i = this.callback.length;
          while(i--) this.callback[i](exports);
        }
      };
    }

    // the exposed piccolo.require function
    function require(filename, callback) {
      // module loaded: use cache
      if (cache[filename]) return callback(cache[filename]);

      // loading in progress: add callback to handler list
      var handler = callbacks[filename];
      if (handler) return handler.list.push(callback);

      // create script tag where content will be evaluated
      var script = document.createElement('script');

      // begin new module loading
      handler = callbacks[filename] = callbackHandler(script, filename);
      handler.list.push(callback);

      request(filename, function (content) {

        script.appendChild(document.createTextNode(
          ';(funcion (exports, require) {' +
            content +
          '})(' + path + '.callbacks["' + filename + '"].done , ' + path + ');'));

        head.appendChild(script);
      });
    }

    // expose also these internal objects
    require.cache = cache;
    require.callbacks = callbacks;

    return require;
  })();

})(this, document);