
var vm = require('vm');

function compileModule(piccolo) {

  var bindingSource = piccolo.build.bindingSource;
  var moduleSource = piccolo.build.moduleSource;

  var wrapper = [
    '(function (exports, require, module, piccolo, __filename, __dirname) {',
    '\n});'
  ];

  // wrap module.js source code
  var source = wrapper[0] + moduleSource.module + wrapper[1];

  // Create module object
  var module = {
    filename: 'module.js',
    exports: {}
  };

  // return compiled wrapper function
  var fn = vm.runInThisContext(source, module.filename);

  // create dum require function
  function requireWrap() {
    throw new Error("require can't be called in module.js");
  }

  // compiled bindings will be cached here
  var bindingCache = {
    natives: moduleSource
  };

  // create binding wrapper
  requireWrap.binding = function (bindingname) {
    if (bindingCache.hasOwnProperty(bindingname)) {
      return bindingCache[bindingname];
    }

    if (bindingSource.hasOwnProperty(bindingname) === false) {
      throw new Error('the binding ' + bindingname + ' do not exist');
    }

    // compile binding
    var binding = {
      filename: bindingname + '.js',
      exports: {}
    };
    var source = wrapper[0] + bindingSource[bindingname] + wrapper[1];
    var fn = vm.runInThisContext(source, binding.filename);

    // execute compiled binding function
    // note `require` links to node require (that is the binding)
    fn(binding.exports, require, binding, piccolo, binding.filename);

    // save and return exports result
    bindingCache[bindingname] = binding.exports;
    return binding.exports;
  };

  fn(module.exports, requireWrap, module, piccolo, module.filename);
  return module.exports;
}
module.exports = compileModule;
