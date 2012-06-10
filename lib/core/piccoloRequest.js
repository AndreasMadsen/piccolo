
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
  var file = this.piccolo.build.client.read();
  this.send(file);
};

// send client the requested module and its dependencies
requestHandlers['modules'] = function () {
  // TODO: will be done in 0.4.0
};

// send client the requested presenter
requestHandlers['presenter'] = function () {

  // check path given in url query
  var filepath = this.url.query.path;
  if (filepath === undefined) {
    return deniedAcess(this);
  }

  // security: parse path independent
  filepath = path.resolve(this.piccolo.get('presenter'), url.parse(filepath).path);

  // check that presenter exist
  if (this.piccolo.build.presenter.exist(filepath) === false) {
    return deniedAcess(this);
  }

  var file = this.piccolo.build.presenter.read(filepath);
  this.send(file);
};
