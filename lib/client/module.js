
startup.piccoloSetupModule = function (primitive) {

  var NativeModuleSource = primitive.build.NativeModuleSource;
  var NativeBinding = primitive.build.NativeBinding;
  var wrapper = [
    '(function (exports, require, module, piccolo, __filename, __dirname) {',
    '\n});'
  ];

  // wrap module.js source code
  var source = wrapper[0] + NativeModuleSource.module + wrapper[1];

  // Create module object
  var module = {
    filename: '/piccolo/module.js',
    exports: {}
  };

  // create dum require function
  function requireWrap() {
    throw new Error("require can't be called in module.js");
  }

  function bindingWrap() {
    throw new Error("require can't be called in client binding");
  }

  // compiled bindings will be cached here
  var bindingCache = {};

  // create binding wrapper
  bindingWrap.binding = requireWrap.binding = function (bindingname) {
    if (bindingCache.hasOwnProperty(bindingname)) {
      return bindingCache[bindingname];
    }

    if (NativeBinding.hasOwnProperty(bindingname) === false) {
      throw new Error('the binding ' + bindingname + ' do not exist');
    }

    // compile binding
    var binding = {
      filename: bindingname + '.js',
      exports: {}
    };

    var fn = NativeBinding[bindingname];


    // execute compiled binding function
    // note `require` links to node require (that is the binding)
    var piccolo = window.piccolo ? window.piccolo : primitive;
    fn(binding.exports, bindingWrap, binding, piccolo, binding.filename);

    // save and return exports result
    bindingCache[bindingname] = binding.exports;
    return binding.exports;
  };

  // return compiled wrapper function
  var compile = requireWrap.binding('compile');
  var fn = compile(source, module.filename);

  fn(module.exports, requireWrap, module, primitive, module.filename);
  return module.exports;
};
