
var mime = require('mime');
var path = require('path');

module.exports = function handle_staticFile() {
  var self = this;
  var cache = this.piccolo.get('cache');
  var res = this.response;

  // set response code
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

  // get content type header
  var type = mime.lookup(this.url.pathname);
  var charset = mime.charsets.lookup(type);

  // assume charset is UTF-8 if is handled by a compress stream
  if (!charset && /json|text|javascript/.test(type)) {
    charset = 'UTF-8';
  }

  // set mime and charset
  res.setHeader('Content-Type', type + (charset ? '; charset=' + charset : ''));

  // create read stream and add to domain
  var file = this.piccolo.build.staticFile.read(this.cache.filepath);
  this.domain.add(file);

  file.once('ready', function () {
    // set mtime and size headers
    res.setHeader('Last-Modified', file.mtime.toUTCString());

    var stream = self.open();
    // HEAD request, nothing should be writen
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
