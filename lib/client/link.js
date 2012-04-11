
(function () {

  var url = NativeModule.url,
      location = window.location,
      history = window.history;

  // Load a new page the piccolo alternative to window.location = page
  piccolo.loadPage = function (page) {

    // Create state object
    createStateObject(page, function (state) {

      // Set new url and store the state in it
      history.pushState(state, '', page);

      // Since popstate don't emit when doing a history.pushState
      // we will manually render the page
      renderPage(state);
    });
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
    // Get all links
    var links = element.getElementsByTagName('a'),
        i = links.length;

    // Add handlers to all links
    while(i--) piccolo.handleLink(links[i]);
  };

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
          changeTable[state.changeTable.method].apply(changeTable, state.changeTable.args);
    });
  }

  // Parse a page path and return state object
  var stateWaitList = [];
  function createStateObject(page, callback) {

    // This callback function will create a change table state object
    var create = function () {
      var query = url.parse(page);
      var changeTable = piccolo.router.parse(query.pathname);

      var state = {
        'changeTable': changeTable,
        'namespace': 'piccolo',
        'query': query
      };

      callback(state);
    };

    // in case the router hasn't been loaded, store the create function to later
    if (piccolo.router === null) {
      return stateWaitList.push(create);
    }

    // If the router exist execute the create function now
    create();
  }

  // Popstate will give a null value if the page was reloaded from it,
  // this will store the page state information for that page
  createStateObject(location.pathname, function (startPage)  {

    // Add page changed table
    var firstCall = true;
    window.addEventListener('popstate', function (event) {
      // We won't want to render the page when the user reload the page,
      // since this has been done on the server side.
      if (firstCall === false) {
        var state = (event.state === null ? startPage : event.state);
        renderPage(state);
        return;
      }
      firstCall = false;
    });
  });

  // Rewrite link when document is loaded
  piccolo.once('ready', function () {
    piccolo.handleLinks(document);
  });

  // Execute stateWaitList when the router module has been created
  piccolo.once('init', function () {
    var i = stateWaitList.length;
    while(i--) {
      stateWaitList[i]();
    }
  });

})();
