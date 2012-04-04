
  window.piccolo = (function (piccoloPrototype) {
    function piccolo() {}

    // setup piccolo to inherit EventEmitter methods
    NativeModule.util.inherits(piccolo, NativeModule.events.EventEmitter);

    // merge piccoloPrototype intro piccolo prototype
    for (var method in piccoloPrototype) {
      if (piccoloPrototype.hasOwnProperty(method)) {
        piccolo.prototype[method] = piccoloPrototype[method];
      }
    }

    // create instance
    return new piccolo();
  })(piccolo);

})(this, document);
