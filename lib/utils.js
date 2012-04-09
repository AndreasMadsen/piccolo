
var fs = require('fs');
var path = require('path');
var http = require('http');

// Compatibility with node 0.7
exports.exists = fs.exists || path.exists;
exports.existsSync = fs.existsSync || path.existsSync;

// create a HTTP connect error
exports.httpError = function (code){
  var err = new Error(http.STATUS_CODES[code]);
      err.status = code;

  return err;
};

// Extremely simple progress tracker
function ProgressTracker(callback) {
  this.list = [];
  this.callback = callback;
}
exports.ProgressTracker = ProgressTracker;

ProgressTracker.prototype.add = function (list) {
  if (!Array.isArray(list)) list = [list];
  this.list = this.list.concat(list);
};
ProgressTracker.prototype.set = function(name) {
  this.list.splice(this.list.indexOf(name), 1);
  this.check();
};
ProgressTracker.prototype.check = function() {
  if (this.list.length === 0) this.callback();
};

// Allow simultaneously async loading
function mutiplyLoader() {
  if (arguments.length === 2) {
    this.args = arguments[0];
    this.handler = arguments[1];
  } else {
    this.handler = arguments[0];
  }

  this.list = [];
}
exports.mutiplyLoader = mutiplyLoader;

mutiplyLoader.prototype.done = function (error, result) {

  // Execute middle handler
  this.handler.call(this, error, result);

  // execute all callbacks in the list
  var i = this.list.length;
  while(i--) this.list[i](error, result);
};
mutiplyLoader.prototype.push = function (callback) {
  this.list.push(callback);
};
