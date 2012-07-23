
var async = require('async');
var domstream = require('domstream');

var common = require('../common.js');
var readdir = common.load('helpers', 'readdir');
var readfile = common.load('helpers', 'file');

function Templates(piccolo, callback) {
  if (!(this instanceof Templates)) return new Templates(piccolo, callback);

  var templatePath = piccolo.get('template');

  readdir(templatePath, function (error, list) {
    if (error) return callback(error, null);

    async.map(list, readfile, function (error, list) {
      if (error) return callback(error, null);

      var mtime = 0;
      var obj = {};

      list = list.map(function (item) {
        // update mtime
        if (item.mtime > mtime) {
          mtime = item.mtime;
        }

        // parse template content
        var path = item.path.slice(templatePath.length);
        obj[path] = parseContent(path, item.content);
      });

      callback(null, { files: obj, mtime: mtime });
    });
  });
}
module.exports = Templates;

function parseContent(path, content) {
  var doc = domstream(content);
  var title = doc.find().only().elem('title').toValue();

  title.insert('afterend',
              '<script data-template="' + path + '" src="/piccolo/framework.js"></script>');

  return doc;
}
