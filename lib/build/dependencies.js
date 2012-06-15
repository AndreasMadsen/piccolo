
var fs = require('fs');
var path = require('path');
var async = require('async');
var flower = require('flower');
var leaflet = require('leaflet');
var uglify = require("uglify-js");

var common = require('../common.js');
var readdir = common.load('helpers', 'readdir');

function Dependencies(piccolo, callback) {
  if (!(this instanceof Dependencies)) return new Dependencies(piccolo, callback);

  var self = this;

  // save piccolo object
  this.piccolo = piccolo;

  // get module path
  var modulePath = piccolo.get('modules');

  // This map will contain all resolved dependencies
  this.cache = {
    dependencies: {},
    resolved: {},
    dirMap: []
  };

  var options = {
    source: modulePath,
    cache: path.join(piccolo.get('temp'), 'modules'),
    state: path.join(piccolo.get('temp'), 'modules.state.json')
  };

  var compiler = leaflet(options, function (error) {
    if (error) return callback(error, null);

    // create directory map
    readdir(modulePath, function (error, list) {
      if (error) return callback(error, null);

      // save directory map
      self.cache.dirMap = list.map(function (value) {
        return value.slice(modulePath.length);
      });

      // execute callback when all files are compiled
      if (piccolo.get('precompile')) {
        compiler.compile(callback.bind(null, null, self));
      } else {
        callback(null, self);
      }
    });
  });

  // setup filewatcher
  if (piccolo.get('reload') === 'auto') {
    compiler.watch();
  }

  // strip BOM
  compiler.handle('js', 'string', function (content, next) {
    // Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
    // because the buffer-to-string conversion in `fs.readFileSync()`
    // translates it to FEFF, the UTF-16 BOM.
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }
    next(content);
  });

  // match all require
  compiler.handle('js', 'string', function (content, next, file) {
    self.cache.dependencies['/' + file.path] = self.resolveSource(content);

    next(content);
  });

  // escape source code so it match the JSON syntax
  compiler.handle(['js', 'json'], 'string', function (content, next) {
    next( JSON.stringify(content) );
  });

  if (piccolo.get('compress')) {
    var jsp = uglify.parser;
    var pro = uglify.uglify;

    compiler.handle('js', 'string', function (content, next) {
      var ast = jsp.parse(content);
          ast = pro.ast_mangle(ast);
          ast = pro.ast_squeeze(ast);

      next(pro.gen_code(ast));
    });

    compiler.handle('json', 'string', function (content, next) {
      next( JSON.stringify(JSON.parse(content)) );
    });
  }

  // export the leaflet compiler
  this.compiler = compiler;
}
module.exports = Dependencies;

// return a list of all dependencies my matching require('modulename') agains the given source
var pattern = /([a-zA-Z0-9_$]?)require\s*\(\s*(?:'|")([^'"]*)(?:'|")\s*(,)?/g;
    pattern.compile(pattern);

// ([a-zA-Z0-9_$]?) :: we will need to check if not just a part of a function name like subrequire()
// require :: the function name there must match
// \s*\(\s* :: the function name must be follwed by ( by space can exist
// (?:'|") :: we will only support inline strings
// ([^'"]*) :: this will contain the module name
// (?:'|") :: the string quote ends
// \s*(,) :: this will detect any second argument
Dependencies.prototype.resolveSource = function (source) {
  var query = [], match;
  while (match = pattern.exec(source)) {
    if (match[1] === '' && match[3] === undefined) {
      query.push(match[2]);
    }
  }

  return query;
};

// search array and return the search argument or false if not found
function searchArray(list, value) {
  var index = list.indexOf(value);

  if (index === -1) return false;
  return value;
}

// return the resolved filepath pointing to the module file
Dependencies.prototype.resolveModule = function (source, modulename, cb) {

  var isPath, resolved, searchQuery, result, index;
  var dirMap = this.cache.dirMap;
  var base = path.dirname(source);

  resolved = this.cache.resolved;
  resolved = resolved[base] || (resolved[base] = {});

  isPath = modulename[0] === '.' || modulename[0] === '/';

  // normalize ./ ../ and / relative to base
  if (isPath) {
    modulename = path.resolve(base, modulename);
  }

  // check and read cache
  result = resolved[modulename];
  if (result) {
    return cb(null, result);
  }

  // set cache and execute callback
  function callback(error, result) {
    if (error === null) {
      resolved[modulename] = result;
    }

    return cb(error, result);
  }

  // resolve serach query
  searchQuery = [];
  if (isPath) {
    searchQuery.push( path.dirname(modulename) );
  } else {
    index = base.length;
    while (index !== 0) {
      searchQuery.push( path.join(base.slice(0, index), 'modules') + '/');
      index = base.lastIndexOf('/', index - 1);
    }

    searchQuery.push('/modules/');
    searchQuery.push('/');
  }

  // search each query
  function searchBase(base, filename, isPath, callback) {
    var basename = path.resolve(base, filename);

    // return no path
    filename = searchArray(dirMap, basename);
    if (filename) {
      return callback(null, filename);
    }

    // return .js path
    filename = searchArray(dirMap, basename + '.js');
    if (filename) {
      return callback(null, filename);
    }

    // return .json path
    filename = searchArray(dirMap, basename + '.json');
    if (filename) {
      return callback(null, filename);
    }

    // if input was an path, do search more
    if (isPath) {
      return callback(null, false);
    }

    // resolve and return /package.json path
    filename = searchArray(dirMap, path.resolve(basename, 'package.json'));
    if (filename) {
      fs.readFile(filename, 'utf8', function (error, content) {
        if (error) return callback(error, null);

        // resolve filepath using main property and fallback to index.js
        var pkg = JSON.parse(content);
        if (pkg.main) {
          filename = path.resolve(basename, pkg.main);
        } else {
          filename = path.resolve(basename, 'index.js');
        }

        callback(null, filename);
      });

      return;
    }

    // return /index.js
    filename = searchArray(dirMap, path.resolve(basename, 'index.js'));
    if (filename) {
      return callback(null, filename);
    }

    // not found, stop search
    return callback(null, false);
  }

  (function level(i) {
    searchBase(searchQuery[i], modulename, isPath, function (error, filepath) {
      if (error) return callback(error, null);

      if (isPath === false && filepath === false && searchQuery[i] !== '/') {
        return level(i + 1);
      }

      callback(null, filepath);
    });
  })(0);
};


function appendModule(self, output, filepath, appended, seperator, callback) {
  var stream;

  // ignore this module if it has already been appended
  if (appended.indexOf(filepath) !== -1) {
    return callback(null);
  }

  // ignore this module in the future
  appended.push(filepath);

  // append JSON seperator
  if (seperator) {
    output.write(',');
  }

  // append JSON property name
  output.write('"' + filepath + '":');

  // append source code content to output
  stream = self.compiler.read(filepath);
  stream.on('data', output.write.bind(output));
  stream.resume();

  stream.on('error', function (error) {
    callback(error);
  });
  stream.once('end', function () {
    var dependencies = self.cache.dependencies[filepath];

    // resolve relative dependencies
    async.map(dependencies, self.resolveModule.bind(self, filepath), function (error, dependencies) {
      if (error) return callback(error);

      // check that all dependencies was resolved
      var i = dependencies.length;
      while (i--) {
        if (dependencies[i] === false) {
          return output.emit('error', new Error('could not resolve dependencies in ' + filepath));
        }
      }

      // remove allready included modules
      dependencies = dependencies.filter(function (filename) {
        return (appended.indexOf(filename) === -1);
      });

      // This will execute appendModule on all dependencies
      function append(filepath) {
        return function (callback) {
          appendModule(self, output, filepath, appended, true, callback);
        };
      }
      async.series(dependencies.map(append), callback);
    });
  });
}

// returns an readstream containing the requested module and all nessearry dependencies
Dependencies.prototype.read = function (modulename, cache) {
  var self = this;
  var output;

  // default cache to no cache
  cache = [];

  // open or append to stream
  output = flower.relayReadStream();
  output.pause();

  // wrap resume so we will first begin writing when ready
  var resume = output.resume;
  output.resume = function () {

    // call the real resume, and call only that in the future
    resume.call(this);
    output.resume = resume;

    output.write('{');

    // resolve the modulename
    self.resolveModule('/', modulename, function (error, filepath) {
      if (error) return output.emit('error', error);

      // append the module and all its dependencies to the output stream
      appendModule(self, output, filepath, cache, false, function (error) {
        if (error) return output.emit('error', error);

        // end JSON output
        output.write('}');

        // close stream
        output.emit('end');
        output.emit('close');
      });
    });
  }

  return output;
};
