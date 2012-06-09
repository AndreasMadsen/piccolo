
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
        console.error('Catch', error.stack);

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
      if (this.piccolo.get('debug')) {
        console.log('got direct piccolo request:', this.request.url);
      }
      this.handlePiccoloRequest();
    }

    // change table request
    else if (this.matchChangeTable()) {
      if (this.piccolo.get('debug')) {
        console.log('got change table request:', this.request.url);
      }
      this.handleChangeTable();
    }

    // static file request
    else if (this.matchStaticFile()) {
      if (this.piccolo.get('debug')) {
        console.log('got static file request:', this.request.url);
      }
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
  this.cache.filepath = this.piccolo.build.router.parse(this.url.pathname).path;
  this.cache.filepath = path.resolve(this.piccolo.get('presenter'), '.' + this.cache.filepath);

  return this.piccolo.build.changeTable.exist(this.cache.filepath);
};

// handle server side change table request
Request.prototype.handleChangeTable = changeTable;

// is the url a static file request
Request.prototype.matchStaticFile = function () {
  this.cache.filepath = '/' + this.url.pathname;
  this.cache.filepath = path.resolve(this.piccolo.get('static'), '.' + this.cache.filepath);

  return this.piccolo.build.staticFile.exist(this.cache.filepath);
};

// handle static file request
Request.prototype.handleStaticFile = staticFile;

// will open a writstream, the stream will be compressed if client support so
Request.prototype.open = function (compress) {
  if (this.stream) return this.stream;

  // set Date header
  this.response.setHeader('Date', new Date().toUTCString());

  // do only compress plain text
  if (/json|text|javascript/.test(this.response.getHeader('Content-Type')) === false) {
    return this.stream = this.response;
  }

  // get accept encodeing
  var accept = this.request.headers['accept-encoding'];

  // Indicate the the respons is depends on accept-encoding
  this.response.setHeader('Vary', 'Accept-Encoding');

  // get compressor
  var method = null;
  if (compress === false) {
    method = null;
  } else if (accept === undefined) {
    method = null;
  } else if (accept.trim() === '*') {
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
    this.response.end();
    return false;
  }

  // return write stream
  if (method) {
    this.stream = compressors[method]();
    this.domain.add(this.stream);
    this.stream.pipe(this.response);

    return this.stream;
  }

  // default to identity encodeing
  return this.stream = this.response;
};

// TODO, send and error page to the client
Request.prototype.handleError = wrap(function () {
  // protect aginst error loops and error overload
  if (this.cache.errorHandled) return;
  this.cache.errorHandled = true;

  var self = this;

  // get or create error
  var error = arguments.length || this.error || utils.httpError(500, new Error('unknown error'));
  var stack = error.origin ? error.origin.stack : error.stack;
  var status = error.statusCode || 500;

  // write headers
  this.response.statusCode = status;
  this.response.setHeader('Content-Type', 'text/plain');

  // write error stack trace
  var stream = this.open();
  stream.write(stack);
  stream.end();

  // destroy everything related to the client request
  // once no more data can be writen to the client response stream
  stream.once('close', function () {
    self.destroy();
  });
});

// destory request by desposing the domain
Request.prototype.destroy = function () {
  this.domain.dispose();
};
