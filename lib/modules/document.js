
var template = require.binding('template');

function Modifier(url, output) {
  this.internal = {
    output: output,
    doc: null
  };

  this.url = url;
}
module.exports = Modifier;

Modifier.prototype.container = function (list) {
  var doc = this.internal.doc;
  if (doc === null) throw new Error('Document.template was not executed');

  return doc.container(list);
};

Modifier.prototype.find = function () {
  var doc = this.internal.doc;
  if (doc === null) throw new Error('Document.template was not executed');

  return doc.find();
};

Modifier.prototype.template = function (filename) {
  if (!template.exist(filename)) {
    throw new Error('The template ' + filename + ' do not exist.');
  }

  this.internal.doc = template.setup(this, filename);
};
