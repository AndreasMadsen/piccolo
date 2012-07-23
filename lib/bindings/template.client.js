
var domstream = require.binding('domstream');

exports.exist = function (filename) {
  return piccolo.build.template.indexOf(filename) !== -1;
};

// Monkypatch domstream.Node.done so it pass anchortags
var done = domstream.Node.prototype.done;
domstream.Node.prototype.done = function () {

  // we have to pass parentNode, since domstream allow
  // adding elements around the selected node.
  piccolo.handleLinks(this.elem.parentNode);

  return done.apply(this, arguments);
};

var cache = null;
exports.setup = function (modifyer, filename) {
  if (filename === piccolo.build.currentTemplate) {
    if (cache) return cache;

    return cache = domstream(modifyer.internal.output);
  }

  window.location = modifyer.url;
};
