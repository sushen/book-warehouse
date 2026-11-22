import { createDigitalStore } from './digital-store.js';
import { restoreReaderSession } from './firebase-reader-session.js';
import { catalogueCard } from './catalogue-card.js';
import { isLocalRuntime } from './local-runtime.js';

if (/^https?:$/.test(location.protocol) && !isLocalRuntime(location) && !(['localhost','127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).get('emulator') === '1')) {
  const section = document.createElement('section'); section.className = 'wrap'; section.id = 'digital-catalogue';
  const heading = document.createElement('h2'), search = document.createElement('input'), status = document.createElement('p'), list = document.createElement('div');
  const eyebrow = document.createElement('p'); eyebrow.className = 'eyebrow';
  const head = document.createElement('div'); head.className = 'section-heading'; head.append(eyebrow, heading);
  search.type = 'search'; search.maxLength = 200; list.className = 'book-grid';
  status.className = 'digital-results-note'; status.setAttribute('role', 'status');
  section.append(head, search, status, list);
  document.getElementById('catalogue').after(section);
  let records = [], state = 'loading';
  const dictionary = {
    en: { title: 'Digital books', search: 'Search digital books', loading: 'Loading digital books…', failed: 'Digital books could not load. Refresh to retry.', empty: 'No published digital books match.', read: 'Protected access not ready', note: 'Full books require a reading license. Protected preview and purchases are not connected on this website yet.' },
    bn: { title: 'ডিজিটাল বই', search: 'ডিজিটাল বই খুঁজুন', loading: 'ডিজিটাল বই আসছে…', failed: 'ডিজিটাল বই আসেনি। রিফ্রেশ করে চেষ্টা করুন।', empty: 'মিলে এমন প্রকাশিত ডিজিটাল বই নেই।', read: 'সুরক্ষিত প্রবেশাধিকার প্রস্তুত নয়', note: 'পুরো বই পড়তে লাইসেন্স প্রয়োজন। এই ওয়েবসাইটে সুরক্ষিত প্রিভিউ ও ক্রয় এখনও যুক্ত হয়নি।' }
  };
  function render() {
    const t = dictionary[document.documentElement.lang === 'en' ? 'en' : 'bn'];
    heading.textContent = t.title; search.placeholder = t.search; search.setAttribute('aria-label', t.search);
    const english = document.documentElement.lang === 'en';
    eyebrow.textContent = english ? 'A shelf of ideas' : 'ভাবনার বইয়ের তাক';
    list.replaceChildren();
    const matches = records.filter(r => `${r.title} ${r.author} ${r.description}`.normalize('NFC').toLocaleLowerCase().includes(search.value.normalize('NFC').toLocaleLowerCase()));
    status.textContent = state !== 'ready' ? t[state] : matches.length ? t.note : t.empty;
    for (const record of matches) {
      const { card, foot } = catalogueCard({ id: record.fileId, title: record.title, author: record.author,
        format: english ? 'Digital book' : 'ডিজিটাল বই', language: record.language === 'bn' ? 'বাংলা' : record.language === 'en' ? 'English' : '',
        description: record.description, status: english ? 'Protected access not ready' : 'সুরক্ষিত প্রবেশাধিকার প্রস্তুত নয়', available: false });
      const link = document.createElement('button'); link.className = 'request-button'; link.textContent = t.read; link.disabled = true;
      foot.append(link); list.append(card);
    }
  }
  search.addEventListener('input', render);
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  render();
  try {
    const response = await fetch('./spark-config.json', { cache: 'no-store' }); if (!response.ok) throw new Error('Configuration unavailable');
    const config = await response.json(); if (config.projectId !== 'book-warehouse-staging-261115') throw new Error('Unexpected project');
    const { app, auth } = await restoreReaderSession(config); records = await createDigitalStore(app, auth).list(); state = 'ready';
  } catch { state = 'failed'; }
  render();
}
