
// Create a piccolo namespace object there inherits from the EventEmitter
var piccolo = window.piccolo = (function () {
  function piccolo() {
    // Apply event emitter constructor
    NativeModule.events.EventEmitter.call(this);
  }
  NativeModule.util.inherits(piccolo, NativeModule.events.EventEmitter);

  // Expose module API
  piccolo.prototype.NativeModule = NativeModule;
  piccolo.prototype.require = NativeModule.module.require;

  // Create object
  return new piccolo();
})();

// Will contain the router
piccolo.router = null;

(function () {

  // The following events will only emit once
  var emitOnce = {
    'init': false,
    'ready': false
  };

  // Will be called in the bottom of this script
  piccolo.init = function () {

    // Save and create route module
    piccolo.router = new NativeModule.router();

    // Emit init event
    piccolo.nextTick(function () {
      piccolo.emit('init');

      // Wait for DOM ready event
      onDomReady(function () {
        piccolo.emit('ready');
      });
    });
  };

  // Set emitOnce flag once the event emits
  for (var eventName in emitOnce) (function (eventName) {
    piccolo.once(eventName, function () {
      emitOnce[eventName] = true;
    });
  })(eventName);

  // Execute listener functions if it has allready been emitted
  piccolo.on('newListener', function (name, listener) {
    if (emitOnce[name]) listener();
  });

  // Execute callback when the DOM tree is ready
  var isReady = false;
  var domCallback;
  function onDomReady(callback) {
    // Execute callback if the DOM tree already is loaded
    if (isReady) return callback();

    // This function is only going to be executed once
    domCallback = callback;
  }

  // Listen on DOM ready
  document.addEventListener('DOMContentLoaded', function () {
    // Set DOM ready flag
    isReady = true;

    // Execute DOM ready callback
    if (domCallback) domCallback();
  }, false);

})();
