(function () {
  'use strict';

  var storage;
  try { storage = window.localStorage; } catch (error) { storage = null; }
  var store = window.BookWarehouseStore.create(window.BookWarehouseSample, storage);
  var books = store.listBooks();
  var locations = store.listLocations();
  var byId = Object.fromEntries(books.map(function (book) { return [book.id, book]; }));
  var locationById = Object.fromEntries(locations.map(function (location) { return [location.id, location]; }));
  var search = document.getElementById('search');
  var locationFilter = document.getElementById('location');
  var availabilityFilter = document.getElementById('availability');
  var list = document.getElementById('book-list');
  var requestList = document.getElementById('request-list');
  var feedback = document.getElementById('action-feedback');
  var stages = ['requested', 'ready', 'borrowed', 'returned'];
  var stageLabels = { requested: 'Requested', ready: 'Ready for collection', borrowed: 'Borrowed', returned: 'Returned' };
  var nextLabels = { requested: 'Mark ready for collection', ready: 'Mark borrowed', borrowed: 'Mark returned' };

  locations.forEach(function (place) {
    var option = document.createElement('option');
    option.value = place.id;
    option.textContent = place.name + ' (fictional)';
    locationFilter.appendChild(option);
  });

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function announce(message) {
    feedback.textContent = message;
    var notice = store.getNotice();
    var storageNotice = document.getElementById('storage-notice');
    storageNotice.textContent = notice;
    storageNotice.hidden = !notice;
  }

  function bookCard(book) {
    var available = store.isAvailable(book.id);
    var article = element('article', 'book-card');
    var cover = element('div', 'book-cover cover-' + (Number(book.id.slice(1)) % 4));
    cover.setAttribute('aria-hidden', 'true');
    cover.appendChild(element('span', 'cover-small', 'BOOK WAREHOUSE · SAMPLE'));
    cover.appendChild(element('span', 'cover-title', book.title));
    article.appendChild(cover);
    var body = element('div', 'book-body');
    body.appendChild(element('p', 'book-category', book.category + ' · ' + book.language));
    body.appendChild(element('h3', '', book.title));
    body.appendChild(element('p', 'book-author', 'by ' + book.author));
    body.appendChild(element('p', 'book-location', locationById[book.locationId].name + ' · fictional location'));
    var foot = element('div', 'book-foot');
    foot.appendChild(element('span', available ? 'availability available' : 'availability unavailable', available ? 'Available' : 'In demo journey'));
    var button = element('button', 'request-button', available ? 'Request copy' : 'Copy unavailable');
    button.type = 'button';
    button.disabled = !available;
    button.setAttribute('aria-label', available ? 'Create demo request for ' + book.title : book.title + ' is unavailable');
    button.addEventListener('click', function () {
      var result = store.createRequest(book.id);
      render();
      announce(result.message);
      if (result.ok) {
        document.getElementById('journey').scrollIntoView({ behavior: 'smooth' });
        var firstAction = requestList.querySelector('button');
        if (firstAction) firstAction.focus({ preventScroll: true });
      }
    });
    foot.appendChild(button);
    body.appendChild(foot);
    article.appendChild(body);
    return article;
  }

  function renderBooks() {
    var filtered = store.findBooks(search.value, locationFilter.value, availabilityFilter.value);
    list.replaceChildren();
    filtered.forEach(function (book) { list.appendChild(bookCard(book)); });
    document.getElementById('result-count').textContent = filtered.length + ' of ' + books.length + ' sample copies';
    document.getElementById('empty-results').hidden = filtered.length !== 0;
  }

  function requestCard(request) {
    var book = byId[request.bookId];
    var article = element('article', 'journey-card');
    var summary = element('div', 'journey-summary');
    summary.appendChild(element('p', 'book-category', 'DEMO REQUEST #' + request.id));
    summary.appendChild(element('h3', '', book.title));
    summary.appendChild(element('p', '', locationById[book.locationId].name + ' · fictional location'));
    article.appendChild(summary);
    var progress = element('ol', 'progress-list');
    stages.forEach(function (stage, index) {
      var item = element('li', index <= stages.indexOf(request.stage) ? 'complete' : '', stageLabels[stage]);
      progress.appendChild(item);
    });
    article.appendChild(progress);
    var actions = element('div', 'journey-actions');
    actions.appendChild(element('span', 'stage-pill', stageLabels[request.stage]));
    if (request.stage !== 'returned') {
      var button = element('button', 'button button-dark', nextLabels[request.stage]);
      button.type = 'button';
      button.setAttribute('aria-label', 'Operator simulation: ' + nextLabels[request.stage].toLowerCase() + ' for ' + book.title);
      button.addEventListener('click', function () {
        var result = store.advanceRequest(request.id, stages[stages.indexOf(request.stage) + 1]);
        render();
        announce(result.message + (result.ok && request.stage === 'borrowed' ? ' The copy is available again.' : ''));
        var replacement = requestList.querySelector('[data-request-id="' + request.id + '"] button');
        if (replacement) replacement.focus();
      });
      actions.appendChild(button);
    } else {
      actions.appendChild(element('span', 'finished-note', 'Copy available again'));
    }
    article.appendChild(actions);
    article.dataset.requestId = request.id;
    return article;
  }

  function renderRequests() {
    var requests = store.listRequests();
    requestList.replaceChildren();
    requests.forEach(function (request) { requestList.appendChild(requestCard(request)); });
    document.getElementById('empty-journey').hidden = requests.length > 0;
  }

  function render() { renderBooks(); renderRequests(); }
  function clearFilters() {
    search.value = '';
    locationFilter.value = 'all';
    availabilityFilter.value = 'all';
    renderBooks();
    search.focus();
  }

  document.getElementById('filters').addEventListener('submit', function (event) { event.preventDefault(); renderBooks(); });
  search.addEventListener('input', renderBooks);
  locationFilter.addEventListener('change', renderBooks);
  availabilityFilter.addEventListener('change', renderBooks);
  document.getElementById('clear-filters').addEventListener('click', clearFilters);
  document.getElementById('empty-clear').addEventListener('click', clearFilters);
  document.getElementById('reset-demo').addEventListener('click', function () {
    var result = store.reset();
    render();
    announce(result.message);
  });
  render();
  announce(store.getNotice());
}());
