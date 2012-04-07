
(function () {

  var url = NativeModule.url,
      router = new NativeModule.router(),
      location = window.location,
      history = window.history;

  // Popstate will give a null value if the page was reloaded from it,
  // this will store the page state information for that page
  var startPage = createStateObject(location.pathname);

  // In order to know if the template has changed without loading and executeing
  // a changeTable a meta data is set. Since the meta tag is placed before the
  // framework script tag, we don't need to wait for DOM tree to be loaded.
  var templatePath;
  var metaData = document.getElementsByTagName('meta');
  var i = metaData.length;
  while (i--) {
    if (metaData[i].getAttribute('http-equiv') === 'X-piccolo-template') {
      templatePath = metaData[i].getAttribute('content');
    }
  }

  // parse a page path and return state object
  function createStateObject(page) {
    var pathname = url.parse(page).pathname;
    var changeTable = router.parse(pathname);

    return {
      'namespace': 'piccolo',
      'page': pathname,
      'changeTable': changeTable
    };
  }

  // Render page change
  function renderPage(state) {
    // Create AJAX query
    var query = {
      pathname: '/piccolo/changeTable/',
      query: {
        path: state.page
      }
    };

    // Get changeTable using /piccolo/ API
    piccolo.require(url.format(query), function (error, Resource) {
      if (error) return piccolo.emit('error', error);

      var changeTable = new Resource(document);
          changeTable[state.method](state.args);
    });
  }

  // Load a new page the piccolo alternative to window.location = page
  piccolo.loadPage = function (page) {

    // Create state object
    var state = createStateObject(page);

    // Set new url and store the state in it
    history.pushState(state, '', page);

    // Since popstate don't emit when doing a history.pushState
    // we will manually render the page
    renderPage(state);
  };

  // Add handlers to anchor tag
  piccolo.handleLink = function (link) {
    link.addEventListener('click', function (event) {
      // Resolve anchor link
      var page = url.format( url.resolve(location, link.getAttribute('href')) );

      // Load new page
      piccolo.loadPage( page );
      event.preventDefault();
      return false;
    });
  };

  // Rewrite link when document is loaded
  document.addEventListener('DOMContentLoaded', function () {
    // get all links
    var links = document.getElementsByTagName('a'),
        i = links.length;

    // Add handlers to all links
    while(i--) piccolo.handleLink(links[i]);
  }, false);

  // Add page changed table
  var firstCall = true;
  window.addEventListener('popstate', function (event) {
    // we won't want the render the page when the user reload the page
    if (firstCall === false) {
      var state = (event.state === null ? startPage : event.state);
      renderPage(state);
      return;
    }
    firstCall = false;
  });

})();
