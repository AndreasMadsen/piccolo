
var util = require('util');
var events = require('events');
var path = require('path');

var common = require('./common.js');
var utils = common.utils;
var handler = common.getCore('handler');
var requires = common.getCore('require');

function Piccolo() {

  // Setup default modules
  this.modules = {
    'router': common.defaults('router')
  };

  // Setup a directories map
  var map = this.directories = {};
      map.project = path.dirname(module.parent.filename);
      map.statics = path.join(map.project, 'static');
      map.presenter = path.join(map.project, 'presenter');
      map.template = path.join(map.project, 'template');

  // Default settings
  this.settings = {
    maxAge: 0
  };

  // create progress tracker
  this.progress = new utils.ProgressTracker(this.emit.bind(this, 'ready'));
  this.progress.add(['structure', 'route']);

  // Contain listen information
  this.address = null;

  // Store connect handler
  this.handler = null;

  // First attach (configureable)
  this.attached = false;

  // The require objects are cache here
  this.requireCache = {};
}
util.inherits(Piccolo, events.EventEmitter);

module.exports = function () { return new Piccolo(); };

// Allow developers to use there own submodules
// Note this is a sync function
Piccolo.prototype.overwrite = function (part, filepath) {

  // Check that no servers are attached
  if (this.attached) {
    throw new Error('A server has already been attach');
  }

  // Check arguments
  if (arguments.length === 0) {
    throw new TypeError('No arguments was given');
  }

  // Check that the part name is valid
  if (this.modules[part] === undefined) {
    throw new TypeError('The ' + part + ' is not a valid module');
  }

  // Check the filepath argument
  if (typeof filepath !== 'string') {
    throw new TypeError('The filepath must be a string');
  }

  filepath = path.resolve(this.directories.project, filepath);
  if (utils.existsSync(filepath) === false) {
    throw new Error('The filepath ' + filepath + ' do not exist');
  }

  // overwrite default submodule
  this.modules[part] = filepath;
};

// Allow developers to use there own directory structur
Piccolo.prototype.directory = function (what, dirpath) {

  // Check that no servers are attached
  if (this.attached) {
    throw new Error('A server has already been attach');
  }

  // Check arguments
  if (arguments.length === 0) {
    throw new TypeError('No arguments was given');
  }

  // Check that the part name is valid
  if (this.modules[what] === undefined) {
    throw new TypeError('The ' + what + ' is not a key directory');
  }

  // Check the filepath argument
  if (typeof dirpath !== 'string') {
    throw new TypeError('The filepath must be a string');
  }

  // in case it is the project directory there is being set
  // do not atempt to resolve the path
  if (what !== 'project') {
    dirpath = path.resolve(this.directories.project, dirpath);
  }

  if (utils.existsSync(dirpath) === false) {
    throw new Error('The path ' + dirpath + ' do not exist');
  }

  // Overwrite default directory
  this.directories[what] = dirpath;
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

  var ignore = common.natives.concat(['route', 'changeTable']);

  // If three arguments was given use the don't parse the filename
  if (arguments.length !== 3 && ignore.indexOf(filename) === -1) {
    filename = path.join(this.directories.statics, './' + filename);
  }

  // Use the documented staticRequire method
  requires.requireModule(this, filename, callback);
};

// Attach a handler to a server instance
Piccolo.prototype.attach = function (server) {

  // Check server arguments
  if (typeof server !== 'object' || server === null) {
    throw new TypeError('A server object must be given');
  }

  // Is this the first attached
  if (this.attached === false) {
    this.attached = true;

    // TODO: refactor this
    requires.setupRequire(this);

    // Create handle for first time
    this.handlers = handler.setup(this);
  }

  // Attach handler to server
  server.on('request', this.handlers);
};
