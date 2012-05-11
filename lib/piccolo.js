
var util = require('util');
var http = require('http');
var path = require('path');
var events = require('events');

var common = require('./common.js');
var utils = common.load('utils');
var configs = common.load('config.json');

var configure = common.load('helpers', 'configure');
var attach = common.load('core', 'attach');
var handler = common.load('core', 'handler');
var requires = common.load('core', 'require');

function Piccolo() {
  this.configs = configure.configs;
  this.settings = {};

  // Emit ready event once all async startups has completed
  this.progres = new utils.ProgressTracker(this.emit.bind(this, 'ready'));
  this.progres.add(['structure', 'route']);

  // List all servers
  this.query = [];
  this.servers = [];

  // Will contain the main router
  this.router = null;

  // Preconfigure settings
  utils.each(configs.settings, this, function (value, index) {
    this.set(index, value);
  });
  this.set('root', module.parent.filename);
}
util.inherits(Piccolo, events.EventEmitter);

module.exports = function () { return new Piccolo(); };

Piccolo.prototype.configure = function (condition, method) {

  condition = typeof condition === 'string' ? condition : 'default';
  method = condition === 'default' ? condition : method;

  // Save condition configureation until use is executed
  this.configs[condition] = method;
};

Piccolo.prototype.use = function (condition) {

  // Execute the default method
  var defaults = this.configs['default'];
  if (defaults) defaults();

  // Execute conditional method
  var method = this.configs[condition];
  if (method) {
    method();
  } else {
    this.emit('error', new Error('The configure condition ' + condition + ' do not exist'));
  }

  // Remove configureations
  this.configs = {};

  // Load router
  attach.setupRouter(this, this.settings.router);
};

Piccolo.prototype.set = function (property, value) {
  // Do not allow set, when an server is applyed to the framework
  if (this.servers.length) {
    this.emit('error', new Error('can not set setting after an server is attached'));
    return;
  }

  // Update settings property by executeing function
  return configure.update[property].call(this, this.settings, value);
};

Piccolo.prototype.get = function (property) {
  // Get settings property
  return this.settings[property];
};

// Require async module
Piccolo.prototype.require = function (filename /* notStatic, callback */) {
  var callback = arguments[arguments.length - 1];

  // Check filename argument
  if (typeof filename !== 'string') {
    throw new Error('No filename was given');
  }

  // Check callback argument
  if (typeof callback !== 'function') {
    throw new Error('No filename was given');
  }

  // check if the request is the router module
  if (filename === 'router') {
    callback(null, this.router);
    return;
  }

  // If three arguments was given use the don't parse the filename
  if (arguments.length !== 3 && this.preloaded.indexOf(filename) === -1) {
    filename = path.join(this.directories.statics, './' + filename);
  }

  // Use the documented staticRequire method
  requires.requireModule(this, filename, callback);
};

// Attach a handler to a server instance
Piccolo.prototype.listen = function (server) {
  var self = this;

  // Standart port number
  if (typeof server === 'number') {
    server = http.createServer().listen(arguments[0], arguments[1]);
  }

  // Attach the server
  if (this.router) {
    this.servers.push(server);
    server.on('request', self.handlers);
    return;
  }

  // First attach create route load handler
  if (this.routeLoader === undefined) {
    this.routeLoader = new utils.mutiplyLoader(function (error, router) {
      // Cleanup
      delete self.routeLoader;

      // Stop in case of an error
      if (error) {
        self.emit('error', error);
        return;
      }

      // Save router module
      self.router = router;

      // Setup handler
      self.handler = handler.setup(self);
    });

    // Require route module
    this.require(this.modules.router, true, function (error, router) {
      self.routeLoader.done(error, router);
    });
  }

  if (this.router === null) {
    this.routeLoader.push(function (error) {
      if (error) return;

      // Attach handler to server
      self.servers.push(server);
      server.on('request', self.handler);
    });
  }
};
