
exports.exist = function (filename) {
  return piccolo.build.templates.files.hasOwnProperty(filename);
};

exports.setup = function (modifyer, filename) {
  var doc;

  doc = piccolo.build.templates.files[filename].copy();
  doc.live(true);
  doc.pipe(modifyer.internal.output);
  doc.resume();

  return doc;
};
