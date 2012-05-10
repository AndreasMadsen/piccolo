
var util = require('util');
var http = require('http');
var events = require('events');
var common = require('./common.js');
var utils = common.load('utils');
var configure = common.load('helpers', 'configure');

function Piccolo() {
  this.configs = configure.configs;
  this.settings = {};

  // Emit ready event once all async startups has completed
  this.progres = new utils.ProgressTracker(this.emit.bind(this, 'ready'));
  this.progres.add(['compile', 'route']);
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
  configure.setupRouter(this, this.settings.router);
};

Piccolo.prototype.set = function (property, value) {
  // Update settings property by executeing function
  configure.update[property](this, value);
};

Piccolo.listen = function (server) {

  // standart port number
  if (typeof server === 'number') {
    server = http.createServer().listen(arguments[0], arguments[1]);
  }

  // attach route to server
  configure.setupServer(this, server);
};
