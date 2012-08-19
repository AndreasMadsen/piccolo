
# Piccolo

In general the `piccolo` object is the only part of the piccolo framework there
dosn't have a isomorphic API.

In a **browser** the `piccolo` is automaticly created and set on the `window`
object.

```JavaScript
var project = window.piccolo;
```

In **node** you create a `piccolo` object with the exposed function from
`require('piccolo')`.

```JavaScript
var piccolo = require('piccolo');
var project = piccolo();
```

## Isomorphic

### project.require(modulename, callback)

This method is used for getting isomorpic modules from a non-piccolo environment.
Because this method is called form outside the piccolo framework, the static
module analyser can't predict and preload the the given `modulename` and a
callback is required.

The `callback` is executed with an `error` argument and a module value, there
is excatly the same as what you would normally get from `require(modulename)`
if it where executed from inside the piccolo framework.

## Node

### project.configure([environment], fn)

This method is used for environmental configuration of the piccolo framework.

The `fn` function will be executed once `project.use(environment)` is called
but only if the `environment` variable match. Note if no `environment` argument
is used the `fn` will be called no matter what the given `environment` is.

### project.use(environment)

Will execute the `fn` defined with `project.configure([environment], fn)`.

The execution order is:

1. any environment (no `environment` argument)
2. spefic environment (a `environment` argument was used)

### project.set(name, value)

The following settings are possibol:

#### root

Sets the directory that the `temp`, `static`, `template` and `modules` directories
will be relative to.

#### temp

path to where the build files will be stored. Default value is `./temp/`.

#### static

path to where the static files are stored. Default value is `./static/`.

#### template

path to where the template files are stored. Default value is `./template/`.

#### modules

path to where the isomorphic are stored. Default value is `./modules/`.

#### reload

If set to `true` the `static` and `template` files will be automaticly
reloaded once changed. Useful in a development environment. Default value is
`false`.

#### cache

If set to a number the `static`, `template` and `modules` files will be send to
the client along with `cache` headers and a 304 http status code will be send
if the cache headers match. The number will be the max age of the files. Useful
in a production environment. Default value is `"none"`.

#### compress

Files will be compressed by a static analyser before send. Default is `false`.

#### router

The `modulename` of a router module, the default router is a internal file.

#### debug

Will add extra output logging. Default value is `false`.

### project.get(name)

Will return the value defined by `project.set(name, value)` or the default
settings value.

### project.build()

Will create a temporary directory at the `project.get('temp')` path. Once
all build files has been created the `ready` event will emit.

### piccolo.route(req, res)

Will relay the client `request` and output on the `response` object.

```JavaScript
http.createServer(function (req, res) {
  project.route(req, res);
}).listen(8000);
```

## Browser

### project.nextTick(callback)

The same as `process.nextTick(callback)` in a node environment.
