
var build = piccolo.build.dependencies.build;

Object.keys(build).forEach(function (rootname) {
  exports[rootname] = {
    dirMap: build[rootname].dirMap,
    packageMap: build[rootname].packageMap
  };
});
