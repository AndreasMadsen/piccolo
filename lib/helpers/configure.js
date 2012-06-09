
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

  'router': function (settings, value) {
    return settings.router = value;
  },

  'debug': function (settings, value) {
    return settings.debug = value;
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
    this.set('reload', 'auto');
  },

  'development': function () { },

  'production': function () { }
};

