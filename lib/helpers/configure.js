
var path = require('path');

var common = require('../common.js');
var configs = common.load('config.json');

exports.update = {
  'reload': function (settings, value) {
    if (value === 'auto' || value === 'none') {
      return settings.reload = value;
    }

    this.emit('error', new Error('the reload value ' + value + ' is not allowed'));
  },

  'cache': function (settings, value) {
    if (typeof value === 'number' || value === 'none') {
      return settings.cache = value;
    }

    this.emit('error', new Error('the catch value should be a number or none'));
  },

  'precompile': function (settings, value) {
    if (typeof value === 'boolean') {
      return settings.precompile = value;
    }

    this.emit('error', new Error('the precompile value must be a boolean'));
  },

  'compress': function (settings, value) {
    if (typeof value === 'boolean') {
      return settings.compress = value;
    }

    this.emit('error', new Error('the compress value must be a boolean'));
  },

  'router': function (settings, value) {
    return settings.router = value;
  },

  'debug': function (settings, value) {
    if (typeof value === 'boolean') {
      return settings.debug = value;
    }

    this.emit('error', new Error('the debug value must be a boolean'));
  },

  'root': function (settings, value) {
    var self = this;

    if (typeof value !== 'string') {
      this.emit('error', new Error('the root directory must be a string'));
    }

    // Set root directory
    settings.root = path.resolve(value);

    // set all subdirectories
    configs.directories.forEach(function (name) {
      exports.update[name].call(self, settings, './' + name);
    });

    return settings.root;
  }
};

// Allow user to set specific subdirectories
configs.directories.forEach(function (name) {

  // Set subdirectory
  exports.update[name] = function (settings, value) {
    return settings[name] = path.resolve(settings.root, value);
  };
});

exports.configs = {
  'default': function () {
    this.set('cache', 'none');
    this.set('reload', 'none');
    this.set('debug', false);
    this.set('precompile', false);
  },

  'development': function () {
    this.set('reload', 'auto');
    this.set('debug', true);
  },

  'production': function () {
    this.set('precompile', true);
  }
};

