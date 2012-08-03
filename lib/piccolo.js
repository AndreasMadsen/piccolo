
var util = require('util');
var path = require('path');
var fs = require('graceful-fs');
var events = require('events');
var async = require('async');

var common = require('./common.js');
var configs = common.load('config.json');

var configure = common.load('helpers', 'configure');
var Request = common.load('core', 'request');

// load build system
var clientBuild = common.load('build', 'client');
var dependencies = common.load('build', 'dependencies');
var templates = common.load('build', 'templates');
var staticFile = common.load('build', 'static');
var directoryContent = common.load('build', 'read');
var compileModule = common.load('build', 'module');

function Piccolo() {

  // catches
  this.requireCache = {};
  this.preloaded = configs.natives.concat(['changeTable']);

  // settings objects
  this.configs = configure.configs;
  this.settings = {};

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

// Require module
Piccolo.prototype.require = function () {
  return this.emit('error', new Error('piccolo application is not build'));
};
Piccolo.prototype.require.presenter = function () {
  return this.emit('error', new Error('piccolo application is not build'));
};

// TODO: for now this setup the request constructor
// however it really should just build all the JS files
Piccolo.prototype.build = function () {
  var self = this;

  async.parallel({
    routerSource: function (callback) {
      fs.readFile(self.get('router'), 'utf8', function (error, content) {
        if (error) return callback(error, null);

        // Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
        // because the buffer-to-string conversion in `fs.readFile()`
        // translates it to FEFF, the UTF-16 BOM.
        if (content.charCodeAt(0) === 0xFEFF) {
          content = content.slice(1);
        }

        callback(null, content);
      });
    },

    // build directory maps
    staticFile: staticFile.bind(null, this),

    // build client core
    dependencies: dependencies.bind(null, this),
    templates: templates.bind(null, this),

    // pre read module source
    bindingSource: directoryContent.bind(null, common.find('bindings', null), '.server.js'),
    moduleSource: directoryContent.bind(null, common.find('modules', null), '.js')
  }, function (error, build) {
    if (error) return self.emit('error', error);

    // store build object
    self.build = build;

    // build client framework source
    clientBuild(self, function (error, clientSource) {
      if (error) return self.emit('error', error);

      // extend build object
      build.client = clientSource;

      // store router source code
      build.moduleSource.router = build.routerSource;

      // create Module constructor
      var Module = self.build.Module = compileModule(self);

      // create Main module
      var main = self.build.main = new Module('module.js');

      // setup require function
      function require() {
        return main.require.apply(main, arguments);
      }
      self.require = require;
      require.resolve = function(modulename) {
        return Module._resolveFilename(modulename, main);
      };

      // compile router module
      var router = main.require('router');
      self.build.router = new router();

      // emit ready event
      self.emit('ready');
    });
  });
};

// Will create and return a new request object
Piccolo.prototype.route = function (req, res) {
  return new Request(this, req, res);
};
