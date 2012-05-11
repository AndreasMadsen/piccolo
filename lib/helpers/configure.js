
var path = require('path');

var common = require('./common.js');
var configs = common.load('config.json');

exports.update = {
  'reload': function (settings, value) {
    if (value === 'auto' || value === 'none') {
      return settings.reload = value;
    }

    this.emit('error', new Error('the reload value ' + value + ' is not allowed'));
  },

  'catch': function (settings, value) {
    if (typeof value === 'number') {
      return settings['catch'] = value;
    }

    this.emit('error', new Error('the catch value should be a number'));
  },

  'root': function (settings, value) {
    var self = this;

    if (typeof value !== 'string') {
      this.emit('error', new Error('the root directory must be a string'));
    }

    // Set root directory
    settings.root = path.normalize(value);

    // set all subdirectories
    configs.directories.forEach(function (name) {
      exports.update[name].call(self, settings, './' + name);
    });
  }
};

// Allow user to set specific subdirectories
configs.directories.forEach(function (name) {

  // Set subdirectory
  exports.update[name] = function (settings, value) {
    settings[name] = path.resolve(settings.root, value);
  };
});
