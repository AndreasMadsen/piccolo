
module.exports = function (url, callback) {
  var req = new XMLHttpRequest();
  req.onreadystatechange = function () {
    if (req.readyState !== 4) return;

    if (req.status >= 400) {
      var error = new Error(req.statusText);
      error.status = req.status;
      return callback(error, null);
    }

    callback(req, null);
  };

  req.open('GET', url);
  req.send(null);
};
