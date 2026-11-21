const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const scripts = ['sample-data.js', 'demo-store.js', 'locales.js', 'app.js'];

function node(tag = 'div') {
  return {
    tagName: tag, value: 'all', textContent: '', children: [], attributes: {}, dataset: {}, hidden: false,
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren() { this.children = []; },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, callback) { this.events ||= {}; this.events[name] = callback; },
    focus() { this.focused = true; }, scrollIntoView() {},
    querySelector(selector) {
      if (selector === 'button') return this.children.flatMap(child => [child, ...child.children]).find(child => child.tagName === 'button') || null;
      return null;
    }
  };
}

function storage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); }, values
  };
}

function start(savedStorage, confirm = () => true, reducedMotion = false, location = null) {
  const ids = new Map();
  const selectors = new Map();
  const getId = id => { if (!ids.has(id)) ids.set(id, node()); return ids.get(id); };
  const getSelector = selector => { if (!selectors.has(selector)) selectors.set(selector, node()); return selectors.get(selector); };
  const bn = node('button'); bn.dataset.locale = 'bn';
  const en = node('button'); en.dataset.locale = 'en';
  const locationFilter = getId('location');
  locationFilter.querySelectorAll = () => locationFilter.children;
  getId('search').value = '';
  const document = {
    title: '', documentElement: { lang: '' },
    createElement: node, getElementById: getId, querySelector: getSelector,
    querySelectorAll: selector => selector === '[data-locale]' ? [bn, en] : []
  };
  const window = {
    location,
    localStorage: savedStorage, confirm, scrollY: 0,
    addEventListener(name, callback) { this.events ||= {}; this.events[name] = callback; },
    matchMedia() { return { matches: reducedMotion }; },
    scrollTo(options) { this.lastScroll = options; this.scrollY = options.top; this.events.scroll(); }
  };
  const context = { window, document, console };
  vm.createContext(context);
  for (const file of scripts) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  return { window, document, getId, bn, en, storage: savedStorage };
}

test('website catalogue leaves borrowing to the authenticated homepage module', () => {
  const saved = storage();
  const location = { protocol: 'http:', hostname: '127.0.0.1', assign(target) { this.target = target; } };
  const app = start(saved, () => true, false, location);
  assert.equal(app.getId('book-list').children.length, 0);
  assert.equal(location.target, undefined);
  const store = app.window.BookWarehouseStore.create(app.window.BookWarehouseSample, saved);
  assert.equal(store.listRequests().length, 0);
});

test('Bangla default, language switch, search, active request, filters, reset and reload', () => {
  const saved = storage();
  let allowReset = false;
  const app = start(saved, () => allowReset);
  assert.equal(app.document.documentElement.lang, 'bn');
  assert.match(app.document.title, /বুক/);
  assert.match(app.getId('result-count').textContent, /১২|12/);
  const store = app.window.BookWarehouseStore.create(app.window.BookWarehouseSample, saved);
  assert.equal(store.findBooks('নদী', 'all', 'all').length, 2);
  assert.equal(store.findBooks('river', 'all', 'all').length, 2);
  const requestButton = app.getId('book-list').children[0].children[1].children.at(-1).children[1];
  requestButton.events.click();
  assert.match(app.getId('action-feedback').textContent, /নমুনা অনুরোধ/);
  const advanceButton = app.getId('request-list').children[0].children[2].children[1];
  advanceButton.events.click();
  assert.match(app.getId('request-list').children[0].children[2].children[0].textContent, /প্রস্তুত/);
  app.getId('search').value = 'নদী';
  app.getId('search').events.input();
  app.getId('location').value = 'orchard';
  app.getId('location').events.change();
  app.getId('availability').value = 'available';
  app.getId('availability').events.change();
  app.en.events.click();
  assert.equal(app.document.documentElement.lang, 'en');
  assert.equal(saved.getItem('book-warehouse-locale'), 'en');
  assert.equal(app.getId('search').value, 'নদী');
  assert.equal(app.getId('location').value, 'orchard');
  assert.equal(app.getId('availability').value, 'available');
  assert.equal(app.getId('request-list').children.length, 1);
  assert.equal(app.getId('request-list').children[0].children[2].children[0].textContent, 'Ready for collection');
  assert.equal(start(saved).getId('request-list').children[0].children[2].children[0].textContent, 'Ready for collection');
  app.getId('reset-demo').events.click();
  assert.equal(app.getId('request-list').children.length, 1);
  allowReset = true;
  app.getId('reset-demo').events.click();
  assert.equal(app.getId('request-list').children.length, 0);
  assert.equal(saved.getItem('book-warehouse-locale'), 'en');
  const reloaded = start(saved);
  assert.equal(reloaded.document.documentElement.lang, 'en');
  reloaded.bn.events.click();
  assert.equal(reloaded.document.documentElement.lang, 'bn');
});

test('invalid and unavailable locale preference fall back to Bangla', () => {
  const invalid = storage();
  invalid.setItem('book-warehouse-locale', 'fr');
  assert.equal(start(invalid).document.documentElement.lang, 'bn');
  assert.equal(start(null).document.documentElement.lang, 'bn');
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } };
  const app = start(blocked);
  assert.equal(app.document.documentElement.lang, 'bn');
  app.en.events.click();
  assert.equal(app.document.documentElement.lang, 'en');
  assert.match(app.getId('storage-notice').textContent, /unavailable/);
});

test('translation keys fall back to English and store retains English messages', () => {
  const app = start(storage());
  const t = app.window.BookWarehouseLocales.translate;
  assert.equal(t('bn', 'requestCreated'), 'নমুনা অনুরোধ তৈরি হয়েছে। কোনো বাস্তব বুকিং পাঠানো হয়নি।');
  assert.equal(t('fr', 'requestCreated'), 'Demo request created. No real reservation was sent.');
  const store = app.window.BookWarehouseStore.create(app.window.BookWarehouseSample, storage());
  assert.equal(store.createRequest('b01').code, 'requestCreated');
  assert.equal(store.createRequest('b01').message, 'This copy already has an active demo request.');
});

test('back-to-top appears after scrolling, localizes, and restores keyboard focus', () => {
  const app = start(storage());
  const button = app.getId('back-to-top');
  assert.equal(button.hidden, true);
  assert.equal(button.attributes['aria-label'], 'উপরে ফিরে যান');
  app.window.scrollY = 241;
  app.window.events.scroll();
  assert.equal(button.hidden, false);
  app.en.events.click();
  assert.equal(button.attributes['aria-label'], 'Back to top');
  button.events.click();
  assert.equal(app.window.lastScroll.behavior, 'smooth');
  assert.equal(button.hidden, true);
  assert.equal(app.document.querySelector('.brand').focused, true);
  const reduced = start(storage(), () => true, true);
  reduced.window.scrollY = 300;
  reduced.window.events.scroll();
  reduced.getId('back-to-top').events.click();
  assert.equal(reduced.window.lastScroll.behavior, 'auto');
});
