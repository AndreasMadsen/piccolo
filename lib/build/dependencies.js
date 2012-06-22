
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
    packageMap: {},
    dirMap: [],
    mtime: {}
  };

  var options = {
    source: modulePath,
    cache: path.join(piccolo.get('temp'), 'modules'),
    state: path.join(piccolo.get('temp'), 'modules.state.json')
  };

  var compiler = this.compiler = leaflet(options, function (error) {
    if (error) return callback(error, null);

    // execute callback when all files are compiled
    self.updateCache(function (error) {
      callback(error, self);
    });
  });

  // strip BOM
  compiler.handle(['js', 'json'], 'string', function (content, next) {
    // Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
    // because the buffer-to-string conversion in `fs.readFile()`
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

    self.cache.dependencies['/' + file.path] = list.map(exec);
    self.cache.stats['/' + file.path] = file.mtime;

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

// !! sure to update /modules/module.js as well (TODO: dry this intro module.js)
// return the resolved filepath pointing to the module file
Dependencies.prototype.resolveModule = function (source, modulename) {

  var dirMap = this.build.dirMap;
  var packageMap = this.build.packageMap;

  var base = path.resolve('/', path.dirname(source));
  var isPath = modulename[0] === '.' || modulename[0] === '/';

  // normalize ./ ../ and / relative to base
  if (isPath) {
    modulename = path.resolve(base, modulename);
  }

  // check cache
  var cache = this.cache.resolved[base] || (this.cache.resolved[base] = {});
  if (cache[modulename]) {
    return cache[modulename];
  }

  // resolve serach query
  var searchQuery = [];
  if (isPath) {
    searchQuery.unshift( path.dirname(modulename) );
  } else {
    var index = base.length;
    while (index !== 0) {
      searchQuery.unshift( path.join(base.slice(0, index), 'modules') + '/');
      index = base.lastIndexOf('/', index - 1);
    }

    searchQuery.unshift('/modules/');
    searchQuery.unshift('/');
  }

  // search each query
  function searchBase(base) {
    var basename = path.resolve(base, modulename);

    // return no path
    var filename = searchArray(dirMap, basename);
    if (filename) return filename;

    // return .js path
    filename = searchArray(dirMap, basename + '.js');
    if (filename) return filename;

    // return .json path
    filename = searchArray(dirMap, basename + '.json');
    if (filename) return filename;

    // if input was an path, do search more
    if (isPath) return false;

    // resolve and return /package.json path
    return packageMap[basename];
  }

  // find filepath
  var i = searchQuery.length, filepath;
  while (i--) {
    filepath = searchBase(searchQuery[i]);
    if (isPath || filepath) {
      return filepath;
    }
  }

  return false;
};

// will recompile the cache and update all computed cache
Dependencies.prototype.updateCache = function (callback) {
  var self = this;
  var modulePath = this.piccolo.get('modules');

  // create directory map
  readdir(modulePath, function (error, list) {
    if (error) return callback(error, null);

    // save directory map
    self.build.dirMap = list.map(function (value) {
      return value.slice(modulePath.length);
    });

    // scan and resolve all packages
    buildPackage(function () {
      if (error) return callback(error);

      // execute callback when all files are compiled
      self.compiler.compile(function (error) {
        if (error) return callback(error);

        buildMap();
        callback();
      });
    });
  });

  // scan and resolve all packages
  function buildPackage(callback) {

    var dirMap = self.cache.dirMap,
        i = dirMap.length,
        path,
        pkgName = '/package.json',
        pkgLength = pkgName.length,
        list = [];

    // search dirmap for package.json
    while(i--) {
      path = dirMap[i];
      if (path.slice(path.length - pkgLength, path.length) === pkgName) {
        list.push(path);
      }
    }

    function resolvePackage(filepath, callback) {
      var dirname = path.slice(0, filepath.length - pkgLength);

      var response = { key: dirname };

      fs.readFile(filepath, 'utf8', function (error, content) {
        if (error) return callback(error, null);

        // remove BOM
        content = removeBOM(content);

        // use index if filepath is empty
        var filepath;
        if (content === '') {
          filepath = path.resolve(dirname, 'index.js');
        }

        // read JSON file
        var result;
        try {
          result = JSON.parse(content);
        } catch (e) {
          return callback(e, null);
        }

        if (result.main) {
          filepath = path.resolve(dirname, result.main);
        } else {
          filepath = path.resolve(dirname, 'index.js');
        }

        // check that file exist
        fs.exist(filepath, function (exist) {
          response.value = exist ? filepath : false;
          callback(null, response);
        });
      });
    }

    // read all package.json files and resolve the filepath
    async.map(list, resolvePackage, function (error, list) {
      if (error) return callback(error, null);

      var final = {};
      list.forEach(function (obj) {
        final[obj.key] = final[obj.value];
      });

      // save resolved packageMap
      self.build.packageMap = final;
    });
  }

  // rebuild dependency tree
  function buildMap() {
    var dependencies = self.build.dependencies = {};
    var cacheTime = self.cache.stats;
    var buildTime = self.build.mtime;

    Object.keys(cacheTime).forEach(function (filepath) {
      buildTime[filepath] = cacheTime[filepath].getTime();
    });

    // deep resolve all dependencies
    self.build.dirMap.forEach(function (filename) {
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
    return;
  }
  result.push(filepath);

  // this filepath has already been resolved
  if (build) {
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

    // append XML CDATA+TAG end
    if (seperator) {
      output.write(']]></module>');
    }

    // append XML CDATA+TAG start
    output.write('<module path="' + filepath + '"><![CDATA[');

    // append source code content to output
    stream = self.compiler.read(filepath);
    stream.pipe(output, {end: false});
    stream.once('end', callback);
    stream.resume();
  };
}

function dependenciesList(self, filepath, cache) {
  // default cache to no cache
  if (!cache) cache = [];

  // get prebuild dependencies map
  var dependencies = self.build.dependencies[filepath];

  // don't include cached files
  dependencies = dependencies.filter(function (filepath) {
    return (cache.indexOf(filepath) === -1);
  });

  return dependencies;
}

// returns an readstream containing the requested module and all nessearry dependencies
Dependencies.prototype.readClient = function (modulename, cache) {
  var self = this;
  var output;

  // open or append to stream
  output = flower.queryStream();
  output.pause();

  // write JSON begin
  output.write('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  output.write('<modules>');

  // resolve the module name, so it match cache object
  var filepath = self.resolveModule('/', modulename);

  // get prebuild dependencies map
  var dependencies = dependenciesList(self, filepath, cache);

  // find the highest mtime
  var mtime = 0;
  var cacheTime = self.build.mtime;
  dependencies.forEach(function (filepath) {
    var time = cacheTime[filepath];
    if (mtime < time) {
      mtime = time;
    }
  });

  // set mtime info
  output.mtime = new Date(mtime);

  // since resolveModule can be sync, so just to be sure wait until next tick
  process.nextTick(function () {
    output.emit('ready');

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

      output.end('</modules>');
    });
  });

  return output;
};

function removeBOM(content) {
  // Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
  // because the buffer-to-string conversion in `fs.readFile()`
  // translates it to FEFF, the UTF-16 BOM.
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }

  return content;
}

function handleMap(self, filepath, callback) {
  filepath = path.resolve(self.piccolo.get('modules'), './' + filepath);

  fs.readFile(filepath, 'utf8', function (error, content) {
    if (error) return callback(error, null);

    callback(null, removeBOM(content));
  });
}

Dependencies.prototype.readServer = function (modulename, cache, callback) {
  var self = this;

  // resolve the module name, so it match cache object
  var filepath = self.resolveModule('/', modulename);

  // get prebuild dependencies map
  var dependencies = dependenciesList(self, filepath, cache);

  async.map(dependencies, handleMap.bind(null, self), callback);
};
