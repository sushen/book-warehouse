import { createSparkStore } from './spark-store.js';
import { prepareBorrowing } from './borrowing-intent.js';
import { catalogueCard } from './catalogue-card.js';
import { groupHoldings } from './catalogue-holdings.js';
import { mountReaderJourney } from './reader-journey.js';
import { emulatorLogin } from './emulator-login.js';

if (/^https?:$/.test(location.protocol)) {
  if (document.readyState === 'loading') {
    await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  }
  const $ = id => document.getElementById(id);
  const words = {
    en: {
      loading: 'Loading books…', failed: 'Could not load books. Refresh to retry.',
      catalogue: 'Browse the library catalogue',
      catalogueNote: 'Choose an available copy. Your Google account identifies your borrowing request.',
      journeyNote: 'View your saved requests and their progress through collection and return.',
      source: 'Connected to Book Warehouse Staging',
      available: 'Available', unavailable: 'Unavailable', request: 'Request a copy',
      reserved: 'Your request is recorded in My requests.', cancelled: 'Request cancelled.',
      error: 'Could not complete the request. Please try again.', changed: 'This copy is no longer available.',
      profile: 'Enter your reader name', confirm: 'Request this copy?', reader: 'Reader',
      requests: 'My requests', all: 'All libraries',
      pending: 'Outcome uncertain. Check My requests before requesting again.'
    },
    bn: {
      loading: 'বইয়ের তালিকা আসছে…', failed: 'বইয়ের তালিকা আনা যায়নি। রিফ্রেশ করে আবার চেষ্টা করুন।',
      catalogue: 'পাঠাগারের বই দেখুন',
      catalogueNote: 'পাওয়া যাচ্ছে এমন কপি বাছুন। আপনার Google অ্যাকাউন্টে ধার নেওয়ার অনুরোধ নথিভুক্ত হবে।',
      journeyNote: 'সংরক্ষিত অনুরোধ এবং বই সংগ্রহ থেকে ফেরত দেওয়া পর্যন্ত অগ্রগতি দেখুন।',
      source: 'Book Warehouse Staging-এর সঙ্গে সংযুক্ত',
      available: 'পাওয়া যাচ্ছে', unavailable: 'পাওয়া যাচ্ছে না', request: 'কপি অনুরোধ করুন',
      reserved: 'আমার অনুরোধ-এ আপনার অনুরোধ নথিভুক্ত হয়েছে।', cancelled: 'অনুরোধ বাতিল হয়েছে।',
      error: 'অনুরোধ সম্পন্ন হয়নি। আবার চেষ্টা করুন।', changed: 'এই কপিটি আর পাওয়া যাচ্ছে না।',
      profile: 'পাঠক হিসেবে আপনার নাম লিখুন', confirm: 'এই কপিটি অনুরোধ করবেন?', reader: 'পাঠক',
      requests: 'আমার অনুরোধ', all: 'সব পাঠাগার',
      pending: 'ফল নিশ্চিত নয়। আবার অনুরোধের আগে আমার অনুরোধ দেখুন।'
    }
  };
  const locale = () => document.documentElement.lang === 'en' ? 'en' : 'bn';
  const text = key => words[locale()][key];
  const local = value => value?.[locale()] || value?.en || value?.bn || '';
  const list = $('book-list');
  let catalogue;
  let store;
  let busy = false;
  let message = '';
  let renderJourney = () => {};
  const emulator = ['127.0.0.1','localhost'].includes(location.hostname) && new URLSearchParams(location.search).get('emulator') === '1';
  function node(tag, content, className) {
    const item = document.createElement(tag);
    item.textContent = content;
    if (className) item.className = className;
    return item;
  }
  const workFor = copy => catalogue.works[catalogue.editions[copy.editionId]?.workId];
  function render() {
    $('admin-dashboard-link').textContent = locale() === 'en' ? 'Admin dashboard' : 'অ্যাডমিন ড্যাশবোর্ড';
    $('catalogue-title').textContent = text('catalogue');
    document.querySelector('.catalogue-section .section-top p:last-child').textContent = text('catalogueNote');
    $('journey-title').textContent = text('requests');
    document.querySelector('.journey-section .section-top p').textContent = text('journeyNote');
    document.querySelector('.footer-inner span:last-child').textContent = text('source');
    $('reset-demo').hidden = true;
    document.body.classList.add('connected-mode');
    document.querySelector('.hero-detail').textContent = locale() === 'en' ? 'Browse the catalogue, read digital books, and follow your library requests.' : 'বইয়ের তালিকা দেখুন, ডিজিটাল বই পড়ুন এবং পাঠাগারে অনুরোধের যাত্রা দেখুন।';
    const note = document.querySelector('.demo-note');
    note.hidden = !emulator;
    if (emulator) note.textContent = locale() === 'en' ? 'Local emulator · Fictional test records only' : 'স্থানীয় এমুলেটর · শুধুই কাল্পনিক পরীক্ষার তথ্য';
    document.querySelector('.footer-inner span:last-child').textContent = emulator ? (locale() === 'en' ? 'Local emulator · Fictional test data' : 'স্থানীয় এমুলেটর · কাল্পনিক পরীক্ষার তথ্য') : text('source');
    $('empty-journey').hidden = true;
    renderJourney();
    const filter = $('location');
    const selected = filter.value;
    filter.replaceChildren();
    const all = node('option', text('all')); all.value = 'all'; filter.append(all);
    for (const library of Object.values(catalogue.libraries)) {
      const option = node('option', local(library.name)); option.value = library.id; filter.append(option);
    }
    filter.value = catalogue.libraries[selected] ? selected : 'all';
    const term = $('search').value.trim().normalize('NFC').toLocaleLowerCase();
    const copies = Object.values(catalogue.copies).filter(copy => {
      const work = workFor(copy);
      return work && work.archived !== true && (filter.value === 'all' || copy.libraryId === filter.value)
        && JSON.stringify([work.title, work.authorDisplay, work.topics]).normalize('NFC').toLocaleLowerCase().includes(term);
    });
    list.replaceChildren();
    const holdings = groupHoldings(copies).filter(group => $('availability').value !== 'available' || group.availableCopies.length > 0);
    for (const group of holdings) {
      const copy = group.selectedCopy;
      const work = workFor(copy);
      const available = group.availableCopies.length > 0;
      const language = catalogue.editions[copy.editionId]?.languageCode;
      const { card, foot } = catalogueCard({ id: copy.editionId, title: local(work.title), author: local(work.authorDisplay),
        format: locale() === 'en' ? 'Physical book' : 'মুদ্রিত বই',
        language: language === 'bn' ? 'বাংলা' : language === 'en' ? 'English' : '',
        location: local(catalogue.libraries[copy.libraryId]?.name),
        status: available ? (locale() === 'en' ? `${group.availableCopies.length} available · ${group.copies.length} copies` : `${new Intl.NumberFormat('bn').format(group.availableCopies.length)}টি পাওয়া যাচ্ছে · মোট ${new Intl.NumberFormat('bn').format(group.copies.length)} কপি`) : text('unavailable'), available });
      if (available && store.borrowingEnabled) {
        const button = node('button', text('request'), 'request-button');
        button.type = 'button'; button.disabled = busy;
        button.addEventListener('click', () => request(copy.id));
        foot.append(button);
      }
      list.append(card);
    }
    $('result-count').textContent = new Intl.NumberFormat(locale()).format(holdings.length) + (locale() === 'en' ? ' titles at libraries' : 'টি বই ও পাঠাগার');
    $('empty-results').hidden = holdings.length !== 0;
    $('action-feedback').textContent = message ? text(message) : '';
  }
  async function request(copyId) {
    if (busy) return;
    busy = true;
    try {
      const preparation = prepareBorrowing(store, copyId);
      render();
      let result = await preparation;
      if (result.code === 'profileRequired') {
        const name = window.prompt(text('profile'), store.user()?.displayName || '');
        if (!name?.trim()) { message = 'cancelled'; return; }
        await store.updateProfile(name.trim());
        result = await prepareBorrowing(store, copyId);
      }
      if (result.code !== 'ready') { message = 'changed'; return; }
      const title = local(workFor(result.copy)?.title) || copyId;
      const library = local(catalogue.libraries[result.copy.libraryId]?.name);
      if (!window.confirm([text('confirm'), title, library,
        text('reader') + ' — ' + result.profile.displayName].join('\n'))) {
        message = 'cancelled'; return;
      }
      const outcome = await store.execute('requestCopy', copyId);
      message = outcome.ok ? 'reserved' : store.pending() ? 'pending'
        : outcome.code === 'copyUnavailable' ? 'changed' : 'error';
      catalogue = await store.catalogue();
    } catch (error) {
      message = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(error.code)
        ? 'cancelled' : 'error';
    } finally {
      busy = false; render();
    }
  }
  list.textContent = text('loading');
  try {
    store = await createSparkStore(emulator);
    if (emulator) emulatorLogin(store.auth);
    catalogue = await store.catalogue();
    renderJourney = mountReaderJourney(store, () => catalogue, async () => { catalogue = await store.catalogue(); render(); });
    for (const id of ['search', 'location', 'availability']) {
      $(id).addEventListener(id === 'search' ? 'input' : 'change', render);
    }
    for (const id of ['clear-filters', 'empty-clear']) $(id).addEventListener('click', render);
    new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    render();
  } catch {
    list.textContent = text('failed');
  }
}
