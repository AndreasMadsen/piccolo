
var url = require('url');
var util = require('util');
var path = require('path');
var mime = require('mime');
var events = require('events');
var zlib = require('zlib');
var domain = require('domain');

var common = require('../common.js');
var utils = common.load('utils');
var staticFile = common.load('core', 'staticFile');
var piccoloRequest = common.load('core', 'piccoloRequest');
var presenterRequest = common.load('core', 'presenterRequest');

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
    this.path = this.url.pathname.split('/').slice(1);

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
    else if (this.matchPresenter()) {
      if (this.piccolo.get('debug')) {
        console.log('got change table request:', this.request.url);
      }
      this.handlePresenterRequest();
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
    var self = this, args = arguments;
    this.domain.run(function () {
      fn.apply(self, arguments);
    });
  };
}

// is the url is a direct piccolo request
Request.prototype.matchPiccoloRequest = function () {
  return this.path[0] === 'piccolo';
};

// handle direct piccolo requests
Request.prototype.handlePiccoloRequest = piccoloRequest;

// is the url a server side change table request
Request.prototype.matchPresenter = function () {
  this.cache.route = this.piccolo.build.router.parse(this.url.pathname);
  this.cache.filepath = path.resolve(this.piccolo.get('presenter'), './' + this.cache.route.path);

  return this.piccolo.build.presenter.exist(this.cache.filepath);
};

// handle server side change table request
Request.prototype.handlePresenterRequest = presenterRequest;

// is the url a static file request
Request.prototype.matchStaticFile = function () {
  this.cache.filepath = path.resolve(this.piccolo.get('static'), './' + this.url.pathname);

  return this.piccolo.build.staticFile.exist(this.cache.filepath);
};

// handle static file request
Request.prototype.handleStaticFile = staticFile;

// will open a writstream, the stream will be compressed if client support so
Request.prototype.open = function (compress) {
  if (this.stream) return this.stream;

  // set Date header
  this.response.setHeader('Date', new Date().toUTCString());

  // get content type header
  var mimetype = this.response.getHeader('Content-Type') || 'application/force-download';
  var charset = mime.charsets.lookup(mimetype);

  // assume charset is UTF-8 if is handled by a compress stream
  if (!charset && /json|text|javascript/.test(mimetype)) {
    charset = 'UTF-8';
  }

  // set mime and charset
  this.response.setHeader('Content-Type', mimetype + (charset ? '; charset=' + charset : ''));

  // do only compress plain text
  if (/json|text|javascript/.test(this.response.getHeader('Content-Type')) === false) {

    // http HEAD means that no respons is wanted,
    // but the header should be the same as it GET coresponding request
    if ('HEAD' == this.request.method || this.response.statusCode === 304) {
      this.response.end();
      return false;
    }

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
  if ('HEAD' == this.request.method || this.response.statusCode === 304) {
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

// send a static file, using a file object
Request.prototype.send = function (file) {
  var self = this;

  var cache = this.piccolo.get('cache');
  var res = this.response;
  var req = this.request;

  // add to domain
  this.domain.add(file);

  // parse if-modified-since as Date
  var clientMtime = Date.parse(req.headers['if-modified-since']) || 0;

  // set response code (default)
  res.statusCode = 200;

  // Set cache control headers
  if (cache === 'none') {
    res.setHeader('Expires', 'Mon, 26 Jul 1997 05:00:00 GMT');
    res.setHeader('Cache-Control', 'no-cache, private, must-revalidate, ' +
                                   'max-stale=0, post-check=0, pre-check=0 no-store');
    res.setHeader('Pragma', 'no-cache');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=' + cache);
  }

  file.once('ready', function () {
    res.setHeader('Content-Type', file.type);

    // set mtime and size headers
    res.setHeader('Last-Modified', file.mtime.toUTCString());

    // set response code
    if (cache !== 'none' && clientMtime >= file.mtime.getTime()) {
      res.statusCode = 304;
    }

    // open client output stream
    var stream = self.open();

    // HEAD request or 304 response code, nothing should be writen
    if (stream === false) {
      file.destroy();
    }

    // pipe file content to http response stream
    else {
      file.pipe( stream );
      file.resume();
    }
  });
};

Request.prototype.allowMethod = function (methods) {
  this.response.setHeader('Allow', methods.join(', '));

  // For the time being allow only GET and HEAD request
  if (methods.indexOf(this.request.method) === -1) {
    this.emit('error', utils.httpError(405));
    return true;
  }

  return false;
};

// TODO, send and error page to the client
Request.prototype.handleError = wrap(function () {
  // protect aginst error loops and error overload
  if (this.cache.errorHandled) return;
  this.cache.errorHandled = true;

  var self = this;

  // get or create error
  var error = arguments[0] || this.error || utils.httpError(500, new Error('unknown error'));
  var stack = error.origin ? error.origin.stack : error.stack;
  var status = error.statusCode || 500;
  if (status < 400) {
    status = 500;
  }

  // set statusCode, just to sure that it has one
  error.statusCode = status;

  // write headers
  this.response.statusCode = status;
  this.response.setHeader('Content-Type', 'text/plain');

  // write error stack trace
  var stream = this.open();
  if (stream) {
    stream.write(stack);
    stream.end();

    // destroy everything related to the client request
    // once no more data can be writen to the client response stream
    stream.once('close', function () {
      self.destroy();
    });
  } else {
    self.destroy();
  }
});

// destory request by desposing the domain
Request.prototype.destroy = function () {
  this.domain.dispose();
};
