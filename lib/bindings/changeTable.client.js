
// In order to know if the template has changed without loading and executeing
// a changeTable a meta data is set. Since the meta tag is placed before the
// framework script tag, we don't need to wait for DOM tree to be loaded.
var templatePath;
var metaData = document.getElementsByTagName('meta');
var i = metaData.length;
while (i--) {
  if (metaData[i].getAttribute('name') === 'piccolo-template') {
    templatePath = metaData[i].getAttribute('content');
  }
}

// Remove all children from element
function clearElement(element) {
  while(element.hasChildNodes()) {
    element.removeChild(element.firstChild);
  }
}

// changeTableAbstract constructor where arguments
// will be stored and initial properties set
function changeTableAbstract(document, query) {
  this.internal = {
    // save given arguments
    document: document,
    query: query,

    template: false
  };

}
exports = changeTableAbstract;

// Set template to a given path
changeTableAbstract.prototype.template = function (path) {

  // Save template path
  this.internal.template = path;

  // If the template changes, so much has changed
  // that a partial reload is not worth the effort
  if (templatePath !== path) {
    console.log('set new path', templatePath, path);
    //window.location.href = this.internal.query.href;
  }
};

// Set document title
changeTableAbstract.prototype.title = function (headline) {
  var document = this.internal.document;

  // Get title element
  var title = this.internal.document.getElementsByTagName('title')[0];

  // Set title
  clearElement(title);
  title.appendChild(document.createTextNode(headline));
};

// Set content
changeTableAbstract.prototype.content = function (content, tag, id) {
  var document = this.internal.document;

  // get element
  var elem;
  if (id) {
    elem = document.getElementById(id);
  } else {
    elem = document.getElementsByTagName(tag)[0];
  }

  // Replace content
  if (elem.insertAdjacentHTML) {
    clearElement(elem);
    elem.insertAdjacentHTML('afterbegin', content);
  } else {
    elem.innerHTML = content;
  }

  // Parse all links
  piccolo.handleLinks(elem);
};
