
(function () {

  var url = NativeModule.url,
      router = new piccolo.router(),
      location = window.location,
      history = window.history;

  // Popstate will give a null value if the page was reloaded from it,
  // this will store the page state information for that page
  var startPage = createStateObject(location.pathname);

  // parse a page path and return state object
  function createStateObject(page) {
    var query = url.parse(page);
    var changeTable = router.parse(query.pathname);

    return {
      'changeTable': changeTable,
      'namespace': 'piccolo',
      'query': query
    };
  }

  // Render page change
  function renderPage(state) {
    // Create AJAX query
    var query = {
      pathname: '/piccolo/changeTable/',
      query: {
        path: state.query.pathname
      }
    };

    // Get changeTable using /piccolo/ API
    piccolo.require(url.format(query), function (error, Resource) {
      if (error) return piccolo.emit('error', error);

      var changeTable = new Resource(document, state.query.href);
          changeTable[state.changeTable.method](state.changeTable.args);
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

  // Search a element for links
  piccolo.handleLinks = function (element) {
    // get all links
    var links = element.getElementsByTagName('a'),
        i = links.length;

    // Add handlers to all links
    while(i--) piccolo.handleLink(links[i]);
  };

  // Rewrite link when document is loaded
  document.addEventListener('DOMContentLoaded', function () {
    piccolo.handleLinks(document);
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
