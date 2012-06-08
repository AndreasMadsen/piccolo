
var connect = require('connect');
var url = require('url');
var util = require('util');
var events = require('events');
var zlib = require('zlib');

var common = require('../common.js');
var utils = common.load('utils');

// Define compression types
var compressors = {
  gzip: zlib.createGzip,
  deflate: zlib.createDeflate
};

// TODO: call this file request and export an EventEmitter there emits errors
// and remove connect.
// Export an .destroy() there will stop and cleanup.
// Each /core file should be a route subroutine
module.exports = function Request(piccolo, request, response) {
  // domains support
  events.EventEmitter.call(this);

  // strore parent and http streams
  this.piccolo = piccolo;
  this.request = request;
  this.response = response;

  // cache object
  this.cache = {};

  // parse request url
  this.url = url.parse(request.url, true, false);
  this.path = this.pathname.split('/');

  // attach default error handler
  this.on('error', function (error) {
    // store error for later use
    this.error = error;

    // if no error event handler is attached
    if (this.listenter('error').length === 1) {
      console.error(error.stack);

      // execute default handler
      this.handleError();
    }
  });

  // Do not allow null byte
  if (this.req.url.indexOf('\0') !== -1) {
    this.emit('error', utils.httpError(400));
  }

  // is direct piccolo request
  else if (this.matchPiccoloRequest()) {
    this.handlePiccoloRequest();
  }

  // this change table request
  else if (this.matchChangeTable()) {
    this.handleChangeTable();
  }

  // this is a static file
  else if (this.matchStaticFile()) {
    this.handleStaticFile();
  }

  // emit 404 error, will be handled by developer or default error handler
  else {
    this.emit('error', utils.httpError(404));
  }

};
util.inherits(Request, events.EventEmitter);

// is the url is a direct piccolo request
Request.prototype.matchPiccoloRequest = function () {
  return this.path[0] === 'piccolo';
};

// is the url a server side change table request
Request.prototype.matchChangeTable = function () {
  var route = this.cache.changeTable = this.piccolo.build.router.parse(this.url.pathname);

  return this.piccolo.build.changeTable.exist(route.path);
};

// is the url a static file request
Request.prototype.matchStaticFile = function () {
  var filepath = this.cache.staticFile = '/' + this.url.pathname;

  return this.piccolo.build.staticFile.exist(filepath);
};

// will open a writstream, the stream will be gziped if client support so
Request.prototype.open = function (contentLength) {
  if (this.stream) return this.stream;

  // do only compress plain text
  if (/json|text|javascript/.test(this.response.getHeader("Content-Type"))) {
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
Request.prototype.handleError = function (error) {
  error = error || this.error || utils.httpError(500, new Error('unknown error'));

  process.exit(1);
};
