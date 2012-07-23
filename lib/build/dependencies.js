
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

  // This map will contain all resolved dependencies
  this.cache = {
    modules: { dependencies: {}, resolved: {}, dirMap: [], stats: {} },
    presenter: { dependencies: {}, resolved: {}, dirMap: [], stats: {} }
  };

  // This map will contain the build dependencies tree
  this.build = {
    modules: { dependencies: {}, packageMap: {}, dirMap: [], mtime: {} },
    presenter: { dependencies: {}, packageMap: {}, dirMap: [], mtime: {} }
  };

  this.compiler = {};

  async.parallel([
    setupCompiler.bind(null, piccolo, this, 'modules'),
    setupCompiler.bind(null, piccolo, this, 'presenter')
  ], function (error) {
    if (error) return callback(error, null);

    // execute callback when all files are compiled
    self.updateCache(function (error) {
      callback(error, self);
    });
  });
}
module.exports = Dependencies;


function setupCompiler(piccolo, self, rootname, callback) {

  var options = {
    source: piccolo.get(rootname),
    cache: path.join(piccolo.get('temp'), rootname),
    state: path.join(piccolo.get('temp'), rootname + '.state.json')
  };

  var cache = self.cache[rootname];

  var compiler = self.compiler[rootname] = leaflet(options, callback);

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
    var dependencies = self.resolveSource(content);

    Object.keys(dependencies).forEach(function (searchname) {
      var exec = self.resolveModule.bind(self, searchname, file.path);
      dependencies[searchname] = dependencies[searchname].map(exec).filter(function (filepath) {
        return !!filepath;
      });
    });

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
var pattern = /([a-zA-Z0-9_$]?)require(\s*\.?\s*presenter)?\s*\(\s*(?:'|")([^'"]*)(?:'|")\s*(,)?/g;

// ([a-zA-Z0-9_$]?) :: we will need to check if not just a part of a function name like subrequire()
// require :: the function name there must match
// \s*\(\s* :: the function name must be follwed by ( by space can exist
// (?:'|") :: we will only support inline strings
// ([^'"]*) :: this will contain the module name
// (?:'|") :: the string quote ends
// \s*(,) :: this will detect any second argument
Dependencies.prototype.resolveSource = function (source) {
  var query = { presenter: [], modules: [] }, match;
  while (match = pattern.exec(source)) {
    if (match[1] === '' && match[4] === undefined) {
      var rootname = (match[2] && match[2].trim() === '.presenter') ? 'presenter' : 'modules';
      query[rootname].push(match[3]);
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
Dependencies.prototype.resolveModule = function (rootname, source, modulename) {

  var base = path.resolve('/', path.dirname(source));
  var isPath = modulename[0] === '.' || modulename[0] === '/';

  // none path requests do always have a module root
  if (isPath === false) {
    rootname = 'modules';
  }

  // normalize ./ ../ and / relative to base
  if (isPath) {
    modulename = path.resolve(base, modulename);
  }

  // get cached maps
  var dirMap = this.build[rootname].dirMap;
  var packageMap = this.build[rootname].packageMap;

  // check cache
  var cache = this.cache[rootname].resolved[base] || (this.cache[rootname].resolved[base] = {});
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
  var presenterPath = this.piccolo.get('presenter');


  // create directory map
  readdir(modulePath, function (error, list) {
    if (error) return callback(error, null);

    // save directory map
    self.build.modules.dirMap = list.map(function (value) {
      return value.slice(modulePath.length);
    });

    // create directory map
    readdir(presenterPath, function (error, list) {
      if (error) return callback(error, null);

      // save directory map
      self.build.presenter.dirMap = list.map(function (value) {
        return value.slice(presenterPath.length);
      });

      // scan and resolve all packages
      buildPackage(function (error) {
        if (error) return callback(error);

        // execute callback when all files are compiled
        self.compiler.modules.compile(function (error) {
          if (error) return callback(error);

          self.compiler.presenter.compile(function (error) {
            if (error) return callback(error);

            buildMap('modules');
            buildMap('presenter');

            callback();
          });
        });
      });
    });
  });

  // scan and resolve all packages
  function buildPackage(callback) {

    var dirMap = self.build.modules.dirMap,
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
      self.build.modules.packageMap = final;
      callback(null, null);
    });
  }

  // rebuild dependency tree
  function buildMap(rootname) {
    var dependencies = self.build[rootname].dependencies = {};
    var cacheTime = self.cache[rootname].stats;
    var buildTime = self.build[rootname].mtime;

    Object.keys(cacheTime).forEach(function (filepath) {
      buildTime[filepath] = cacheTime[filepath].getTime();
    });

    // deep resolve all dependencies
    self.build[rootname].dirMap.forEach(function (filename) {
      var list = { modules: [], presenter: [] };

      // the result array will be filled by his function
      deepResolve(self, rootname, filename, list);

      // dry result array
      var result = dependencies[filename] = { modules: [], presenter: [] };

      Object.keys(list).forEach(function (rootname) {
        var arr = list[rootname];
        var i = arr.length;
        while(i--) {
          if (result[rootname].indexOf(arr[i]) === -1) {
            result[rootname].push(arr[i]);
          }
        }
      });
    });
  }

};

function deepResolve(self, searchname, filepath, result) {

  // get no deep dependencies
  var cache = self.cache[searchname].dependencies[filepath];
  var build = self.build[searchname].dependencies[filepath];

  // don't double resolve this
  if (result[searchname].indexOf(filepath) !== -1) {
    return;
  }
  result[searchname].push(filepath);

  // this filepath has already been resolved
  if (build && build[searchname]) {
    result[searchname].push.apply(result[searchname], build[searchname]);
    return;
  }

  // Deep resolve cache
  if (cache) {
    Object.keys(cache).forEach(function (searchname) {
      cache[searchname].forEach(function (filepath) {
        deepResolve(self, searchname, filepath, result);
      });
    });
  }
}

function appendModule(self, output, moduleobj) {
  var rootname = moduleobj.rootname;
  var filepath = moduleobj.filepath;

  return function (callback) {
    var stream;

    // append XML CDATA+TAG start
    output.write('<module root="' + rootname + '" path="' + filepath + '"><![CDATA[');

    // append source code content to output
    stream = self.compiler[rootname].read(filepath);
    stream.pipe(output, {end: false});
    stream.once('end', function () {
      output.write(']]></module>');
      callback();
    });
    stream.resume();
  };
}

function dependenciesList(self, rootname, filepath, cache) {
  // default cache to no cache
  if (!cache) cache = { presenter: [], modules: [] };
  var response = { presenter: [], modules: [] };

  // get prebuild dependencies map
  var dependencies = self.build[rootname].dependencies[filepath];

  // don't include cached files
  Object.keys(dependencies).forEach(function (rootname) {
    response[rootname] = dependencies[rootname].filter(function (filepath) {
      return (cache[rootname].indexOf(filepath) === -1);
    });
  });

  return response;
}

function transformDependecies(dependencies) {
  var trans = [];
  Object.keys(dependencies).forEach(function (rootname) {
    dependencies[rootname].forEach(function (filepath) {
      trans.push({ 'filepath': filepath, 'rootname': rootname });
    });
  });

  return trans;
}

// returns an readstream containing the requested module and all nessearry dependencies
Dependencies.prototype.readClient = function (rootname, modulename, cache) {
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
  var filepath = self.resolveModule(rootname, '/', modulename);

  // get prebuild dependencies map
  var dependencies = dependenciesList(self, rootname, filepath, cache);

  // find the highest mtime
  var mtime = 0;
  Object.keys(dependencies).forEach(function (rootname) {
    var cacheTime = self.build[rootname].mtime;

    dependencies[rootname].forEach(function (filepath) {
      var time = cacheTime[filepath];
      if (mtime < time) {
        mtime = time;
      }
    });
  });

  // Transform dependencies map
  dependencies = transformDependecies(dependencies);

  // set mtime info
  output.mtime = new Date(mtime);

  // since resolveModule can be sync, so just to be sure wait until next tick
  process.nextTick(function () {
    output.emit('ready');

    // compile an execution list
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

function handleMap(self, moduleobj, callback) {
  var rootname = moduleobj.rootname;
  var filepath = path.resolve(self.piccolo.get(rootname), './' + moduleobj.filepath);

  // create response object
  var modulePath = self.piccolo.get(rootname);
  var response = {
    'rootname': rootname,
    'key': filepath.slice(modulePath.length)
  };

  fs.readFile(filepath, 'utf8', function (error, content) {
    if (error) return callback(error, null);

    response.value = removeBOM(content);
    callback(null, response);
  });
}

Dependencies.prototype.readServer = function (rootname, filepath, cache, callback) {
  var self = this;

  // get prebuild dependencies map
  var dependencies = dependenciesList(self, rootname, filepath, cache);

  // Transform dependencies map
  dependencies = transformDependecies(dependencies);

  async.map(dependencies, handleMap.bind(null, self), function (error, result) {
    if (error) return callback(error, null);

    var map = { presenter: {}, modules: {} };
    result.forEach(function (obj) {
      map[obj.rootname][obj.key] = obj.value;
    });

    callback(null, map);
  });
};
