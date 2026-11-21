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
  var backToTop = document.getElementById('back-to-top');
  var stages = ['requested', 'ready', 'borrowed', 'returned'];
  var localeKey = 'book-warehouse-locale';
  var locale = 'bn';
  var lastFeedback = null;
  try {
    var savedLocale = storage && storage.getItem(localeKey);
    if (savedLocale === 'en' || savedLocale === 'bn') locale = savedLocale;
  } catch (error) { /* The default remains usable without storage. */ }

  function t(key, values) { return window.BookWarehouseLocales.translate(locale, key, values); }
  function bookText(book, field) { return locale === 'bn' ? book[field + 'Bn'] || book[field] : book[field]; }
  function placeName(place) { return place ? (locale === 'bn' ? place.nameBn || place.name : place.name) : ''; }
  function stageLabel(stage) { return t('stage' + stage[0].toUpperCase() + stage.slice(1)); }
  function nextLabel(stage) { return t('next' + stage[0].toUpperCase() + stage.slice(1)); }
  function localizedResult(result, extra) {
    if (!result.code) return result.message;
    var values = result.stage ? { stage: stageLabel(result.stage) } : null;
    return t(result.code, values) + (extra ? t(extra) : '');
  }

  var staticText = {
    '.skip-link': 'skip', '.brand > span:last-child': 'brand', '.site-header nav a[href="#how-it-works"]': 'navHow', '.site-header nav a[href="#catalogue"]': 'navCatalogue', '.site-header nav a[href="#journey"]': 'navJourney',
    '.hero .eyebrow': 'heroEyebrow', '#hero-title': 'brand', '.hero-lede': 'heroLede', '.hero-detail': 'heroDetail', '.hero .button': 'heroLink', '.scene-note': 'sceneNote',
    '#how-it-works .section-heading .eyebrow': 'howEyebrow', '#how-title': 'howTitle', '.steps > div:nth-child(1) h3': 'step1', '.steps > div:nth-child(1) p': 'step1Body', '.steps > div:nth-child(2) h3': 'step2', '.steps > div:nth-child(2) p': 'step2Body', '.steps > div:nth-child(3) h3': 'step3', '.steps > div:nth-child(3) p': 'step3Body',
    '.benefits-grid > div:first-child .eyebrow': 'readersEyebrow', '#benefits-title': 'readersTitle', '.benefits-grid > div:first-child p:last-child': 'readersBody', '.benefits-grid > div:last-child .eyebrow': 'partnersEyebrow', '.benefits-grid > div:last-child h2': 'partnersTitle', '.benefits-grid > div:last-child p:last-child': 'partnersBody',
    '#catalogue .section-top .eyebrow': 'catalogueEyebrow', '#catalogue-title': 'catalogueTitle', '#catalogue .section-top > div:first-child p:last-child': 'catalogueBody', '.demo-note strong': 'demoNoteTitle', '.demo-note span': 'demoNoteBody', 'label[for="search"]': 'searchLabel', 'label[for="location"]': 'locationLabel', '#location option[value="all"]': 'allLocations', 'label[for="availability"]': 'availabilityLabel', '#availability option[value="all"]': 'allCopies', '#availability option[value="available"]': 'available', '#availability option[value="unavailable"]': 'inJourney', '#clear-filters': 'clearFilters', '#empty-results h3': 'noBooks', '#empty-results p': 'noBooksBody', '#empty-clear': 'clearFilters',
    '#journey .section-top .eyebrow': 'journeyEyebrow', '#journey-title': 'journeyTitle', '#journey .section-top > div:first-child p:last-child': 'journeyBody', '#reset-demo': 'reset', '#empty-journey h3': 'noRequests', '#empty-journey p': 'noRequestsBody', '#empty-journey a': 'browse',
    '.vision-band .eyebrow': 'visionEyebrow', '#vision-title': 'visionTitle', '.vision-grid > p': 'visionBody', '.footer-inner span:first-child': 'brand', '.footer-inner span:last-child': 'footer'
  };

  function renderStatic() {
    document.documentElement.lang = locale;
    document.title = t('title');
    document.querySelector('meta[name="description"]').content = t('description');
    Object.keys(staticText).forEach(function (selector) { document.querySelector(selector).textContent = t(staticText[selector]); });
    document.querySelector('.hero .button').appendChild(element('span', '', '↗')).setAttribute('aria-hidden', 'true');
    document.querySelector('.brand').setAttribute('aria-label', t('brandHome'));
    backToTop.setAttribute('aria-label', t('backToTop'));
    document.querySelector('.site-header nav').setAttribute('aria-label', t('nav'));
    var sharedLink = document.getElementById('shared-mode-link');
    sharedLink.hidden = !(window.location && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname));
    sharedLink.textContent = locale === 'bn' ? 'Spark এমুলেটর' : 'Spark emulator';
    document.querySelector('.book-scene').setAttribute('aria-label', t('sceneLabel'));
    search.placeholder = t('searchPlaceholder');
    document.querySelectorAll('[data-locale]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.locale === locale)); });
    locationFilter.querySelectorAll('option:not([value="all"])').forEach(function (option) { option.textContent = t('locationOption', { name: placeName(locationById[option.value]) }); });
  }

  locations.forEach(function (place) {
    var option = document.createElement('option');
    option.value = place.id;
    option.textContent = t('locationOption', { name: placeName(place) });
    locationFilter.appendChild(option);
  });

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function announce(result, extra) {
    lastFeedback = result && typeof result === 'object' ? { result: result, extra: extra } : null;
    feedback.textContent = lastFeedback ? localizedResult(result, extra) : (result || '');
    var notice = store.getNoticeCode() ? t(store.getNoticeCode()) : store.getNotice();
    var storageNotice = document.getElementById('storage-notice');
    storageNotice.textContent = notice;
    storageNotice.hidden = !notice;
  }

  function bookCard(book) {
    var available = store.isAvailable(book.id);
    var article = element('article', 'book-card');
    var cover = element('div', 'book-cover cover-' + (Number(book.id.slice(1)) % 4));
    cover.setAttribute('aria-hidden', 'true');
    cover.appendChild(element('span', 'cover-small', t('sampleCover')));
    cover.appendChild(element('span', 'cover-title', bookText(book, 'title')));
    article.appendChild(cover);
    var body = element('div', 'book-body');
    body.appendChild(element('p', 'book-category', t('categoryLine', { category: t('category' + book.category), language: t('language' + book.language) })));
    body.appendChild(element('h3', '', bookText(book, 'title')));
    body.appendChild(element('p', 'book-author', t('byAuthor', { author: bookText(book, 'author') })));
    body.appendChild(element('p', 'book-location', t('sampleLocation', { name: placeName(locationById[book.locationId]) })));
    var foot = element('div', 'book-foot');
    foot.appendChild(element('span', available ? 'availability available' : 'availability unavailable', t(available ? 'available' : 'inJourney')));
    if (available) {
      var button = element('button', 'request-button', t('requestCopy'));
      button.type = 'button';
      button.setAttribute('aria-label', t('requestAria', { title: bookText(book, 'title') }));
      button.addEventListener('click', function () {
      if (window.location && /^https?:$/.test(window.location.protocol)) {
        window.location.assign('spark.html');
        return;
      }
      var result = store.createRequest(book.id);
      render();
      announce(result);
      if (result.ok) {
        document.getElementById('journey').scrollIntoView({ behavior: 'smooth' });
        var heading = requestList.querySelector('.journey-summary h3');
        if (heading) heading.focus({ preventScroll: true });
      }
      });
      foot.appendChild(button);
    } else {
      foot.appendChild(element('span', 'unavailable-note', t('copyUnavailable')));
    }
    body.appendChild(foot);
    article.appendChild(body);
    return article;
  }

  function renderBooks() {
    if (window.location && /^https?:$/.test(window.location.protocol)) return;
    var filtered = store.findBooks(search.value, locationFilter.value, availabilityFilter.value);
    list.replaceChildren();
    filtered.forEach(function (book) { list.appendChild(bookCard(book)); });
    document.getElementById('result-count').textContent = t('resultCount', { shown: filtered.length, total: books.length });
    document.getElementById('empty-results').hidden = filtered.length !== 0;
    document.getElementById('clear-filters').hidden = !search.value && locationFilter.value === 'all' && availabilityFilter.value === 'all';
  }

  function requestCard(request) {
    var book = byId[request.bookId];
    var article = element('article', 'journey-card');
    var summary = element('div', 'journey-summary');
    summary.appendChild(element('p', 'book-category', t('demoRequest', { id: request.id })));
    var heading = element('h3', '', bookText(book, 'title'));
    heading.tabIndex = -1;
    summary.appendChild(heading);
    summary.appendChild(element('p', '', t('sampleLocation', { name: placeName(locationById[book.locationId]) })));
    summary.appendChild(element('p', 'request-next', t('requestNext' + request.stage[0].toUpperCase() + request.stage.slice(1))));
    article.appendChild(summary);
    var progress = element('ol', 'progress-list');
    stages.forEach(function (stage, index) {
      var item = element('li', index <= stages.indexOf(request.stage) ? 'complete' : '', stageLabel(stage));
      progress.appendChild(item);
    });
    article.appendChild(progress);
    var actions = element('div', 'journey-actions');
    actions.appendChild(element('span', 'stage-pill stage-' + request.stage, stageLabel(request.stage)));
    if (request.stage !== 'returned') {
      var button = element('button', 'button button-dark', nextLabel(request.stage));
      button.type = 'button';
      button.setAttribute('aria-label', t('operatorAria', { action: nextLabel(request.stage), title: bookText(book, 'title') }));
      button.addEventListener('click', function () {
        var result = store.advanceRequest(request.id, stages[stages.indexOf(request.stage) + 1]);
        render();
        announce(result, result.ok && request.stage === 'borrowed' ? 'returnedFeedback' : null);
        var replacement = requestList.querySelector('[data-request-id="' + request.id + '"] button') || requestList.querySelector('[data-request-id="' + request.id + '"] h3');
        if (replacement) replacement.focus();
      });
      actions.appendChild(button);
    } else {
      actions.appendChild(element('span', 'finished-note', t('returnedNote')));
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

  function render() {
    renderStatic();
    renderBooks();
    if (!(window.location && /^https?:$/.test(window.location.protocol))) renderRequests();
  }
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
  document.querySelectorAll('[data-locale]').forEach(function (button) {
    button.addEventListener('click', function () {
      locale = button.dataset.locale;
      try { if (storage) storage.setItem(localeKey, locale); } catch (error) { /* The selection still works for this page. */ }
      render();
      announce(lastFeedback ? lastFeedback.result : null, lastFeedback && lastFeedback.extra);
    });
  });
  document.getElementById('clear-filters').addEventListener('click', clearFilters);
  document.getElementById('empty-clear').addEventListener('click', clearFilters);
  var resetButton = document.getElementById('reset-demo');
  resetButton.addEventListener('click', function () {
    var confirmed = window.confirm(t('resetConfirm'));
    resetButton.focus();
    if (!confirmed) return;
    var result = store.reset();
    render();
    announce(result);
  });
  function updateBackToTop() {
    backToTop.hidden = window.scrollY <= 240;
  }
  window.addEventListener('scroll', updateBackToTop, { passive: true });
  backToTop.addEventListener('click', function () {
    document.querySelector('.brand').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
  render();
  announce(null);
  updateBackToTop();
}());
