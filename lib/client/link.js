
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
  function createStateObject(page, callback) {

    // This callback function will create a change table state object
    var create = function () {
      var query = url.parse(page);
      var presenter = piccolo.build.router.parse(query.pathname);

      var state = {
        'resolved': presenter,
        'namespace': 'piccolo',
        'query': query
      };

      callback(state);
    };

    piccolo.once('ready.router', create);
  }

  // Popstate will give a null value if the page was reloaded from it,
  // this will store the page state information for that page
  createStateObject(location.pathname, function (startPage)  {

    var firstCall = true;
    window.addEventListener('popstate', function (event) {
      // We won't want to render the page when the user reload the page,
      // since this has been done on the server side.
      if (firstCall) {
        firstCall = true;
        return;
      }

      // Use the pre made page state object if .state is null
      var state = (event.state === null ? startPage : event.state);

      // render page
      renderPage(state);
    });
  });

  // rewrite anchor tags
  piccolo.once('ready.dom', function () {
    piccolo.handleLinks(document.getElementsByTagName('body')[0]);
  });
};
