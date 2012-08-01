
var crypto = require('crypto');

module.exports = function (content) {
  return crypto.createHash('md5').update(content).digest("hex");
};
