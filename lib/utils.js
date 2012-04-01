
var http = require('http');

// create a HTTP connect error
exports.httpError = function (code){
  var err = new Error(http.STATUS_CODES[code]);
      err.status = code;

  return err;
};
