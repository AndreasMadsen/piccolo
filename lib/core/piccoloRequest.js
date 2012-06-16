
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
// TODO: this will be rewriten in 0.4.0
requestHandlers['modules'] = function () {
  if (this.allowMethod(['GET', 'HEAD'])) return;

  // check path given in url query
  var modulename = this.url.query.name;
  if (modulename === undefined) {
    return deniedAcess(this);
  }
  var cache = this.url.query.ignore;
  if (cache === undefined || cache === '') {
    cache = [];
  } else {
    cache = JSON.parse(cache);
  }

  var file = this.piccolo.build.modules.read(modulename, cache);
  this.send(file);
};

// send client the requested presenter
requestHandlers['presenter'] = function () {
  if (this.allowMethod(['GET', 'HEAD'])) return;

  // check path given in url query
  var query = this.url.query.path;
  if (query === undefined) {
    return deniedAcess(this);
  }

  // security: parse path independent
  query = url.parse(query).path;

  // route query though router to get relative filepath
  var filepath = this.piccolo.build.router.parse(query).path;

  // security: parse path independent
  filepath = path.resolve(this.piccolo.get('presenter'), './' + filepath);

  // check that presenter exist
  if (this.piccolo.build.presenter.exist(filepath) === false) {
    return deniedAcess(this);
  }

  var file = this.piccolo.build.presenter.read(filepath);
  this.send(file);
};
