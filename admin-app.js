import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { createAdminStore } from './admin-store.js';
import { initDigitalAdmin } from './digital-admin.js';
import { emulatorLogin } from './emulator-login.js';
import { reviewRows } from './admin-review.js';
import { mountCreditTopupInbox } from './credit-topup-inbox.js';

const $ = id => document.getElementById(id);
let stopCreditTopupInbox = () => {};
const words = {
  en: {
    title: 'Super Admin dashboard', signIn: 'Continue with Google', signOut: 'Sign out',
    queue: 'Borrowing approvals', addBooks: 'Add real books', addLibrary: 'Add a holding library',
    inventory: 'Lending inventory', state: 'Status', library: 'Library', requested: 'Pending approval',
    all: 'All', ready: 'Ready for pickup', borrowed: 'Borrowed', returned: 'Returned', cancelled: 'Cancelled / rejected',
    refresh: 'Refresh', more: 'Load more requests', pageNote: 'Requests are loaded in pages of 30. Refresh to see new activity.',
    physicalNote: 'Register books and physical copies held at the selected location. They become visible in the catalogue when saved.',
    bookTitle: 'Book title', bookTitleBn: 'Bangla title (optional)', author: 'Author', authorBn: 'Bangla author name (optional)',
    quantity: 'Physical copies (1–20)', language: 'Language', other: 'Other', topics: 'Topics, separated by commas',
    saveBook: 'Save book and copies', libraryName: 'Library name', libraryNameBn: 'Bangla library name (optional)',
    address: 'Confirmed pickup and return address', contact: 'Public help contact (optional)', saveLibrary: 'Save library',
    denied: 'This account does not have administrator access.', signedOut: 'Sign in with your approved administrator account.',
    approved: 'Request approved. The reader can see Ready for pickup.', rejected: 'Request rejected and copy released.',
    updated: 'Status updated.', error: 'The action failed. Refresh and try again.', noRequests: 'No matching requests.',
    approve: 'Approve for pickup', reject: 'Reject request', reason: 'Rejection reason (at least 3 characters)',
    checkout: 'Record checkout', return: 'Record return', reader: 'Reader', unnamed: 'Name unavailable',
    saved: 'Saved. The catalogue and inventory have been refreshed.', count: 'Copies', available: 'Available',
    held: 'Reserved / ready', onLoan: 'On loan', empty: 'No registered books.',
    loading: 'Loading…',
    loadError: 'Dashboard data could not load. Use Refresh to retry.',
    permissions: 'Your admin account is recognized, but database access was denied. Use Refresh after the access rules are updated.'
  },
  bn: {
    title: 'সুপার অ্যাডমিন ড্যাশবোর্ড', signIn: 'Google দিয়ে চালিয়ে যান', signOut: 'সাইন আউট',
    queue: 'ধার নেওয়ার অনুমোদন', addBooks: 'বাস্তব বই যোগ করুন', addLibrary: 'বই রাখা পাঠাগার যোগ করুন',
    inventory: 'ধার দেওয়ার সংগ্রহ', state: 'অবস্থা', library: 'পাঠাগার', requested: 'অনুমোদনের অপেক্ষায়',
    all: 'সব', ready: 'সংগ্রহের জন্য প্রস্তুত', borrowed: 'ধার দেওয়া হয়েছে', returned: 'ফেরত এসেছে', cancelled: 'বাতিল / প্রত্যাখ্যাত',
    refresh: 'হালনাগাদ করুন', more: 'আরও অনুরোধ দেখুন', pageNote: 'প্রতি ধাপে ৩০টি অনুরোধ আসে। নতুন কাজ দেখতে হালনাগাদ করুন।',
    physicalNote: 'নির্বাচিত স্থানে রাখা বই ও বাস্তব কপি নথিভুক্ত করুন। সংরক্ষণ করলে বইয়ের তালিকায় দেখা যাবে।',
    bookTitle: 'বইয়ের নাম', bookTitleBn: 'বাংলা নাম (ঐচ্ছিক)', author: 'লেখক', authorBn: 'লেখকের বাংলা নাম (ঐচ্ছিক)',
    quantity: 'বাস্তব কপি (১–২০)', language: 'ভাষা', other: 'অন্যান্য', topics: 'বিষয়, কমা দিয়ে আলাদা করুন',
    saveBook: 'বই ও কপি সংরক্ষণ করুন', libraryName: 'পাঠাগারের নাম', libraryNameBn: 'পাঠাগারের বাংলা নাম (ঐচ্ছিক)',
    address: 'নিশ্চিত বই সংগ্রহ ও ফেরত দেওয়ার ঠিকানা', contact: 'সবার জন্য সহায়তার যোগাযোগ (ঐচ্ছিক)', saveLibrary: 'পাঠাগার সংরক্ষণ করুন',
    denied: 'এই অ্যাকাউন্টের অ্যাডমিন অনুমতি নেই।', signedOut: 'অনুমোদিত অ্যাডমিন অ্যাকাউন্ট দিয়ে সাইন ইন করুন।',
    approved: 'অনুরোধ অনুমোদিত। পাঠক এখন সংগ্রহের জন্য প্রস্তুত অবস্থা দেখতে পাবেন।', rejected: 'অনুরোধ প্রত্যাখ্যাত হয়েছে; কপিটি আবার পাওয়া যাচ্ছে।',
    updated: 'অবস্থা হালনাগাদ হয়েছে।', error: 'কাজটি সম্পন্ন হয়নি। হালনাগাদ করে আবার চেষ্টা করুন।', noRequests: 'মিলে এমন অনুরোধ নেই।',
    approve: 'সংগ্রহের অনুমোদন দিন', reject: 'অনুরোধ প্রত্যাখ্যান করুন', reason: 'প্রত্যাখ্যানের কারণ (অন্তত ৩ অক্ষর)',
    checkout: 'ধার দেওয়া নথিভুক্ত করুন', return: 'ফেরত নথিভুক্ত করুন', reader: 'পাঠক', unnamed: 'নাম পাওয়া যায়নি',
    saved: 'সংরক্ষিত হয়েছে। বইয়ের তালিকা ও সংগ্রহ হালনাগাদ হয়েছে।', count: 'কপি', available: 'পাওয়া যাচ্ছে',
    held: 'সংরক্ষিত / প্রস্তুত', onLoan: 'ধারে আছে', empty: 'নথিভুক্ত বই নেই।', loading: 'আসছে…',
    loadError: 'ড্যাশবোর্ডের তথ্য আসেনি। হালনাগাদ বোতামে আবার চেষ্টা করুন।',
    permissions: 'আপনার অ্যাডমিন অ্যাকাউন্ট শনাক্ত হয়েছে, তবে ডেটাবেস অনুমতি দেয়নি। নিয়ম হালনাগাদ হলে আবার চেষ্টা করুন।'
  }
};
Object.assign(words.en, {
  workspace: 'Book Warehouse administration',
  description: 'Review borrowing requests and keep your collection up to date.',
  needsReview: 'Requests to review', awaitingPickup: 'Approved requests',
  physicalCopies: 'Physical copies', acrossCollection: 'In your lending collection',
  libraries: 'Libraries', holdingLocations: 'Registered holding locations',
  manage: 'Manage', navNote: 'Your library network',
  queueNote: 'Review each reader request and move approved copies towards pickup.',
  libraryNote: 'Add the location where readers will collect and return their books.',
  inventoryNote: 'See stock and availability across your registered locations.'
});
Object.assign(words.bn, {
  workspace: 'বুক ওয়্যারহাউস পরিচালনা',
  description: 'ধার নেওয়ার অনুরোধ পর্যালোচনা করুন ও সংগ্রহ হালনাগাদ রাখুন।',
  needsReview: 'পর্যালোচনার অনুরোধ', awaitingPickup: 'অনুমোদিত অনুরোধ',
  physicalCopies: 'বাস্তব কপি', acrossCollection: 'ধার দেওয়ার সংগ্রহে',
  libraries: 'পাঠাগার', holdingLocations: 'নথিভুক্ত বই রাখার স্থান',
  manage: 'পরিচালনা', navNote: 'আপনার পাঠাগারের নেটওয়ার্ক',
  queueNote: 'পাঠকের অনুরোধ পর্যালোচনা করে কপি সংগ্রহের ব্যবস্থা করুন।',
  libraryNote: 'পাঠক যেখান থেকে বই সংগ্রহ ও ফেরত দেবেন সেই স্থান যোগ করুন।',
  inventoryNote: 'নথিভুক্ত স্থানগুলোতে বইয়ের মজুত ও পাওয়ার অবস্থা দেখুন।'
});
let locale = 'bn';
try { locale = localStorage.getItem('book-warehouse-locale') === 'en' ? 'en' : 'bn'; } catch {}
const text = key => words[locale][key] || words.en[key] || key;
const local = value => value?.[locale] || value?.en || value?.bn || '';
let store, catalogue, cursor, rows = [], busy = false, authorized = false;
let inventoryOperation = null;
let summary = null;
let attention = [], handoffs = {}, stopAttention = () => {}, authEpoch = 0;
let selectedRequest = null, selectedId = '', stopSelected = () => {}, pageSequence = 0;
let selectionNotice = '', actionNotice = '';
const reviewDrafts = new Map();
function focusSelected() {
  const card = [...$('admin-requests').children].find(item => item.dataset.requestId === selectedId);
  if (card) { card.focus({ preventScroll: true }); card.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block:'start' }); }
}
function chooseRequest(id, scroll = true) {
  stopSelected(); selectedId = id; selectedRequest = null; actionNotice = ''; selectionNotice = 'loading';
  selectPanel('approval-queue');
  const url = new URL(location.href); url.hash = 'approval-queue'; url.searchParams.set('request',id); history.replaceState(null,'',url);
  renderRequests(); const epoch = authEpoch;
  stopSelected = store.watchRequest(id, request => {
    if (epoch !== authEpoch || id !== selectedId) return;
    selectedRequest = request; selectionNotice = request ? '' : 'noRequests'; renderRequests();
    if (scroll) { focusSelected(); scroll = false; }
  }, () => { selectionNotice = 'loadError'; renderRequests(); });
}
function clearSelection() {
  stopSelected(); selectedId = ''; selectedRequest = null; selectionNotice = ''; actionNotice = '';
  const url = new URL(location.href); url.searchParams.delete('request'); history.replaceState(null,'',url); renderRequests();
}
const noticeBox = document.createElement('aside'); noticeBox.id = 'admin-notifications'; noticeBox.setAttribute('aria-live','polite');
document.querySelector('.admin-workspace').prepend(noticeBox);
function notifications() {
  noticeBox.replaceChildren();
  noticeBox.append(node('h2', locale === 'en' ? 'Library inbox' : 'পাঠাগারের খবর'));
  if (!attention.length) noticeBox.append(node('p', locale === 'en' ? 'No pending notifications.' : 'অপেক্ষমাণ খবর নেই।'));
  for (const item of attention) {
    const kind = item.state === 'requested' ? 'requested' : item.state === 'ready' ? 'pickupNotice' : 'returnNotice';
    const title = local(catalogue?.works[catalogue?.editions[catalogue?.copies[item.copyId]?.editionId]?.workId]?.title) || item.copyId;
    const link = node('button', '', 'admin-inbox-item'); link.type = 'button';
    link.append(node('span', text(kind), 'admin-inbox-kind'), node('strong', title), node('span', item.readerName || text('unnamed')),
      node('span', locale === 'en' ? 'Review request →' : 'অনুরোধ দেখুন →', 'admin-inbox-action'));
    link.disabled = busy; link.onclick = () => chooseRequest(item.id);
    noticeBox.append(link);
  }
}
Object.assign(words.en, { pickupNotice:'Reader ready to collect', returnNotice:'Reader reports book returned', checkout:'Confirm book handed to reader', return:'Confirm returned book received' });
Object.assign(words.bn, { pickupNotice:'পাঠক সংগ্রহের জন্য প্রস্তুত', returnNotice:'পাঠক বই ফেরতের কথা জানিয়েছেন', checkout:'পাঠককে বই দেওয়া নিশ্চিত করুন', return:'ফেরত বই হাতে পাওয়া নিশ্চিত করুন' });
Object.assign(words.en, {
  reviewing:'Selected request', closeReview:'Back to queue', approveHint:'Approve this reservation so the reader can arrange collection.',
  readyHint:'The reader can collect this book. Confirm handoff only after giving it to the reader.',
  returnHint:'Confirm return only after the library has received the book.', completeHint:'This request is complete.',
  rejectOptions:'Reject this request…', reasonNeeded:'Enter a reason of at least 3 characters.', approvedHere:'Approved. The reader now sees Ready for collection.',
  changedHere:'Saved. The reader’s journey has been updated.', failedHere:'Could not save. Your request and entered reason are preserved; please retry.'
});
Object.assign(words.bn, {
  reviewing:'নির্বাচিত অনুরোধ', closeReview:'তালিকায় ফিরে যান', approveHint:'অনুমোদন করলে পাঠক বই সংগ্রহের ব্যবস্থা করতে পারবেন।',
  readyHint:'বইটি সংগ্রহ করা যাবে। পাঠককে হাতে দেওয়ার পরেই নিশ্চিত করুন।', returnHint:'পাঠাগারে বইটি হাতে পাওয়ার পরেই ফেরত নিশ্চিত করুন।',
  completeHint:'এই অনুরোধের কাজ শেষ হয়েছে।', rejectOptions:'এই অনুরোধ প্রত্যাখ্যান…', reasonNeeded:'অন্তত ৩ অক্ষরের কারণ লিখুন।',
  approvedHere:'অনুমোদিত। পাঠক এখন সংগ্রহের জন্য প্রস্তুত অবস্থা দেখছেন।', changedHere:'সংরক্ষিত। পাঠকের যাত্রা হালনাগাদ হয়েছে।',
  failedHere:'সংরক্ষণ হয়নি। অনুরোধ ও লেখা কারণ সংরক্ষিত আছে; আবার চেষ্টা করুন।'
});
const panels = ['approval-queue', 'inventory', 'add-books', 'add-library', 'digital-books'];
function selectPanel(id) {
  const active = panels.includes(id) ? id : 'approval-queue';
  for (const panel of panels) $(panel).hidden = panel !== active;
  for (const link of document.querySelectorAll('.admin-nav > a')) {
    if (link.hash === '#' + active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}
function metrics() {
  const number = value => new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-GB').format(value);
  $('metric-pending').textContent = summary ? number(summary.pending) : '—';
  $('metric-ready').textContent = summary ? number(summary.ready) : '—';
  $('metric-copies').textContent = catalogue ? number(Object.keys(catalogue.copies).length) : '—';
  $('metric-libraries').textContent = catalogue ? number(Object.keys(catalogue.libraries).length) : '—';
}
const feedback = code => { $('admin-feedback').textContent = text(code); };
function node(tag, value, className) {
  const item = document.createElement(tag); item.textContent = value;
  if (className) item.className = className;
  return item;
}
function labels() {
  document.documentElement.lang = locale;
  document.querySelectorAll('[data-text]').forEach(item => { item.textContent = text(item.dataset.text); });
  document.querySelectorAll('[data-locale]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.locale === locale)));
}
function libraries() {
  for (const id of ['admin-library', 'book-library']) {
    const select = $(id); const selected = select.value;
    select.replaceChildren();
    const empty = node('option', id === 'admin-library' ? text('all') : '—');
    empty.value = id === 'admin-library' ? 'all' : ''; select.append(empty);
    for (const library of Object.values(catalogue.libraries)) {
      const option = node('option', local(library.name)); option.value = library.id; select.append(option);
    }
    select.value = catalogue.libraries[selected] ? selected : empty.value;
  }
}
async function change(request, state, reason) {
  if (busy) return;
  if (selectedId !== request.id) chooseRequest(request.id, false);
  if (state === 'cancelled' && reason.trim().length < 3) { actionNotice = 'reasonNeeded'; renderRequests(); return; }
  busy = true; actionNotice = ''; renderRequests(); notifications();
  try {
    await store.transition(request.id, state, reason);
    await reload();
    feedback(state === 'ready' ? 'approved' : state === 'cancelled' ? 'rejected' : 'updated');
    actionNotice = state === 'ready' ? 'approvedHere' : 'changedHere'; reviewDrafts.delete(request.id);
  } catch { actionNotice = 'failedHere'; feedback('error'); }
  finally { busy = false; renderRequests(); notifications(); focusSelected(); }
}
function renderRequests() {
  const active = document.activeElement;
  const editing = active?.dataset?.requestReason ? { id:active.dataset.requestReason, start:active.selectionStart, end:active.selectionEnd } : null;
  $('admin-requests').replaceChildren();
  if (selectedId) {
    const bar = node('div', '', 'admin-review-heading'); bar.append(node('strong', text('reviewing')));
    const close = node('button',text('closeReview'),'button button-outline'); close.type='button'; close.disabled=busy; close.onclick=clearSelection; bar.append(close);
    $('admin-requests').append(bar);
    if (selectionNotice) { const note=node('p',text(selectionNotice));note.setAttribute('role','status');$('admin-requests').append(note); }
  }
  const visible = reviewRows(rows, selectedRequest);
  if (!visible.length && !selectedId) $('admin-requests').append(node('p', text('noRequests'), 'admin-empty'));
  for (const request of visible) {
    const copy = catalogue.copies[request.copyId];
    const edition = catalogue.editions[copy?.editionId];
    const work = catalogue.works[edition?.workId];
    const card = node('article', '', 'journey-card admin-review-card' + (request.id === selectedId ? ' selected' : ''));
    card.dataset.requestId = request.id; card.tabIndex=-1;
    const head = node('div', '', 'admin-card-head');
    head.append(node('h3', local(work?.title) || request.copyId),
      node('span', text(request.state), 'stage-pill stage-' + request.state));
    if (request.id !== selectedId) {
      const review = node('button', locale === 'en' ? 'Review request' : 'অনুরোধ দেখুন', 'button button-outline');
      review.type = 'button'; review.disabled = busy;
      review.setAttribute('aria-label', (locale === 'en' ? 'Review request: ' : 'অনুরোধ দেখুন: ') + (local(work?.title) || request.copyId) + ' — ' + (request.readerName || text('unnamed')));
      review.onclick = () => chooseRequest(request.id); head.append(review);
    }
    const details = node('dl', '', 'admin-card-meta');
    for (const [label, value] of [
      ['reader', request.readerName || text('unnamed')],
      ['library', local(catalogue.libraries[request.libraryId]?.name) || request.libraryId]
    ]) {
      const pair = node('div', '');
      pair.append(node('dt', text(label)), node('dd', value)); details.append(pair);
    }
    card.append(head, details);
    card.append(node('p', text(request.state === 'requested' ? 'approveHint' : request.state === 'ready' ? 'readyHint' : request.state === 'borrowed' ? 'returnHint' : 'completeHint'), 'admin-next-step'));
    if (request.id === selectedId && actionNotice) { const notice=node('p',text(actionNotice),'admin-inline-feedback');notice.setAttribute('role','status');card.append(notice); }
    if (request.createdAt) card.append(node('p', new Intl.DateTimeFormat(locale === 'bn' ? 'bn-BD' : 'en-GB',
      { dateStyle: 'medium', timeStyle: 'short' }).format(request.createdAt.toDate()), 'admin-date'));
    if (request.decisionReason) card.append(node('p', request.decisionReason));
    if (request.state === 'ready' && handoffs[request.id]?.pickupRequestedAt) card.append(node('p', text('pickupNotice'), 'stage-pill'));
    if (request.state === 'borrowed' && handoffs[request.id]?.returnRequestedAt) card.append(node('p', text('returnNotice'), 'stage-pill'));
    const actions = node('div', '', 'admin-request-actions');
    const button = (label, state, reason, target = actions) => {
      const item = node('button', text(label), label === 'reject' ? 'button button-reject' : 'button button-dark');
      item.disabled = busy; item.type = 'button'; item.addEventListener('click', () => change(request, state, reason?.value || ''));
      target.append(item);
    };
    if (request.state === 'requested') {
      button('approve', 'ready');
      const draft = reviewDrafts.get(request.id) || { reason:'', open:false }; reviewDrafts.set(request.id,draft);
      const disclosure=node('details','','admin-rejection'); disclosure.open=draft.open;
      disclosure.addEventListener('toggle',()=>{draft.open=disclosure.open;});
      disclosure.append(node('summary',text('rejectOptions')));
      const label=node('label',text('reason')); const reason=document.createElement('input');
      reason.className='admin-reason';reason.maxLength=500;reason.value=draft.reason;reason.dataset.requestReason=request.id;
      reason.addEventListener('input',()=>{draft.reason=reason.value;});label.append(reason);disclosure.append(label);
      button('reject','cancelled',reason,disclosure);card.append(disclosure);
    }
    if (request.state === 'ready') button('checkout', 'borrowed');
    if (request.state === 'borrowed') button('return', 'returned');
    card.append(actions); $('admin-requests').append(card);
  }
  if (editing) {
    const input=[...$('admin-requests').querySelectorAll('input[data-request-reason]')].find(el=>el.dataset.requestReason===editing.id);
    if (input) {input.focus({preventScroll:true});input.setSelectionRange(editing.start,editing.end);}
  }
}
function inventory() {
  const target = $('admin-inventory'); target.replaceChildren();
  const groups = new Map();
  for (const copy of Object.values(catalogue.copies)) {
    const key = copy.editionId + ':' + copy.libraryId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(copy);
  }
  for (const copies of groups.values()) {
    const copy = copies[0], edition = catalogue.editions[copy.editionId];
    const work = catalogue.works[edition?.workId], card = node('article', '', 'journey-card');
    card.append(node('h3', local(work?.title) || copy.editionId),
      node('p', local(catalogue.libraries[copy.libraryId]?.name) || copy.libraryId, 'admin-date'));
    const stock = node('div', '', 'admin-stock-numbers');
    for (const [key, value] of [
      ['count', copies.length], ['available', copies.filter(c => c.availability === 'available').length],
      ['held', copies.filter(c => ['held', 'ready'].includes(c.availability)).length],
      ['onLoan', copies.filter(c => c.availability === 'onLoan').length]
    ]) {
      const stat = node('span', text(key));
      stat.append(node('strong', new Intl.NumberFormat(locale).format(value))); stock.append(stat);
    }
    card.append(stock);
    const archive = node('button', locale === 'en' ? (work?.archived ? 'Restore to catalogue' : 'Remove from reader catalogue') :
      (work?.archived ? 'তালিকায় ফিরিয়ে আনুন' : 'পাঠকের তালিকা থেকে সরান'), 'button button-outline');
    archive.disabled = busy;
    archive.onclick = async () => {
      if (busy) return; busy = true; archive.disabled = true;
      try { await store.archiveWork(edition.workId, !work.archived); await reload(); feedback('saved'); }
      catch { feedback('error'); }
      finally { busy = false; inventory(); }
    };
    if (work?.archived) card.append(node('p', locale === 'en' ? 'Hidden from reader catalogue; history preserved.' : 'পাঠকের তালিকায় নেই; ইতিহাস সংরক্ষিত।'));
    card.append(archive);
    target.append(card);
  }
  if (!groups.size) target.append(node('p', text('empty')));
}
async function loadMore(reset = false) {
  const sequence = ++pageSequence, epoch = authEpoch;
  const page = await store.requests($('admin-state').value, $('admin-library').value || 'all', reset ? null : cursor);
  if (epoch !== authEpoch || sequence !== pageSequence) return;
  rows = reset ? page.records : [...rows, ...page.records]; cursor = page.cursor;
  $('admin-more').hidden = !page.more; renderRequests();
}
async function reload() {
  catalogue = await store.catalogue();
  summary = await store.overview().catch(() => null);
  libraries(); inventory(); metrics(); await loadMore(true);
}
function formData(form) {
  return Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, value.trim()]));
}
for (const button of document.querySelectorAll('[data-locale]')) button.addEventListener('click', () => {
  locale = button.dataset.locale;
  try { localStorage.setItem('book-warehouse-locale', locale); } catch {}
  labels(); if (authorized && catalogue) { libraries(); inventory(); metrics(); renderRequests(); notifications(); }
});
for (const link of document.querySelectorAll('#admin-content a[href^="#"]')) link.addEventListener('click', event => {
  event.preventDefault();
  selectPanel(link.hash.slice(1)); history.replaceState(null, '', link.hash);
  if (link.dataset.status) {
    $('admin-state').value = link.dataset.status;
    loadMore(true).catch(() => feedback('loadError'));
  }
});
window.addEventListener('hashchange', () => selectPanel(location.hash.slice(1)));
selectPanel(location.hash.slice(1));
labels(); feedback('loading');
try {
  const emulator = ['localhost','127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).get('emulator') === '1';
  store = await createAdminStore(emulator);
  if (emulator) emulatorLogin(store.auth); else initDigitalAdmin(store);
  $('admin-sign-in').addEventListener('click', async () => {
    try { await signInWithPopup(store.auth, new GoogleAuthProvider()); } catch { feedback('error'); }
  });
  $('admin-sign-out').addEventListener('click', () => signOut(store.auth));
  onAuthStateChanged(store.auth, async user => {
    stopCreditTopupInbox();
    const epoch = ++authEpoch; stopAttention(); attention = []; handoffs = {}; noticeBox.replaceChildren();
    stopSelected(); selectedId='';selectedRequest=null;selectionNotice='';actionNotice='';reviewDrafts.clear();rows=[];
    authorized = false; $('admin-content').hidden = true;
    $('admin-sign-in').hidden = !!user; $('admin-sign-out').hidden = !user;
    $('admin-account').textContent = user?.displayName || '';
    try {
      if (!user) return feedback('signedOut');
      authorized = await store.authorized();
      if (epoch !== authEpoch) return;
      if (!authorized) return feedback('denied');
      $('admin-content').hidden = false;
      stopCreditTopupInbox = mountCreditTopupInbox(store);
      await reload(); $('admin-feedback').textContent = '';
      if (epoch !== authEpoch) return;
      const requestedId=new URL(location.href).searchParams.get('request');
      if (requestedId && /^[A-Za-z0-9_-]{1,256}$/.test(requestedId)) chooseRequest(requestedId,false);
      stopAttention = store.watchAttention((items, signals) => {
        if (epoch !== authEpoch) return;
        attention = items; handoffs = signals; notifications();
        loadMore(true).catch(() => feedback('loadError'));
        store.overview().then(value => { if (epoch === authEpoch) { summary = value; metrics(); } }).catch(() => {});
      }, () => feedback('loadError'));
    } catch (error) { feedback(error.code === 'permission-denied' ? 'permissions' : 'loadError'); }
  });
  for (const id of ['admin-state', 'admin-library', 'admin-refresh']) {
    $(id).addEventListener(id === 'admin-refresh' ? 'click' : 'change', () => reload().catch(() => feedback('error')));
  }
  $('admin-more').addEventListener('click', () => loadMore().catch(() => feedback('error')));
  $('book-form').addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    const input = formData(event.target), payload = JSON.stringify(input);
    if (!inventoryOperation || inventoryOperation.payload !== payload) inventoryOperation = { payload, id: crypto.randomUUID() };
    busy = true; const button = event.target.querySelector('button'); button.disabled = true;
    try {
      await store.addBook(input, inventoryOperation.id); inventoryOperation = null;
      event.target.reset(); await reload(); feedback('saved');
    } catch { feedback('error'); }
    finally { busy = false; button.disabled = false; renderRequests(); inventory(); }
  });
  $('library-form').addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    busy = true; const button = event.target.querySelector('button'); button.disabled = true;
    try { await store.addLibrary(formData(event.target)); event.target.reset(); await reload(); feedback('saved'); }
    catch { feedback('error'); }
    finally { busy = false; button.disabled = false; renderRequests(); inventory(); }
  });
} catch { feedback('error'); }
