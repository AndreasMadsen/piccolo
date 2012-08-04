
var fs = require('graceful-fs');
var path = require('path');
var async = require('async');
var flower = require('flower');
var safedir = require('safedir');
var leaflet = require('leaflet');
var uglify = require("uglify-js");

var common = require('../common.js');
var createETag = common.load('helpers', 'etag');

function Dependencies(piccolo, callback) {
  if (!(this instanceof Dependencies)) return new Dependencies(piccolo, callback);

  var self = this;

  // save piccolo object
  this.piccolo = piccolo;

  // This map will contain all resolved dependencies
  this.cache = { dependencies: {}, resolved: {}, dirMap: [], stats: {} };

  // This map will contain the build dependencies tree
  this.build = { dependencies: {}, packageMap: {}, dirMap: [], mtime: {} };

  this.compiler = null;

  setupCompiler(this, piccolo, function (error) {
    if (error) return callback(error, null);

    // execute callback when all files are compiled
    self.updateCache(function (error) {
      callback(error, self);
    });
  });
}
module.exports = Dependencies;

function setupCompiler(self, piccolo, callback) {

  var options = {
    source: piccolo.get('modules'),
    cache: path.join(piccolo.get('temp'), 'modules'),
    state: path.join(piccolo.get('temp'), 'modules.state.json')
  };

  var cache = self.cache;
  var compiler = self.compiler = leaflet(options, callback);

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
    var exec = self.resolveModule.bind(self, file.path);

    var dependencies = self
          .resolveSource(content)
          .map(exec)
          .filter(function (filepath) { return !!filepath; });

    cache.dependencies['/' + file.path] = dependencies;
    cache.stats['/' + file.path] = file.mtime;

    next(content);
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

// return a list of all dependencies my matching require('modulename') agains the given source
var pattern = /([a-zA-Z0-9_$]?)require\s*\(\s*(?:'|")([^'"]*)(?:'|")\s*(,)?/g;

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

// !! be sure to update /modules/module.js as well (TODO: dry this intro module.js)
// return the resolved filepath pointing to the module file
Dependencies.prototype.resolveModule = function (source, modulename) {

  var base = path.resolve('/', path.dirname(source));
  var isPath = modulename[0] === '.' || modulename[0] === '/';

  // normalize ./ ../ and / relative to base
  if (isPath) {
    modulename = path.resolve(base, modulename);
  }

  // get cached maps
  var dirMap = this.build.dirMap;
  var packageMap = this.build.packageMap;

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
    if (index > 1) {
      while (index !== 0) {
        searchQuery.unshift( path.join(base.slice(0, index), 'modules') + '/');
        index = base.lastIndexOf('/', index - 1);
      }
    }

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
    if (packageMap[basename]) {
      return packageMap[basename];
    }

    return searchArray(dirMap, basename + '/index.js');
  }

  // find filepath
  var i = searchQuery.length, filepath;
  while (i--) {
    filepath = searchBase(searchQuery[i]);
    if (isPath || filepath) {
      return cache[modulename] = filepath;
    }
  }

  return false;
};

// will recompile the cache and update all computed cache
Dependencies.prototype.updateCache = function (callback) {
  var self = this;
  var modulePath = this.piccolo.get('modules');

  // create directory map
  safedir(modulePath, function (error, list) {
    if (error) return callback(error, null);

    // save directory map
    self.build.dirMap = filterList(list);

    // scan and resolve all packages
    buildPackage(function (error) {
      if (error) return callback(error);

      // execute callback when all files are compiled
      self.compiler.compile(function (error) {
        if (error) return callback(error);

        buildMap();
        callback();
      });
    });
  });

  function filterList(list) {
    return list.filter(function (filepath) {
      var ext = path.extname(filepath);
      return ext === '.json' || ext === '.js';
    }).sort();
  }

  // scan and resolve all packages
  function buildPackage(callback) {

    var dirMap = self.build.dirMap,
        i = dirMap.length,
        filepath,
        pkgName = '/package.json',
        pkgLength = pkgName.length,
        list = [];

    // search dirmap for package.json
    while(i--) {
      filepath = dirMap[i];
      if (filepath.slice(filepath.length - pkgLength, filepath.length) === pkgName) {
        list.push(filepath);
      }
    }

    function resolvePackage(filepath, callback) {
      var dirname = filepath.slice(0, filepath.length - pkgLength);
      var fullpath = path.resolve(self.piccolo.get('modules'), './' + filepath);

      var response = { key: dirname };

      fs.readFile(fullpath, 'utf8', function (error, content) {
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
          filepath = path.resolve(dirname, './index.js');
        }

        // check that file exist
        var fullpath = path.resolve(self.piccolo.get('modules'), './' + filepath);
        fs.exists(fullpath, function (exist) {
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
        final[obj.key] = obj.value;
      });

      // save resolved packageMap
      self.build.packageMap = final;
      callback(null, null);
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
      deepResolve(self, filename, list);

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

function deepResolve(self, filepath, result) {

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
  if (cache) {
    cache.forEach(function (filepath) {
      deepResolve(self, filepath, result);
    });
  }
}

function appendModule(self, output, filepath) {
  return function (callback) {
    var stream;

    // append XML CDATA+TAG start
    output.write('<module path="' + filepath + '"><![CDATA[');

    // append source code content to output
    stream = self.compiler.read(filepath);
    stream.pipe(output, {end: false});
    stream.once('end', function () {
      output.write(']]></module>');
      callback();
    });
    stream.resume();
  };
}

function dependenciesList(self, filepath, cache) {
  // default cache to no cache
  if (!cache) cache = [];

  // get prebuild dependencies map
  var dependencies = self.build.dependencies[filepath];

  // don't include cached files
  var response = dependencies.filter(function (filepath) {
    return (cache.indexOf(filepath) === -1);
  });

  return response;
}

// returns an readstream containing the requested module and all nessearry dependencies
Dependencies.prototype.readClient = function (modulename, cache) {
  var self = this;
  var output;

  // open or append to stream
  output = flower.queryStream();
  output.pause();

  // set mime type
  output.type = 'application/xml';

  // write JSON begin
  output.write('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  output.write('<modules>');

  // resolve the module name, so it match cache object
  var filepath = self.resolveModule( '/', modulename);

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
  output.etag = createETag(mtime + JSON.stringify(dependencies));

  // resolveModule can be sync, so just to be sure wait until next tick
  process.nextTick(function () {
    output.emit('ready');

    // create an execution list
    var list = [];
    if (dependencies.length > 0) {
      list.push.apply(list, dependencies.map(appendModule.bind(null, self, output)));
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
  var modulePath = self.piccolo.get('modules');
  filepath = path.resolve(modulePath, './' + filepath);

  // create response object
  var response = {
    'key': filepath.slice(modulePath.length)
  };

  fs.readFile(filepath, 'utf8', function (error, content) {
    if (error) return callback(error, null);

    response.value = removeBOM(content);
    callback(null, response);
  });
}

Dependencies.prototype.readServer = function (filepath, cache, callback) {
  var self = this;

  // get prebuild dependencies map
  var dependencies = dependenciesList(self, filepath, cache);

  async.map(dependencies, handleMap.bind(null, self), function (error, result) {
    if (error) return callback(error, null);

    var map = {};
    result.forEach(function (obj) {
      map[obj.key] = obj.value;
    });

    callback(null, map);
  });
};
