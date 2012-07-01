
startup.piccoloNextTick = function (piccolo) {
  var queue = [],
      dirty = false,
      hasPostMessage = !!window.postMessage,
      messageName = 'nexttick',
      trigger;

  // use window.postMessage as trigger when supported
  if (hasPostMessage) {
    trigger = function () {
      window.postMessage(messageName, '*');
    };
  } else {
    trigger = function() {
      setTimeout(flushQueue, 0);
    };
  }

  // execute all functions in query
  function flushQueue() {
    var fn;
    while (fn = queue.shift()) {
      fn();
    }
    dirty = false;
  }

  // attach flushQuery listener
  if (hasPostMessage) {
    window.addEventListener('message', function (event) {
      if (event.source === window && event.data === messageName) {
        event.stopPropagation();
        flushQueue();
      }
    }, true);
  }

  piccolo.nextTick = function(fn) {
    // add function to query
    queue.push(fn);

    // start nextTick trigger if none is in query
    if (dirty === false) {
      dirty = true;
      trigger();
    }
  };
};
