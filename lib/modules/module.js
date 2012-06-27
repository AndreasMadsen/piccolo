
var compile = require.binding('compile')
var read = require.binding('read');
var moduleMap = require.binding('map');

// node source: https://github.com/joyent/node/blob/master/src/node.js#L534

// Below you find a minimal module system, which is used to load the node
// core modules found in modules/*.js. All core modules are compiled into
// the binary, so they can be loaded faster.

function NativeModule(id) {
  this.filename = '/piccolo/' + id + '.js';
  this.id = id;
  this.exports = {};
}

NativeModule._source = require.binding('natives');
NativeModule._cache = {};

NativeModule.require = function(id) {
  if (id === 'module') {
    return module.exports;
  }

  var cached = NativeModule.getCached(id);
  if (cached) {
    return cached.exports;
  }

  if (!NativeModule.exists(id)) {
    throw new Error('No such native module ' + id);
  }

  var nativeModule = new NativeModule(id);

  nativeModule.compile();
  nativeModule.cache();

  return nativeModule.exports;
};

NativeModule.getCached = function(id) {
  return NativeModule._cache[id];
};

NativeModule.exists = function(id) {
  return NativeModule._source.hasOwnProperty(id);
};

NativeModule.getSource = function(id) {
  return NativeModule._source[id];
};

NativeModule.wrap = function(script) {
  return NativeModule.wrapper[0] + script + NativeModule.wrapper[1];
};

NativeModule.wrapper = [
  '(function (exports, require, module, piccolo, __filename, __dirname) { ',
  '\n});'
];

NativeModule.prototype.compile = function() {
  var source = NativeModule.getSource(this.id);
  source = NativeModule.wrap(source);

  var fn = compile(source, this.filename);
  fn(this.exports, NativeModule.require, this, piccolo, this.filename);
};

NativeModule.prototype.cache = function() {
  NativeModule._cache[this.id] = this;
};

// node source: https://github.com/joyent/node/blob/master/lib/module.js
// And minimized version of the node module system

var path = NativeModule.require('path');
var build = piccolo.build.dependencies.build;
var dirMap = build.dirMap;
var packageMap = build.packageMap;

function Module(id, rootname, parent) {
  this.id = id;
  this.exports = {};
  this.parent = parent;
  this.rootname = rootname;
  if (parent && parent.children) {
    parent.children.push(this);
  }

  this.filename = id;
  this.children = [];
}
module.exports = Module;

Module._cache = { presenter: {}, modules: {} };
Module._source = { presenter: {}, modules: {} };
Module._pathCache = { presenter: {}, modules: {} };
Module._extensions = {};

Module.wrapper = NativeModule.wrapper;
Module.wrap = NativeModule.wrap;

// search array and return the search argument or false if not found
function searchArray(list, value) {
  var index = list.indexOf(value);

  if (index === -1) return false;
  return value;
}

// !! Be sure to update /build/dependencies.js as well (TODO: dry this intro module.js)
Module._resolveFilename = function(rootname, modulename, parent) {

  if (NativeModule.exists(modulename)) {
    return modulename;
  }

  var base = path.resolve('/', path.dirname(parent.filename));
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
  var dirMap = moduleMap[rootname].dirMap;
  var packageMap = moduleMap[rootname].packageMap;

  // check cache
  var cache = Module._pathCache[rootname][base] || (Module._pathCache[rootname][base] = {});
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

function moduleLoader(rootname) {
  return function (request, callback) {
    var self = this;

    // resolve request to an real filepath
    var filename = Module._resolveFilename(rootname, request, this);

    // detect and return compiled cache
    var cachedModule = Module._cache[rootname][filename];
    if (cachedModule) {
      if (callback) {
        callback(cachedModule.exports); return;
      }
      return cachedModule.exports;
    }

    if (rootname === 'modules') {

      // return native module
      if (NativeModule.exists(filename)) {
        if (callback) {
          callback(NativeModule.require(filename)); return;
        }
        return NativeModule.require(filename);
      }
    }

    if (!callback && !Module._source[rootname][filename]) {
      throw new Error('Source code of ' + request + ' is not loaded, please use an callback.');
    }

    // the source exist, do an sync compile
    if (Module._source[rootname][filename]) {
      if (callback) {
        callback(this._initCompile(rootname, filename)); return;
      }
      return this._initCompile(rootname, filename);
    }

    // load content async and the compile
    var cache = {
      modules: Object.keys(Module._cache.modules).concat(Object.keys(Module._source.modules)),
      presenter: Object.keys(Module._cache.presenter).concat(Object.keys(Module._source.presenter)),
    };
    read(rootname, filename, cache, function (error, map) {
      console.log(map);

      if (error) throw error;

      for (var searchname in map) {
        if (map.hasOwnProperty(searchname) === false) return;
        var contents = map[searchname];

        for (var filepath in contents) {
          if (contents.hasOwnProperty(filepath) === false) return;

          if (!Module._cache[searchname][filepath] && !Module._source[searchname][filepath]) {
            Module._source[searchname][filepath] = contents[filepath];
          }
        }
      }

      // compile module
      callback(null, self._initCompile(rootname, filename));
    });
  };
}

Module.prototype.require = moduleLoader('modules');
Module.prototype.persenter = moduleLoader('presenter');

Module.prototype._initCompile = function (rootname, filename) {

  // create new module
  var module = new Module(filename, rootname, this);
  Module._cache[rootname][filename] = module;

  // get compile functions
  var extension = path.extname(filename) || '.js';
  if (!Module._extensions[extension]) extension = '.js';

  // link source temporary
  module.source = Module._source[rootname][filename];

  // compile sourcecode,
  // the try finally will cleanup after any error but stil throw
  var hadException = true;
  try {
    Module._extensions[extension](module, filename);
    hadException = false;
  } finally {
    if (hadException) {
      delete Module._cache[rootname][filename];
    } else {
      delete Module._source[rootname][filename];
    }
  }

  delete module.source;
  return module.exports;
};

var requireWrap = require;
Module.prototype._compile = function(content, filename) {
  var self = this;
  var rootname = this.rootname;

  // create require function
  function require() {
    return self.require.apply(this, arguments);
  };

  require.resolve = function(request) {
    return Module._resolveFilename(rootname, request, self);
  };

  require.presenter = function() {
    return self.presenter.apply(this, arguments);
  };

  require.binding = function () {
    return requireWrap.binding.apply(requireWrap, arguments);
  };

  require.extensions = Module._extensions;
  require.cache = Module._cache;

  // create wrapper function
  var wrapper = Module.wrap(content);
  var compiledWrapper = compile(wrapper, filename);

  var dirname = path.dirname(this.filename);
  var args = [this.exports, require, this, piccolo, this.filename, dirname];
  return compiledWrapper.apply(this.exports, args);
};

// Native extension for .js
Module._extensions['.js'] = function(module, filename) {
  module._compile(module.source, filename);
};

// Native extension for .json
Module._extensions['.json'] = function(module) {
  module.exports = JSON.parse(module.source);
};
