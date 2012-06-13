
var util = require('util');
var path = require('path');
var events = require('events');
var async = require('async');

var common = require('./common.js');
var configs = common.load('config.json');

var configure = common.load('helpers', 'configure');
var requires = common.load('modules', 'module.server');
var Request = common.load('core', 'request');

// load build system
var directory = common.load('build', 'directory');
var clientBuild = common.load('build', 'client');

function Piccolo() {

  // catches
  this.requireCache = {};
  this.preloaded = configs.natives.concat(['changeTable']);

  // settings objects
  this.configs = configure.configs;
  this.settings = {};

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
    filename = path.join(this.get('modules'), './' + filename);
  }

  // Use the documented staticRequire method
  requires.requireModule(this, filename, callback);
};

// TODO: for now this setup the request constructor
// however it really should just build all the JS files
Piccolo.prototype.build = function () {
  var self = this;

  async.parallel({
    // compile router module
    router: function (callback) {
      self.require('router', function (error, module) {
        if (error) return callback(error, null);
        callback(null, new module());
      });
    },

    // build directory maps
    modules: directory.bind(null, this.get('modules')),
    staticFile: directory.bind(null, this.get('static')),
    presenter: directory.bind(null, this.get('presenter')),

    // build client core
    client: clientBuild.bind(null)
  }, function (error, build) {
    if (error) return self.emit('error', error);

    // store build object and emit ready
    self.build = build;
    self.emit('ready');
  });
};

// Will create and return a new request object
Piccolo.prototype.route = function (req, res) {
  return new Request(this, req, res);
};
