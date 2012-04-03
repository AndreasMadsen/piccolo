
var fs = require('fs');
var path = require('path');
var http = require('http');

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

// Compatibility with node 0.7
exports.exists = fs.exists || path.exists;
exports.existsSync = fs.existsSync || path.existsSync;
