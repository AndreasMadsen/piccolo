
module.exports = function (rootname, modulename, cache, callback) {
  var req = new XMLHttpRequest();
  req.onreadystatechange = function () {
    if (req.readyState !== 4) return;
    if (req.status >= 400) {
      var err = new Error(req.statusText);
      err.status = req.status;
      return callback(err, null);
    }

    var doc = req.responseXML;
    var modules = doc.getElementsByTagName('module');
    var map = { presenter: {}, modules: {} };

    window.test = doc;

    var i = modules.length;
    console.log('i:', i);
    while (i--) {
      var elem = modules[i];
      console.log('elem:', elem);
      map[elem.getAttribute('root')][elem.getAttribute('path')] = elem.firstChild.textContent;
    }

    console.log(map);

    callback(null, map);
  };

  var e = encodeURIComponent;
  var query = 'root=' + e(rootname) + '&name=' + e(modulename) + '&cache=' + e(JSON.stringify(cache));
  req.open('GET', '/piccolo/require/?' + query);
  req.send(null);
};
