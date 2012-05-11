
var util = require('util');
var http = require('http');
var events = require('events');

var common = require('./common.js');
var utils = common.load('utils');
var configure = common.load('helpers', 'configure');
var attach = common.load('core', 'attach');
var configs = common.load('config.json');

function Piccolo() {
  this.configs = configure.configs;
  this.settings = {};

  // Emit ready event once all async startups has completed
  this.progres = new utils.ProgressTracker(this.emit.bind(this, 'ready'));
  this.progres.add(['compile', 'route']);

  // List all servers
  this.servers = [];

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
  return configure[property].call(this, this.settings, value);
};

Piccolo.prototype.get = function (property) {
  // Get settings property
  return this.settings[property];
};

Piccolo.listen = function (server) {

  // standart port number
  if (typeof server === 'number') {
    server = http.createServer().listen(arguments[0], arguments[1]);
  }

  // Add server to list
  this.servers.push(server);

  // attach route to server
  attach.setupServer(this, server);
};
