
  // setup piccolo to inherit EventEmitter methods
  NativeModule.util.inherits(piccolo, NativeModule.events.EventEmitter);

  window.piccolo = new piccolo();

})(this, document);
