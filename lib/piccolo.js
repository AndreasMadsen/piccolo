
var util = require('util');
var http = require('http');
var path = require('path');
var events = require('events');

var common = require('./common.js');
var utils = common.load('utils');
var configs = common.load('config.json');

var configure = common.load('helpers', 'configure');
var handler = common.load('core', 'handler');
var requires = common.load('core', 'require');

function Piccolo() {

  // catches
  this.requireCache = {};
  this.preloaded = configs.natives.concat(['changeTable']);

  // settings objects
  this.configs = configure.configs;
  this.settings = {};

  // Emit ready event once all async startups has completed
  this.progress = new utils.ProgressTracker(this.emit.bind(this, 'ready'));
  this.progress.add(['structure', 'route']);

  // List all servers
  this.query = [];
  this.servers = [];

  // Will contain the main router
  this.router = null;

  // Preconfigure settings
  this.set('router', common.find('defaults', 'router'));
  this.set('root', path.dirname(module.parent.filename));
}
util.inherits(Piccolo, events.EventEmitter);

module.exports = function () { return new Piccolo(); };

Piccolo.prototype.configure = function (condition, method) {

  method = typeof condition === 'function' ? condition : method;
  condition = typeof condition === 'string' ? condition : 'default';

  // Save condition configureation until use is executed
  this.configs[condition] = method;
};

Piccolo.prototype.use = function (condition) {

  // Execute the default method
  this.configs['default'].call(this);

  // Execute conditional method
  var method = this.configs[condition];
  if (method) {
    method.call(this);
  } else {
    this.emit('error', new Error('The configure condition ' + condition + ' do not exist'));
  }

  // Remove configureations
  this.configs = {};
};

Piccolo.prototype.set = function (property, value) {
  // Do not allow set, when an server is applyed to the framework
  if (this.servers.length) {
    this.emit('error', new Error('can not set setting after an server is attached'));
    return;
  }

  if (configure.update[property] === undefined) {
    this.emit('error', new Error('the ' + property + ' setting do not exist'));
  }

  // Update settings property by executeing function
  return configure.update[property].call(this, this.settings, value);
};

Piccolo.prototype.get = function (property) {
  if (configure.update[property] === undefined) {
    this.emit('error', new Error('the ' + property + ' setting do not exist'));
  }

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
    throw new Error('No callback was given');
  }

  // check if the request is the router module
  if (filename === 'router') {
    filename = this.settings.router;
  }

  // If three arguments was given, then don't parse the filename relative to static
  else if (arguments.length !== 3 && this.preloaded.indexOf(filename) === -1) {
    filename = path.join(this.get('static'), './' + filename);
  }

  // Use the documented staticRequire method
  requires.requireModule(this, filename, callback);
};

// setup request constructor
Piccolo.prototype.setup = function () {
  var self = this;

  this.require('router', function (error, module) {
    if (error) return self.emit('error', error);

    self.router = module;
    self.Request = handler.setup(self);
  });
};

// will be overwriten
Piccolo.prototype.route = function (req, res) {
  if (this.Request === undefined) {
    var emitter = new events.EventEmitter();

    process.nextTick(function () {
      emitter.emit('error', new Error('piccolo object not ready'));
    });

    return emitter;
  }

  return new this.Request(req, res);
};
