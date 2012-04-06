
(function () {

  var url = NativeModule.url,
      location = window.location,
      history = window.history;

  // Popstate will give a null value if the page was reloaded from it,
  // this will store the page state information for that page
  var startPage = createStateObject(location.href);

  // parse a page path and return state object
  function createStateObject(page) {
    var changeTable = piccolo.router(page);

    return {
      'namespace': 'piccolo',
      'page': page,
      'changeTable': changeTable
    };
  }

  // Render page change
  function renderPage(state) {
    console.log('render:', state);
  }

  // Load a new page the piccolo alternative to window.location = page
  piccolo.loadPage = function (page) {

    var state = createStateObject(page);
    history.pushState(state, '', page);
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
