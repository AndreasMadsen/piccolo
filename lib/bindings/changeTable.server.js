
// Will contain manipulated template cache
var templateCache = {};

// Get tag position, it is assumed that there are no tags inside the tag itself
function getTagPosition(content, tag, id) {
  var res = {}, pos = 0, attr;

  var i = 0;

  while (true) {
    i++; if (i == 5) break;
    res.start = content.indexOf('<' + tag, pos);
    res.contentStart = content.indexOf('>', res.start) + 1;

    // set next search position
    pos = res.contentStart;

    if (res.start === -1) {
      throw new Error('a element with the tag name "' + tag + '" was not found.');
    }

    if (id !== undefined) {
      attr = content.indexOf('id="' + id + '"', res.start);
    }

    if (id === undefined || attr > res.start && attr < res.contentStart) {
      res.contentEnd = content.indexOf('</' + tag, res.contentStart);
      res.end = content.indexOf('>', res.contentEnd) + 1;
      break;
    }
  }

  return res;
}

// Internal send chunk method
function sendChunk(self, index) {
  var chunk = self.internal.content.substr(self.internal.current, index - self.internal.current);
  self.internal.current = index;
  self.internal.stream.write(chunk);

  // end response
  if (index === self.internal.content.length) {
    self.internal.stream.end();
  }
}

// create stack handler
function createStackHandler(self) {
  var list = [];

  return {
    paused: false,
    pause: function () {
      this.paused = true;
    },
    resume: function () {
      this.paused = false;
      while (list.length !== 0 && this.paused === false) {
        var handle = list.shift();
        self[handle.fn].apply(self, handle.args);
      }
    },
    push: function (obj) {
      list.push(obj);
    }
  };
}

// changeTableAbstract constructor where arguments
// will be stored and initial properties set
function changeTableAbstract(stream, piccolo, modules) {
  this.internal = {
    // Store given argument
    stream: stream,
    piccolo: piccolo,
    modules: modules,

    // create paused stack
    stack: createStackHandler(this),

    // Store template content
    current: 0,
    content: ''
  };

  this.internal.stack.pause();
}
module.exports = changeTableAbstract;

// Set template to a given path
changeTableAbstract.prototype.template = function (templatePath) {
  var self = this;

  // Save template path
  this.internal.template = path;

  // Get file system modules
  var fs = this.internal.modules.fs,
      path = this.internal.modules.path;

  // Get template content from cache
  if (templateCache[templatePath]) {
    this.internal.content = templateCache[templatePath];

    // Send chunk until the title tag
    sendChunk(this, getTagPosition(this.internal.content, 'title').start);

    // Resume stack handler
    this.internal.stack.resume();
    return;
  }

  // Load template file
  var directory = this.internal.piccolo.get('template');
  fs.readFile(path.join(directory, templatePath), 'utf8', function (error, content) {
    if (error) return self.internal.piccolo.emit('error', error);

    // Manipulate template with meta and script tag
    var addition = '<meta name="piccolo-template" content="' + templatePath + '">' +
                   '<script src="/piccolo/framework.js"></script>';

    var title = getTagPosition(content, 'title');
    var before = content.substr(0, title.end);
    var after = content.substr(title.end, content.length - title.end);

    // Save content in this instance and in permanent buffer
    templateCache[templatePath] = self.internal.content = (before + addition + after);

    // Send chunk until the title tag
    sendChunk(self, title.start);

    // Resume stack handler
    self.internal.stack.resume();
  });
};

// Set document title
changeTableAbstract.prototype.title = function (headline) {

  // Add function to stack list if its paused
  if (this.internal.stack.paused) {
    this.internal.stack.push({
      'fn': 'title',
      'args': arguments
    });

    return;
  }

  // Split content up between before and after the title tags content
  var title = getTagPosition(this.internal.content, 'title');

  // Send chunk after the title tag
  sendChunk(this, title.contentStart);
  this.internal.stream.write(headline);
  sendChunk(this, title.end);
};

// Send content without replaceing it
changeTableAbstract.prototype.content = function (content, tag, id) {

  // Add function to stack list if its paused
  if (this.internal.stack.paused) {
    this.internal.stack.push({
      'fn': 'content',
      'args': arguments
    });

    return;
  }

  //  get element position
  var box = getTagPosition(this.internal.content, tag, id);

  sendChunk(this, box.contentStart);
  this.internal.stream.write(content);
  sendChunk(this, this.internal.content.length);
};
