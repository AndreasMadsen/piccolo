
var url = require('url');
var util = require('util');
var path = require('path');
var events = require('events');
var zlib = require('zlib');
var domain = require('domain');

var common = require('../common.js');
var utils = common.load('utils');
var piccoloRequest = common.load('core', 'piccoloRequest');
var changeTable = common.load('core', 'changeTable');
var staticFile = common.load('core', 'staticFile');

// Define compression types
var compressors = {
  gzip: zlib.createGzip,
  deflate: zlib.createDeflate
};

// TODO: call this file request and export an EventEmitter there emits errors
// and remove connect.
// Export an .destroy() there will stop and cleanup.
// Each /core file should be a route subroutine
function Request(piccolo, request, response) {
  // domains support
  events.EventEmitter.call(this);

  // create domain and attach request and response
  this.domain = domain.create();
  this.domain.add(request);
  this.domain.add(response);

  // any domain error will be relayed to the request object itself
  // also any precheck errors should emitted on the request object
  this.domain.on('error', this.emit.bind(this, 'error'));

  // strore parent and http streams
  this.piccolo = piccolo;
  this.request = request;
  this.response = response;

  // cache object
  this.cache = {};

  // execute this in request domain
  this.domain.run((function () {

    // attach default error handler
    this.on('error', function (error) {
      // store error for later use
      this.error = error;

      // if no error event handler is attached
      if (this.listeners('error').length === 1) {
        console.error(error.stack);

        // execute default handler
        this.handleError();
      }
    });

    // parse request url
    this.url = url.parse(request.url, true, false);
    this.path = this.url.pathname.split('/');

    // Do not allow null byte
    if (this.request.url.indexOf('\0') !== -1) {
      this.emit('error', utils.httpError(400));
    }

    // direct piccolo request
    else if (this.matchPiccoloRequest()) {
      this.handlePiccoloRequest();
    }

    // change table request
    else if (this.matchChangeTable()) {
      this.handleChangeTable();
    }

    // static file request
    else if (this.matchStaticFile()) {
      this.handleStaticFile();
    }

    // emit 404 error, will be handled by developer or default error handler
    else {
      this.emit('error', utils.httpError(404));
    }
  }).bind(this));
}
module.exports = Request;
util.inherits(Request, events.EventEmitter);

// execute function (fn) in domain wrapper
// use it only on public functions
function wrap(fn) {
  return function () {
    this.domain.run(fn.bind(this));
  };
}

// is the url is a direct piccolo request
Request.prototype.matchPiccoloRequest = function () {
  return this.path[0] === 'piccolo';
};

// handle direct piccolo requests
Request.prototype.handlePiccoloRequest = piccoloRequest;

// is the url a server side change table request
Request.prototype.matchChangeTable = function () {
  var filepath = this.piccolo.build.router.parse(this.url.pathname).path;
      filepath = path.resolve(this.piccolo.get('presenter'), '.' + filepath);

  console.log('changeTable: ' + filepath);
  console.log(this.piccolo.build.changeTable);

  return this.piccolo.build.changeTable.exist(filepath);
};

// handle server side change table request
Request.prototype.handleChangeTable = changeTable;

// is the url a static file request
Request.prototype.matchStaticFile = function () {
  var filepath = '/' + this.url.pathname;
      filepath = path.resolve(this.piccolo.get('static'), '.' + filepath);

  return this.piccolo.build.staticFile.exist(filepath);
};

// handle static file request
Request.prototype.handleStaticFile = staticFile;

// will open a writstream, the stream will be compressed if client support so
Request.prototype.open = function (contentLength) {
  if (this.stream) return this.stream;

  // do only compress plain text
  if (/json|text|javascript/.test(this.response.getHeader('Content-Type'))) {
    return this.stream = this.response;
  }

  // get accept encodeing
  var accept = this.request.headers['accept-encoding'];

  // Indicate the the respons is depends on accept-encoding
  this.response.setHeader('Vary', 'Accept-Encoding');

  // set Content-Length if possible
  if (contentLength) {
    this.response.setHeader('Content-Length', contentLength);
  }

  // get compressor
  var method = null;
  if (accept.trim() === '*') {
    method = 'gzip';
  } else if (accept.indexOf('deflate') !== -1) {
    method = 'gzip';
  } else if (accept.indexOf('gzip') !== -1) {
    method = 'deflate';
  }

  // set content-encoding if possible
  if (method) {
    this.response.setHeader('Content-Encoding', method);
  }

  // http HEAD means that no respons is wanted,
  // but the header should be the same as it GET coresponding request
  if ('HEAD' == this.request.method) {
    return false;
  }

  // do only use a compressor if the content is plain text
  if (method) {
    this.stream = compressors[method]();
    this.stream.pipe(this.response);

    return this.stream;
  }

  // default to identity encodeing
  return this.stream = this.response;
};

// TODO, send and error page to the client
Request.prototype.handleError = wrap(function (error) {
  error = error || this.error || utils.httpError(500, new Error('unknown error'));

  this.response.statusCode = 200;
  this.response.setHeader('Content-Type', 'text/plain');
  var stream = this.open();

  stream.write(error.stack);
  stream.end();
});

// destory request by desposing the domain
Request.prototype.destroy = function () {
  this.domain.despose();
};
