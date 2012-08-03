
startup.piccoloLinkHandler = function (piccolo) {
  var url = piccolo.require('url'),
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
  function onLinkClick(event) {
    // Resolve anchor link
    var page = url.format( url.resolve(location, this.getAttribute('href')) );

    // Load new page
    piccolo.loadPage( page );
    event.preventDefault();
    return false;
  }

  piccolo.handleLink = function (link) {
    link.removeEventListener('click', onLinkClick);
    link.addEventListener('click', onLinkClick);
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
    // Get presenter object
    piccolo.require(state.resolved.name, function (error, Resource) {
      if (error) return piccolo.emit('error', error);

      var presenter = new Resource(state.query.href, document);
          presenter[state.resolved.method].apply(presenter, state.resolved.args);
    });
  }

  // Parse a page path and return state object
  var stateWaitList = [];
  function createStateObject(page, callback) {

    // This callback function will create a change table state object
    var create = function () {
      var query = url.parse(page);
      var presenter = piccolo.router.parse(query.pathname);

      var state = {
        'resolved': presenter,
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
      if (firstCall) {
        firstCall = true;
        return;
      }

      // We won't want to render the page when the user reload the page,
      // since this has been done on the server side.
      var state = (event.state === null ? startPage : event.state);
      renderPage(state);
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
};
