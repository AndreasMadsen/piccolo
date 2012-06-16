
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
    dirMap: [],
    stats: {}
  };

  // This map will contain the build dependencies tree
  this.build = {
    dependencies: {},
    mtime: {}
  };

  var options = {
    source: modulePath,
    cache: path.join(piccolo.get('temp'), 'modules'),
    state: path.join(piccolo.get('temp'), 'modules.state.json')
  };

  var compiler = leaflet(options, function (error) {
    if (error) return callback(error, null);

    // execute callback when all files are compiled
    self.updateCache(function (error) {
      callback(error, self);
    });
  });

  // strip BOM
  compiler.handle(['js', 'json'], 'string', function (content, next) {
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
    var list = self.resolveSource(content);
    var exec = self.resolveModule.bind(self, file.path);

    async.map(list, exec, function (error, list) {
      if (error) return next(error);

      self.cache.dependencies['/' + file.path] = list;
      self.cache.stats['/' + file.path] = file.mtime;

      next(content);
    });
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
  var base = path.resolve('/', path.dirname(source));

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

// will recompile the cache and update all computed cache
Dependencies.prototype.updateCache = function (callback) {
  var self = this;
  var modulePath = this.piccolo.get('modules');

  // create directory map
  readdir(modulePath, function (error, list) {
    if (error) return callback(error, null);

    // save directory map
    self.cache.dirMap = list.map(function (value) {
      return value.slice(modulePath.length);
    });

    // execute callback when all files are compiled
    self.compiler.compile(function (error) {
      if (error) return callback(error);

      build();
      callback();
    });
  });

  // rebuild dependency tree
  function build() {
    var dependencies = self.build.dependencies = {};
    self.build.mtime = self.cache.stats;

    // deep resolve all dependencies
    self.cache.dirMap.forEach(function (filename) {
      var list = [];

      // the result array will be filled by his function
      deepResovle(self, filename, list);

      // dry result array
      var result = dependencies[filename] = [];
      var i = list.length;
      while(i--) {
        if (result.indexOf(list[i]) === -1) {
          result.push(list[i]);
        }
      }

    });
  }
};

function deepResovle(self, filepath, result) {

  // get no deep dependencies
  var cache = self.cache.dependencies[filepath];
  var build = self.build.dependencies[filepath];

  // don't double resolve this
  if (result.indexOf(filepath) !== -1) {
    console.log('already resolved: ' + filepath);
    return;
  }
  result.push(filepath);

  // this filepath has already been resolved
  if (build) {
    console.log('already build: ', build);
    result.push.apply(result, build);
    return;
  }

  // Deep resolve cache
  cache.forEach(function (filepath) {
    deepResovle(self, filepath, result);
  });
}

function appendModule(self, output, seperator, filepath) {
  return function (callback) {
    var stream;

    // append JSON seperator
    if (seperator) {
      output.write(',');
    }

    // append JSON property name
    output.write('"' + filepath + '":');

    // append source code content to output
    stream = self.compiler.read(filepath);
    stream.pipe(output, {end: false});
    stream.once('end', callback);
    stream.resume();
  };
}

// returns an readstream containing the requested module and all nessearry dependencies
Dependencies.prototype.read = function (modulename, cache) {
  var self = this;
  var output;

  // default cache to no cache
  if (!cache) cache = [];

  // open or append to stream
  output = flower.queryStream();
  output.pause();

  // write JSON begin
  output.write('{');

  // resolve the module name, so it match cache object
  self.resolveModule('/', modulename, function (error, filepath) {
    if (error) return output.emit('error', error);

    // get prebuild dependencies map
    var dependencies = self.build.dependencies[filepath];

    // don't include cached files
    dependencies = dependencies.filter(function (filepath) {
      return (cache.indexOf(filepath) === -1);
    });

    // compile an execution list
    var list = [];
    if (dependencies.length > 0) {
      list.push(appendModule(self, output, false, dependencies.shift()));
    }
    if (dependencies.length > 0) {
      list.push.apply(list, dependencies.map(appendModule.bind(null, self, output, true)));
    }

    // run it all
    async.series(list, function (error) {
      if (error) {
        output.emit('error', error);
        output.destroy();
        return;
      }

      output.end('}');
    });
  });

  return output;
};
