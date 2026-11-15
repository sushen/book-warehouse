(function () {
  'use strict';

  var KEY = 'book-warehouse-demo-v1';
  var STAGES = ['requested', 'ready', 'borrowed', 'returned'];

  function makeStore(data, storage) {
    var books = data.books;
    var bookIds = new Set(books.map(function (book) { return book.id; }));
    var requests = [];
    var nextId = 1;
    var notice = '';
    var storageWorks = !!storage;
    var noticeCode = '';

    function validSnapshot(snapshot) {
      if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.requests) || !Number.isSafeInteger(snapshot.nextId) || snapshot.nextId < 1) return false;
      var ids = new Set();
      var active = new Set();
      for (var i = 0; i < snapshot.requests.length; i++) {
        var request = snapshot.requests[i];
        if (!request || !Number.isSafeInteger(request.id) || request.id < 1 || request.id >= snapshot.nextId || ids.has(request.id) || !bookIds.has(request.bookId) || !STAGES.includes(request.stage)) return false;
        if (request.stage !== 'returned') {
          if (active.has(request.bookId)) return false;
          active.add(request.bookId);
        }
        ids.add(request.id);
      }
      return true;
    }

    try {
      if (storage) {
        var raw = storage.getItem(KEY);
        if (raw !== null) {
          var saved = JSON.parse(raw);
          if (!validSnapshot(saved)) throw new Error('Invalid demo state');
          requests = saved.requests.map(function (request) { return { id: request.id, bookId: request.bookId, stage: request.stage }; });
          nextId = saved.nextId;
        }
      } else {
        notice = 'Browser storage is unavailable. Changes will last only until this page closes.';
        noticeCode = 'noticeUnavailable';
      }
    } catch (error) {
      if (error instanceof SyntaxError || error.message === 'Invalid demo state') {
        notice = 'Saved demo data could not be read. A fresh demo is shown.';
        noticeCode = 'noticeInvalid';
      } else {
        storageWorks = false;
        notice = 'Browser storage is unavailable. Changes will last only until this page closes.';
        noticeCode = 'noticeUnavailable';
      }
    }

    function save() {
      if (!storageWorks) return;
      try {
        storage.setItem(KEY, JSON.stringify({ version: 1, nextId: nextId, requests: requests }));
      } catch (error) {
        storageWorks = false;
        notice = 'Browser storage is unavailable. Changes will last only until this page closes.';
        noticeCode = 'noticeUnavailable';
      }
    }

    function activeRequest(bookId) {
      return requests.find(function (request) { return request.bookId === bookId && request.stage !== 'returned'; });
    }

    return {
      getNotice: function () { return notice; },
      getNoticeCode: function () { return noticeCode; },
      listBooks: function () { return books.slice(); },
      findBooks: function (query, locationId, availability) {
        var term = query.trim().toLocaleLowerCase();
        return books.filter(function (book) {
          var searchable = [book.title, book.titleBn, book.author, book.authorBn, book.category, book.topics, book.topicsBn].join(' ').toLocaleLowerCase();
          return (!term || searchable.includes(term)) &&
            (locationId === 'all' || book.locationId === locationId) &&
            (availability === 'all' || (availability === 'available') === !activeRequest(book.id));
        });
      },
      listLocations: function () { return data.locations.slice(); },
      listRequests: function () { return requests.slice().reverse().map(function (request) { return Object.assign({}, request); }); },
      isAvailable: function (bookId) { return bookIds.has(bookId) && !activeRequest(bookId); },
      createRequest: function (bookId) {
        if (!bookIds.has(bookId)) return { ok: false, code: 'requestUnknownBook', message: 'This copy is not in the sample catalogue.' };
        if (activeRequest(bookId)) return { ok: false, code: 'requestDuplicate', message: 'This copy already has an active demo request.' };
        var request = { id: nextId++, bookId: bookId, stage: 'requested' };
        requests.push(request);
        save();
        return { ok: true, code: 'requestCreated', request: Object.assign({}, request), message: 'Demo request created. No real reservation was sent.' };
      },
      advanceRequest: function (id, nextStage) {
        var request = requests.find(function (item) { return item.id === id; });
        if (!request) return { ok: false, code: 'requestMissing', message: 'Demo request not found.' };
        var index = STAGES.indexOf(request.stage);
        if (index === STAGES.length - 1 || STAGES[index + 1] !== nextStage) return { ok: false, code: 'stageInvalid', message: 'That status change is not allowed.' };
        request.stage = nextStage;
        save();
        return { ok: true, code: 'stageChanged', stage: nextStage, message: 'Demo status changed to ' + nextStage + '.' };
      },
      reset: function () {
        requests = [];
        nextId = 1;
        if (storageWorks) {
          try { storage.removeItem(KEY); }
          catch (error) {
            storageWorks = false;
            notice = 'Browser storage is unavailable. Changes will last only until this page closes.';
            noticeCode = 'noticeUnavailable';
          }
        }
        return { ok: true, code: 'resetDone', message: 'Demo reset. All sample copies are available again.' };
      }
    };
  }

  window.BookWarehouseStore = { create: makeStore, key: KEY };
}());
