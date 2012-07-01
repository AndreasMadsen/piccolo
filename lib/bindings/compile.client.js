
module.exports = function (source, filename) {
  var script;
  try {
    script = document.createElement('script');
    script.appendChild(document.createTextNode('window.piccoloCompile = ' + source));
    document.head.appendChild(script);
  } finally {
    document.head.removeChild(script);
    var result = window.piccoloCompile;
    delete window.piccoloCompile;
    return result;
  }
};
