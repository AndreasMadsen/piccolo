
function startup() {

  var primitive = { build: build };

  // Setup the module API seperatly
  var Module = startup.piccoloSetupModule(primitive);
  var main = new Module('module.js');

  // create an piccolo object there inherits from EventEmitter
  var piccolo = startup.piccoloCreate(main);

  // get current template
  startup.piccoloCurrentTemplate(piccolo);

  // combine the module API with piccolo object in an .require method
  startup.piccoloSetupRequire(piccolo, main);

  // Setup piccolo event loop handlers
  startup.piccoloNextTick(piccolo);
  startup.piccoloStartupEvents(piccolo);

  // Setup the router and link handler
  startup.piccoloRouter(piccolo);
  startup.piccoloLinkHandler(piccolo);

  // expose piccolo object to global scope
  window.piccolo = piccolo;
}

startup.piccoloCreate = function (Module) {
  var EventEmitter = Module.require('events').EventEmitter;

  function piccolo() {
    // Apply event emitter constructor
    EventEmitter.call(this);

    // store internal stuff here
    this.build = build;
  }
  Module.require('util').inherits(piccolo, EventEmitter);

  // Create object
  return new piccolo();
};

startup.piccoloCurrentTemplate = function (piccolo) {
  // Use not yet standart method to get the current script
  var script = document.currentScript;

  // go through each scripts
  if (!script) {
    var list = document.getElementsByTagName('script');
    var i = list.length;

    while (i--) {
      if (list[i].getAttribute('src') === '/piccolo/framework.js') {
        script = list[i];
        break;
      }
    }
  }

  // get current template path
  piccolo.build.currentTemplate = script.getAttribute('data-template');
};

// setup require function
startup.piccoloSetupRequire = function (piccolo, main) {
  piccolo.require = main.require.bind(main);
};

startup.piccoloRouter = function (piccolo) {
  var Router = piccolo.require('router');
  piccolo.router = new Router();
};

(function () {
  // Listen to onDomReady
  var isReady = false;
  var domCallback;

  // Listen on DOM ready
  document.addEventListener('DOMContentLoaded', function () {
    // Set DOM ready flag
    isReady = true;

    // Execute DOM ready callback
    if (domCallback) domCallback();
  }, false);

  function onDomReady(callback) {
    // Execute callback if the DOM tree already is loaded
    if (isReady) return callback();

    // This function is only going to be executed once
    domCallback = callback;
  }

  startup.piccoloStartupEvents = function (piccolo) {
    var once = [];

    piccolo.nextTick(function () {
      once.push('init');
      piccolo.emit('init');

      onDomReady(function () {
        once.push('ready');
        piccolo.emit('ready');
      });
    });

    // setup a continusely emitter on init and ready event to prevent race conditions
    piccolo.on('newListener', function (name, cb) {
      if (once.indexOf(name) !== -1) {
        piccolo.removeListener(name, cb);
        cb.apply(this);
      }
    });
  };
})();
