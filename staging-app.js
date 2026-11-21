import { restoreReaderSession } from './firebase-reader-session.js';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, where, limit } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

const projectId = 'book-warehouse-staging-261115';
const localeKey = 'book-warehouse-locale';
const $ = id => document.getElementById(id);
const copy = {
  en: {
    title: 'Fictional shared catalogue', label: 'Staging preview. Borrowing is unavailable while trusted circulation setup is incomplete.',
    signIn: 'Continue with Google', signOut: 'Sign out', catalogue: 'Catalogue', search: 'Search in Bangla or English',
    sample: 'Fictional sample record', available: 'Available', unavailable: 'Unavailable', empty: 'No matching records.',
    setup: 'Staging configuration is unavailable.', signedIn: 'Reader account ready.', accountPending: 'Signed in. Reader account setup is pending.',
    cancelled: 'Google sign-in was cancelled.', authError: 'Google sign-in could not be completed.', dataError: 'Catalogue is unavailable.'
  },
  bn: {
    title: 'কাল্পনিক যৌথ বইয়ের তালিকা', label: 'স্টেজিং প্রিভিউ। নির্ভরযোগ্য ধার দেওয়ার ব্যবস্থা সম্পূর্ণ না হওয়া পর্যন্ত ধার নেওয়া বন্ধ।',
    signIn: 'Google দিয়ে চালিয়ে যান', signOut: 'সাইন আউট', catalogue: 'বইয়ের তালিকা', search: 'বাংলা বা ইংরেজিতে খুঁজুন',
    sample: 'কাল্পনিক নমুনা তথ্য', available: 'পাওয়া যাচ্ছে', unavailable: 'পাওয়া যাচ্ছে না', empty: 'মিলে এমন তথ্য নেই।',
    setup: 'স্টেজিং কনফিগারেশন পাওয়া যায়নি।', signedIn: 'পাঠকের অ্যাকাউন্ট প্রস্তুত।', accountPending: 'সাইন ইন হয়েছে। পাঠকের অ্যাকাউন্ট তৈরি বাকি।',
    cancelled: 'Google সাইন ইন বাতিল করা হয়েছে।', authError: 'Google সাইন ইন সম্পূর্ণ হয়নি।', dataError: 'বইয়ের তালিকা পাওয়া যাচ্ছে না।'
  }
};
let locale = (() => { try { return localStorage.getItem(localeKey) === 'en' ? 'en' : 'bn'; } catch { return 'bn'; } })();
let catalogue = { libraries: [], works: [], editions: [], copies: [] };
let message = '';
const text = key => copy[locale][key];
const local = value => value?.[locale] || value?.[locale === 'bn' ? 'en' : 'bn'] || '';
function render() {
  document.documentElement.lang = locale;
  document.title = `${text('title')} | Book Warehouse`;
  for (const [id, key] of Object.entries({ title: 'title', label: 'label', 'google-sign-in': 'signIn', 'sign-out': 'signOut', 'catalogue-heading': 'catalogue', 'search-label': 'search' })) $(id).textContent = text(key);
  $('feedback').textContent = message ? text(message) : '';
  document.querySelectorAll('[data-locale]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.locale === locale)));
  const target = $('catalogue');
  target.replaceChildren();
  const term = $('search').value.trim().normalize('NFC').toLocaleLowerCase();
  const works = Object.fromEntries(catalogue.works.map(item => [item.id, item]));
  const editions = Object.fromEntries(catalogue.editions.map(item => [item.id, item]));
  const libraries = Object.fromEntries(catalogue.libraries.map(item => [item.id, item]));
  for (const item of catalogue.copies) {
    const work = works[editions[item.editionId]?.workId];
    if (!work) continue;
    const searchText = [...Object.values(work.title || {}), ...Object.values(work.authorDisplay || {}), ...Object.values(work.topics || {}).flat()].join(' ').normalize('NFC').toLocaleLowerCase();
    if (term && !searchText.includes(term)) continue;
    const card = document.createElement('article');
    card.className = 'book-card';
    const body = document.createElement('div');
    body.className = 'book-body';
    for (const [tag, value, className] of [
      ['p', text('sample'), 'book-category'], ['h3', local(work.title), ''],
      ['p', local(work.authorDisplay), 'book-author'], ['p', local(libraries[item.libraryId]?.name), 'book-location'],
      ['p', text(item.availability === 'available' ? 'available' : 'unavailable'), 'availability ' + (item.availability === 'available' ? 'available' : 'unavailable')]
    ]) {
      const element = document.createElement(tag);
      element.textContent = value;
      if (className) element.className = className;
      body.append(element);
    }
    card.append(body);
    target.append(card);
  }
  if (!target.childElementCount) {
    const empty = document.createElement('p');
    empty.textContent = text('empty');
    target.append(empty);
  }
}
document.querySelectorAll('[data-locale]').forEach(button => button.addEventListener('click', () => {
  locale = button.dataset.locale;
  try { localStorage.setItem(localeKey, locale); } catch { /* Current selection still works. */ }
  render();
}));
$('search').addEventListener('input', render);
render();

try {
  const response = await fetch('./staging-config.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('config');
  const config = await response.json();
  if (config.projectId !== projectId || config.appId !== '1:222757402819:web:f15b1082c1efc6e4e48a76') throw new Error('config');
  const { app, auth } = await restoreReaderSession(config);
  const db = getFirestore(app);
  const ensureReader = httpsCallable(getFunctions(app), 'ensureReader');
  const published = (name, constraints) => getDocs(query(collection(db, name), ...constraints, limit(20)))
    .then(snapshot => snapshot.docs.map(item => ({ id: item.id, ...item.data() })));
  async function refresh() {
    try {
      const [libraries, works, editions, copies] = await Promise.all([
        published('libraries', [where('status', '==', 'active'), where('visibility', '==', 'public')]),
        published('works', [where('visibility', '==', 'public')]),
        published('editions', [where('visibility', '==', 'public')]),
        published('copies', [where('visibility', '==', 'public')])
      ]);
      catalogue = { libraries, works, editions, copies };
      render();
    } catch { message = 'dataError'; render(); }
  }
  onAuthStateChanged(auth, async user => {
    $('google-sign-in').hidden = !!user;
    $('sign-out').hidden = !user;
    $('account-name').textContent = user?.displayName || user?.email || '';
    message = '';
    if (user) {
      try { await ensureReader(); message = 'signedIn'; }
      catch { message = 'accountPending'; }
    }
    render();
  });
  $('google-sign-in').addEventListener('click', async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (error) { message = error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request' ? 'cancelled' : 'authError'; render(); }
  });
  $('sign-out').addEventListener('click', async () => {
    try { await signOut(auth); message = ''; render(); }
    catch { message = 'authError'; render(); }
  });
  await refresh();
} catch { message = 'setup'; render(); }
