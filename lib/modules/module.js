
var compile = require.binding('compile')
var read = require.binding('read');

// node source: https://github.com/joyent/node/blob/master/src/node.js#L534

// Below you find a minimal module system, which is used to load the node
// core modules found in modules/*.js. All core modules are compiled into
// the binary, so they can be loaded faster.

function NativeModule(id) {
  this.filename = id + '.js';
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

function Module(id, parent) {
  this.id = id;
  this.exports = {};
  this.parent = parent;
  if (parent && parent.children) {
    parent.children.push(this);
  }

  this.filename = id;
  this.children = [];
}
module.exports = Module;

Module._cache = {};
Module._source = {};
Module._pathCache = {};
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
Module._resolveFilename = function(modulename, parent) {

  if (NativeModule.exists(modulename)) {
    return modulename;
  }

  var base = path.resolve('/', path.dirname(parent.filename));

  var isPath = modulename[0] === '.' || modulename[0] === '/';

  // normalize ./ ../ and / relative to base
  if (isPath) {
    modulename = path.resolve(base, modulename);
  }

  // check cache
  var cache = Module._pathCache[base] || (Module._pathCache[base] = {});
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

Module.prototype.require = function(request, callback) {
  var self = this;

  // resolve request to an real filepath
  var filename = Module._resolveFilename(request, this);

  // detect and return compiled cache
  var cachedModule = Module._cache[filename];
  if (cachedModule) {
    if (callback) {
      callback(cachedModule.exports); return;
    }
    return cachedModule.exports;
  }

  // return native module
  if (NativeModule.exists(filename)) {
    if (callback) {
      callback(NativeModule.require(filename)); return;
    }
    return NativeModule.require(filename);
  }

  if (!callback && !Module._source[filename]) {
    throw new Error('Source code of ' + request + ' is not loaded, please use an callback.');
  }

  // the source exist, do an sync compile
  if (Module._source[filename]) {
    if (callback) {
      callback(this.initCompile(filename)); return;
    }
    return this.initCompile(filename);
  }

  // load content async and the compile
  var cache = Object.keys(Module._cache).concat(Object.keys(Module._source));
  read(filename, cache, function (error, contents) {
    if (error) throw error;

    for (var filepath in contents) {
      if (contents.hasOwnProperty(filepath) === false) return;

      if (!Module._cache[filepath] && !Module._source[filepath]) {
        Module._source[filepath] = contents[filepath];
      }
    }

    // compile module
    callback(null, self.initCompile(filename));
  });
};

Module.prototype._initCompile = function (filename) {

  // create new module
  var module = new Module(filename, this);
  Module._cache[filename] = module;

  // get compile functions
  var extension = path.extname(filename) || '.js';
  if (!Module._extensions[extension]) extension = '.js';

  // link source temporary
  module.source = Module._source[filename];

  // compile sourcecode,
  // the try finally will cleanup after any error but stil throw
  var hadException = true;
  try {
    Module._extensions[extension](this, filename);
    hadException = false;
  } finally {
    if (hadException) {
      delete Module._cache[filename];
    } else {
      delete Module._source[filename];
    }
  }

  delete module.source;
  return module.exports;
};

Module.prototype._compile = function(content, filename) {
  var self = this;

  // create require function
  function require(path) {
    return self.require(path);
  }

  require.resolve = function(request) {
    return Module._resolveFilename(request, self);
  };

  require.extensions = Module._extensions;
  require.cache = Module._cache;

  // create wrapper function
  var wrapper = Module.wrap(content);
  var compiledWrapper = compile(wrapper, filename);

  var args = [this.exports, require, this, piccolo, this.filename, path.dirname(this.filename)];
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
