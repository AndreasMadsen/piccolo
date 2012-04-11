
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
