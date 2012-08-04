
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
  startup.piccoloDomReady(piccolo);

  // Setup the router and link handler
  startup.piccoloRouter(piccolo); // Included dymnaicly from build/client.js
  startup.piccoloLinkHandler(piccolo);

  // expose piccolo object to global scope
  window.piccolo = piccolo;

  // all startup code has been executed, ready can now be emitted
  startup.piccoloStartupDone(piccolo);
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

startup.piccoloStartupEvents = function (piccolo) {
  // these are the states there must be completed
  var once = {
    "ready.dom": false,
    "ready.router": false,
    "ready.init": false,
    "ready": false
  };
  var expect = Object.keys(once);

  // remove from expect
  expect.forEach(function (eventname) {
    if (eventname === 'ready') return;

    piccolo.once(eventname, function () {
      once[eventname] = true;

      if (expect.length === 0) {
        once.ready = true;
        piccolo.emit('ready');
      }
    });
  });

  // continusely emmit once events
  piccolo.on('newListener', function (name, fn) {
    if (once.hasOwnProperty(name) && once[name]) {
      fn.call(this);
    }
  });
};

// Setup ready.dom emitter
startup.piccoloDomReady = function (piccolo) {
  document.addEventListener('DOMContentLoaded', function () {
    piccolo.emit('ready.dom');
  }, false);
};

// Setup ready.init emitter
startup.piccoloStartupDone = function () {
  piccolo.nextTick(function () {
    piccolo.emit('ready.init');
  });
};
