const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const context = { window: {} };
vm.createContext(context);
for (const file of ['sample-data.js', 'demo-store.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}
const data = context.window.BookWarehouseSample;
const create = context.window.BookWarehouseStore.create;
const key = context.window.BookWarehouseStore.key;

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (name) => values.has(name) ? values.get(name) : null,
    setItem: (name, value) => values.set(name, value),
    removeItem: (name) => values.delete(name),
    values
  };
}

test('sample catalogue and combined search filters', () => {
  const store = create(data, memoryStorage());
  assert.equal(store.listBooks().length, 12);
  assert.equal(store.listLocations().length, 2);
  assert.equal(store.findBooks('map', 'all', 'all').length, 1);
  assert.equal(store.findBooks('Nila Rahman', 'all', 'all').length, 1);
  assert.equal(store.findBooks('water', 'all', 'all').length, 1);
  assert.equal(store.findBooks('water', 'harbor', 'all').length, 0);
  assert.equal(store.findBooks('not a book', 'all', 'all').length, 0);
  assert.equal(store.findBooks('', 'orchard', 'available').length, 6);
});

test('request journey, duplicate prevention, availability, persistence, and reset', () => {
  const storage = memoryStorage();
  const store = create(data, storage);
  const created = store.createRequest('b01');
  assert.equal(created.ok, true);
  assert.equal(store.createRequest('b01').ok, false);
  assert.equal(store.isAvailable('b01'), false);
  assert.equal(store.findBooks('', 'harbor', 'unavailable').length, 1);
  assert.equal(store.advanceRequest(created.request.id, 'borrowed').ok, false);
  assert.equal(store.advanceRequest(created.request.id, 'ready').ok, true);
  assert.equal(store.advanceRequest(created.request.id, 'ready').ok, false);
  assert.equal(store.advanceRequest(created.request.id, 'borrowed').ok, true);
  assert.equal(create(data, storage).listRequests()[0].stage, 'borrowed');
  assert.equal(store.advanceRequest(created.request.id, 'returned').ok, true);
  assert.equal(store.advanceRequest(created.request.id, 'requested').ok, false);
  assert.equal(store.isAvailable('b01'), true);
  assert.equal(store.createRequest('b01').ok, true);
  assert.equal(store.listRequests().length, 2);
  store.reset();
  assert.equal(store.listRequests().length, 0);
  assert.equal(store.isAvailable('b01'), true);
  assert.equal(storage.getItem(key), null);
});

test('malformed, inconsistent, and unavailable storage fall back safely', () => {
  const storage = memoryStorage();
  storage.setItem(key, '{bad json');
  const malformed = create(data, storage);
  assert.match(malformed.getNotice(), /could not be read/);
  assert.equal(malformed.listRequests().length, 0);
  assert.equal(malformed.createRequest('b02').ok, true);
  assert.equal(create(data, storage).listRequests().length, 1);

  storage.setItem(key, JSON.stringify({ version: 1, nextId: 3, requests: [
    { id: 1, bookId: 'b01', stage: 'requested' },
    { id: 2, bookId: 'b01', stage: 'borrowed' }
  ] }));
  assert.equal(create(data, storage).listRequests().length, 0);

  const unavailable = create(data, {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); }
  });
  assert.match(unavailable.getNotice(), /unavailable/);
  assert.equal(unavailable.createRequest('b03').ok, true);
  assert.equal(unavailable.listRequests().length, 1);

  const writeBlocked = create(data, { getItem() { return null; }, setItem() { throw new Error('blocked'); } });
  assert.equal(writeBlocked.createRequest('b04').ok, true);
  assert.match(writeBlocked.getNotice(), /unavailable/);
});
