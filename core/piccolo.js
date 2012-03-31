
var util = require('util');
var events = require('events');
var path = require('path');

var common = require('./common.js');

function Piccolo() {
  
  // Setup default modules
  this.modules = {
    'route': common.defaults('route')
  };
  
  // Setup a directories map
  var project = path.dirname(module.parent.filename);
  this.directories = {
    'project': project,
    'static': path.join(project, 'static')
  };
  
  // Contain listen information
  this.address = null;
}
util.inherits(Piccolo, events.EventEmitter);

module.exports = function () { return new Piccolo(); };

// Allow developers to use there own submodules
// Note this is a sync function
Piccolo.prototype.overwrite = function (part, filepath) {
  
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
  if (common.existsSync(filepath) === false) {
    throw new Error('The filepath ' + filepath + ' do not exist');
  }
  
  // overwrite default submodule
  this.modules[part] = filepath;
};

// Allow developers to use there own directory structur
Piccolo.prototype.directory = function (what, dirpath) {
  
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
  
  if (common.existsSync(dirpath) === false) {
    throw new Error('The path ' + dirpath + ' do not exist');
  }
  
  this.directories[what] = dirpath;
};

// Listen to a port or path
Piccolo.prototype.listen = function (port, host) {
  
  // check arguments
  if (arguments.length === 0) {
    throw new TypeError('No arguments was given');
  }
  
  // Check port type
  var portType = typeof port;
  if (portType !== 'string' && portType !== 'number') {
    throw new TypeError('first argument must be a filepath or a port number');
  }
  
  // A path was used
  if (portType === 'string') {
    
    // set address with path
    this.address = { 'path': host };
    return;
  }
  
  // Default host argument to 0.0.0.0
  if (host === undefined) {
    host = '0.0.0.0';  
  }
  
  // Check that host is a string
  else if (typeof host !== 'string') {
    throw new TypeError('host must be a string'); 
  }
  
  // set address with port and host
  this.address = {
    'port': port,
    'host': host
  };
};
