
var path = require('path');
var url = require('url');

var common = require('../common.js');
var utils = common.load('utils');

function deniedAcess(self) {
  self.emit('error', utils.httpError(400, new Error('Framework acess denied')) );
}

module.exports = function handle_piccoloRequest() {
  // get request handler
  var handler = requestHandlers[this.path[1]];

  // no handler, send 404 error to client
  if (handler === undefined) {
    return deniedAcess(this);
  }

  // execute handler and send file to client
  handler.call(this);
};

// create request handlers map
var requestHandlers = {};

// send client the core framework file
requestHandlers['framework.js'] = function () {
  if (this.allowMethod(['GET', 'HEAD'])) return;

  var file = this.piccolo.build.client.read();
  this.send(file);
};

// send client the requested module and its dependencies
requestHandlers['require'] = function () {
  if (this.allowMethod(['GET', 'HEAD'])) return;

  // check path given in url query
  var modulename = this.url.query.name;
  if (typeof modulename !== 'string') {
    return deniedAcess(this);
  }

  var cache = this.url.query.cache;
  if (cache === undefined || cache === '') {
    cache = undefined;
  } else {
    cache = JSON.parse(cache);
  }

  var file = this.piccolo.build.dependencies.readClient(modulename, cache);
  this.send(file);
};

// send static file
requestHandlers['static'] = function () {
  if (this.allowMethod(['GET', 'HEAD'])) return;

  // send static file
  var filepath = path.resolve('/', this.url.query.path);
  var file = this.piccolo.build.staticFile.readClient(filepath);
  this.send(file);
};
