import { groupHoldings } from './catalogue-holdings.js';
import { createSharedStore } from './shared-store.js';
import { createSparkStore } from './spark-store.js';

const words = {
  en: {
    title: 'Fictional shared catalogue', label: 'Local Firebase emulators only. Immediate reservation is provisional.',
    email: 'Email', password: 'Password', signIn: 'Sign in', signOut: 'Sign out', catalogue: 'Catalogue',
    search: 'Search in Bangla or English', library: 'Library', allLibraries: 'All libraries', availability: 'Availability', allCopies: 'All copies', available: 'Available', unavailable: 'Unavailable',
    requests: 'My requests', operator: 'Library queue', requestCopy: 'Request copy', cancelRequest: 'Cancel request', markReady: 'Mark ready', checkOut: 'Record checkout', markReturned: 'Record return', retry: 'Check or retry same request',
    requested: 'Requested', ready: 'Ready', borrowed: 'Borrowed', returned: 'Returned', cancelled: 'Cancelled',
    signInRequired: 'Sign in to request a copy.', offline: 'Offline. Shared actions need the emulators.', permissionDenied: 'Permission denied.',
    conflict: 'This copy changed. Refresh the catalogue.', copyUnavailable: 'This copy is no longer available.', stageInvalid: 'That change is not allowed.',
    requestCreated: 'Copy reserved in the emulator.', stageChanged: 'Status updated in the emulator.', unknownOutcome: 'Outcome unknown. Check or retry with the same operation ID.',
    operationMismatch: 'The operation ID belongs to a different action.', invalidInput: 'Invalid action.', requestMissing: 'Request not found.', serverUnavailable: 'Emulator unavailable.', empty: 'No matching records.',
    sample: 'Fictional sample record', account: 'Signed in: ', nextRequested: 'Next: the library confirms when this copy is ready.', nextReady: 'Next: collect the copy and have the loan recorded.', nextBorrowed: 'Next: return the copy to the library.', nextReturned: 'Journey complete. The copy is available again.', nextCancelled: 'This request was cancelled.'
  },
  bn: {
    title: 'কাল্পনিক যৌথ বইয়ের তালিকা', label: 'শুধু স্থানীয় Firebase এমুলেটর। অনুরোধ করলেই সংরক্ষণ আপাতত পরীক্ষামূলক নিয়ম।',
    email: 'ইমেইল', password: 'পাসওয়ার্ড', signIn: 'সাইন ইন', signOut: 'সাইন আউট', catalogue: 'বইয়ের তালিকা',
    search: 'বাংলা বা ইংরেজিতে খুঁজুন', library: 'পাঠাগার', allLibraries: 'সব পাঠাগার', availability: 'পাওয়ার অবস্থা', allCopies: 'সব কপি', available: 'পাওয়া যাচ্ছে', unavailable: 'পাওয়া যাচ্ছে না',
    requests: 'আমার অনুরোধ', operator: 'পাঠাগারের কাজ', requestCopy: 'কপি অনুরোধ করুন', cancelRequest: 'অনুরোধ বাতিল করুন', markReady: 'প্রস্তুত চিহ্নিত করুন', checkOut: 'ধার দেওয়া নথিভুক্ত করুন', markReturned: 'ফেরত নথিভুক্ত করুন', retry: 'একই অনুরোধ যাচাই বা আবার পাঠান',
    requested: 'অনুরোধ করা হয়েছে', ready: 'প্রস্তুত', borrowed: 'ধার দেওয়া হয়েছে', returned: 'ফেরত এসেছে', cancelled: 'বাতিল',
    signInRequired: 'কপি অনুরোধ করতে সাইন ইন করুন।', offline: 'অফলাইন। যৌথ কাজের জন্য এমুলেটর প্রয়োজন।', permissionDenied: 'অনুমতি নেই।',
    conflict: 'কপির অবস্থা বদলেছে। তালিকা নতুন করে দেখুন।', copyUnavailable: 'কপিটি আর পাওয়া যাচ্ছে না।', stageInvalid: 'এই পরিবর্তন অনুমোদিত নয়।',
    requestCreated: 'এমুলেটরে কপিটি সংরক্ষিত হয়েছে।', stageChanged: 'এমুলেটরে অবস্থা বদলেছে।', unknownOutcome: 'ফল নিশ্চিত নয়। একই অপারেশন আইডি দিয়ে যাচাই বা আবার চেষ্টা করুন।',
    operationMismatch: 'অপারেশন আইডিটি অন্য কাজের।', invalidInput: 'কাজটি বৈধ নয়।', requestMissing: 'অনুরোধ পাওয়া যায়নি।', serverUnavailable: 'এমুলেটর পাওয়া যাচ্ছে না।', empty: 'মিলে এমন তথ্য নেই।',
    sample: 'কাল্পনিক নমুনা তথ্য', account: 'সাইন ইন: ', nextRequested: 'এরপর: বই প্রস্তুত হলে পাঠাগার জানাবে।', nextReady: 'এরপর: বইটি সংগ্রহ করুন; ধার দেওয়ার তথ্য নথিভুক্ত হবে।', nextBorrowed: 'এরপর: বইটি পাঠাগারে ফেরত দিন।', nextReturned: 'যাত্রা শেষ। বইটি আবার পাওয়া যাচ্ছে।', nextCancelled: 'এই অনুরোধ বাতিল হয়েছে।'
  }
};
Object.assign(words.en, {
  sparkLabel: 'Fictional Spark borrowing catalogue. Shared records require sign-in.',
  sparkEmulatorLabel: 'Fictional Spark borrowing catalogue on local Firebase emulators.',
  google: 'Continue with Google', cancelledSignIn: 'Sign-in cancelled. Your copy is still selected.', signInFailed: 'Sign-in failed. Check your details and try again.', retrySignIn: 'Retry sign-in', cancelSignIn: 'Cancel sign-in',
  selected: 'Selected copy. Sign in to continue.', confirmTitle: 'Confirm your request', confirm: 'Confirm request', cancelSelection: 'Choose another copy',
  whatsapp: 'WhatsApp number (optional)', whatsappHelp: 'The holding library may use this number to coordinate pickup. Use international format, such as +8801XXXXXXXXX.', invalidContact: 'Enter a valid international number beginning with +, or leave it blank.',
  confirmationUnavailable: 'This copy became unavailable. Choose another copy.', borrowingDisabled: 'Staging borrowing remains disabled until the trusted service is configured.', setup: 'Staging configuration is unavailable.',
  super: 'All requests', superLibrary: 'Library', superState: 'Status', allStates: 'All statuses', noRequests: 'No requests yet.', noOperator: 'No requests for your library.', noSuper: 'No requests match these filters.',
  source: 'Source library: ', pickup: 'Pickup: ', returnLocation: 'Return: ', notConfirmed: 'Not confirmed', recorded: 'Recorded status: ', contact: 'WhatsApp: ', help: 'Library help: ',
  waiting: 'Waiting for library confirmation', collect: 'Collect from the holding library', bringBack: 'Return to the holding library', completed: 'Returned to the holding library', cancelledNext: 'Request cancelled', accountPending: 'Signed in. Reader account setup is pending.',
  stagingLabel: 'Staging preview with fictional catalogue data.', activeRequests: 'Active requests', currentLoans: 'Current loans', returnedBooks: 'Returned books', cancelledRequests: 'Cancelled requests', cancelReason: 'Cancellation reason',
  locationUnconfirmed: 'The library has not confirmed a pickup point.'
});
Object.assign(words.en, {
    profile: 'Reader profile', displayName: 'Your name', saveProfile: 'Save name', profileSaved: 'Name saved.', testAccounts: 'Fictional emulator test accounts', retrySetup: 'Retry profile setup',
  profileNote: 'Sign in to view or edit your reader profile.', googleTest: 'Test Google sign-in',
  requestingAs: 'Requesting as: ',
  profileRequired: 'Add your name to your reader profile before requesting a copy.',
  invalidName: 'Enter a name of up to 120 characters.', profileSaveFailed: 'Could not save your name. Try again.',
  borrower: 'Borrower: ', unnamedBorrower: 'Name unavailable for this earlier request'
});
Object.assign(words.bn, {
  sparkLabel: 'কাল্পনিক Spark ধার নেওয়ার তালিকা। যৌথ তথ্যের জন্য সাইন ইন প্রয়োজন।',
  sparkEmulatorLabel: 'স্থানীয় Firebase এমুলেটরে কাল্পনিক Spark ধার নেওয়ার তালিকা।',
  google: 'Google দিয়ে চালিয়ে যান', cancelledSignIn: 'সাইন ইন বাতিল হয়েছে। আপনার কপিটি নির্বাচিত আছে।', signInFailed: 'সাইন ইন হয়নি। তথ্য দেখে আবার চেষ্টা করুন।', retrySignIn: 'আবার সাইন ইন', cancelSignIn: 'সাইন ইন বাতিল',
  selected: 'কপি নির্বাচিত। চালিয়ে যেতে সাইন ইন করুন।', confirmTitle: 'অনুরোধ নিশ্চিত করুন', confirm: 'অনুরোধ নিশ্চিত করুন', cancelSelection: 'অন্য কপি বাছুন',
  whatsapp: 'WhatsApp নম্বর (ঐচ্ছিক)', whatsappHelp: 'কপি সংগ্রহের সমন্বয়ে সংশ্লিষ্ট পাঠাগার এই নম্বর ব্যবহার করতে পারে। +8801XXXXXXXXX এর মতো আন্তর্জাতিক ফরম্যাট ব্যবহার করুন।', invalidContact: '+ দিয়ে শুরু বৈধ আন্তর্জাতিক নম্বর দিন, অথবা ফাঁকা রাখুন।',
  confirmationUnavailable: 'এই কপি আর পাওয়া যাচ্ছে না। অন্য কপি বাছুন।', borrowingDisabled: 'নির্ভরযোগ্য সেবা কনফিগার না হওয়া পর্যন্ত স্টেজিংয়ে অনুরোধ বন্ধ।', setup: 'স্টেজিং কনফিগারেশন পাওয়া যায়নি।',
  super: 'সব অনুরোধ', superLibrary: 'পাঠাগার', superState: 'অবস্থা', allStates: 'সব অবস্থা', noRequests: 'এখনও কোনো অনুরোধ নেই।', noOperator: 'আপনার পাঠাগারে কোনো অনুরোধ নেই।', noSuper: 'এই ফিল্টারে কোনো অনুরোধ নেই।',
  source: 'উৎস পাঠাগার: ', pickup: 'সংগ্রহ: ', returnLocation: 'ফেরত: ', notConfirmed: 'নিশ্চিত নয়', recorded: 'নথিভুক্ত অবস্থা: ', contact: 'WhatsApp: ', help: 'পাঠাগারের সহায়তা: ',
  waiting: 'পাঠাগারের নিশ্চয়তার অপেক্ষা', collect: 'সংশ্লিষ্ট পাঠাগার থেকে সংগ্রহ করুন', bringBack: 'সংশ্লিষ্ট পাঠাগারে ফেরত দিন', completed: 'সংশ্লিষ্ট পাঠাগারে ফেরত নথিভুক্ত', cancelledNext: 'অনুরোধ বাতিল হয়েছে', accountPending: 'সাইন ইন হয়েছে। পাঠক অ্যাকাউন্ট প্রস্তুত নয়।',
  stagingLabel: 'কাল্পনিক তালিকাসহ স্টেজিং প্রিভিউ।', activeRequests: 'চলমান অনুরোধ', currentLoans: 'বর্তমান ধার', returnedBooks: 'ফেরত বই', cancelledRequests: 'বাতিল অনুরোধ', cancelReason: 'বাতিলের কারণ',
  locationUnconfirmed: 'সংগ্রহের স্থান পাঠাগার এখনও নিশ্চিত করেনি।'
});
Object.assign(words.bn, {
  profile: 'পাঠক প্রোফাইল', displayName: 'আপনার নাম', saveProfile: 'নাম সংরক্ষণ করুন', profileSaved: 'নাম সংরক্ষিত হয়েছে।', testAccounts: 'কাল্পনিক এমুলেটর পরীক্ষার অ্যাকাউন্ট', retrySetup: 'প্রোফাইল আবার তৈরি করুন',
  profileNote: 'পাঠক প্রোফাইল দেখতে বা বদলাতে সাইন ইন করুন।', googleTest: 'পরীক্ষামূলক Google সাইন ইন',
  requestingAs: 'অনুরোধকারী: ',
  profileRequired: 'কপি অনুরোধের আগে পাঠক প্রোফাইলে আপনার নাম যোগ করুন।',
  invalidName: 'সর্বোচ্চ ১২০ অক্ষরের একটি নাম লিখুন।', profileSaveFailed: 'নাম সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।',
  borrower: 'পাঠক: ', unnamedBorrower: 'আগের এই অনুরোধে নাম পাওয়া যায়নি'
});
const spark = /\/spark(?:-emulator)?\.html$/.test(location.pathname);
const sparkEmulator = location.pathname.endsWith('/spark-emulator.html');
const staging = location.pathname.endsWith('/staging.html') || (spark && !sparkEmulator);
const store = await (spark ? createSparkStore(sparkEmulator) : createSharedStore(staging)).catch(() => null);
const $ = id => document.getElementById(id);
const localeKey = 'book-warehouse-locale';
let locale = (() => { try { return localStorage.getItem(localeKey) === 'en' ? 'en' : 'bn'; } catch { return 'bn'; } })();
let catalogue = { libraries: {}, works: {}, editions: {}, copies: {} };
let mine = [];
let operatorRequests = [];
let allRequests = null;
let libraries = [];
let lastCode = '';
let selectedCopy = null;
let submitting = false;
let authError = false;
let profileData = null;
let signingIn = false;
const sparkOutcomes = {
  en: { requestCreated: 'Copy reserved.', stageChanged: 'Status updated.', offline: 'Offline. Shared actions need a connection.', serverUnavailable: 'Shared service unavailable.', borrowingDisabled: 'Spark borrowing is awaiting verification.', setup: 'Spark configuration is unavailable.' },
  bn: { requestCreated: 'কপিটি সংরক্ষিত হয়েছে।', stageChanged: 'অবস্থা বদলেছে।', offline: 'অফলাইন। যৌথ কাজের জন্য সংযোগ প্রয়োজন।', serverUnavailable: 'যৌথ সেবা পাওয়া যাচ্ছে না।', borrowingDisabled: 'Spark ধার নেওয়া যাচাইয়ের অপেক্ষায় আছে।', setup: 'Spark কনফিগারেশন পাওয়া যায়নি।' }
};
const text = key => (spark && sparkOutcomes[locale][key]) || words[locale][key] || words.en[key] || key;
const local = value => value?.[locale] || value?.[locale === 'bn' ? 'en' : 'bn'] || '';
const node = (tag, content, className) => { const item = document.createElement(tag); item.textContent = content; if (className) item.className = className; return item; };
function book(copy) {
  const edition = catalogue.editions[copy.editionId];
  return edition && catalogue.works[edition.workId];
}
function status(code) { lastCode = code; $('shared-feedback').textContent = code ? text(code) : ''; $('retry-command').hidden = !store?.pending(); if (spark) $('retry-sign-in').textContent = text(code === 'accountPending' ? 'retrySetup' : 'retrySignIn'); }
function renderLabels() {
  document.documentElement.lang = locale;
  document.title = text('title') + ' | Book Warehouse';
  for (const [id, key] of Object.entries({ 'shared-title': 'title', 'shared-label': staging ? 'borrowingDisabled' : 'label', 'email-label': 'email', 'password-label': 'password', 'sign-in-button': 'signIn', 'google-sign-in': sparkEmulator ? 'googleTest' : 'google', 'sign-out': 'signOut', 'cancel-sign-in': 'cancelSignIn', 'retry-sign-in': 'retrySignIn', 'profile-heading': 'profile', 'profile-note': 'profileNote', 'profile-name-label': 'displayName', 'profile-save': 'saveProfile', 'confirmation-heading': 'confirmTitle', 'whatsapp-label': 'whatsapp', 'whatsapp-help': 'whatsappHelp', 'confirm-request': 'confirm', 'cancel-selection': 'cancelSelection', 'catalogue-heading': 'catalogue', 'search-label': 'search', 'library-label': 'library', 'availability-label': 'availability', 'requests-heading': 'requests', 'operator-heading': 'operator', 'super-heading': 'super', 'super-library-label': 'superLibrary', 'super-state-label': 'superState', 'retry-command': 'retry' })) { if ($(id)) $(id).textContent = text(key); }
  if ($('test-accounts-label')) $('test-accounts-label').textContent = text('testAccounts');
  $('shared-library').options[0].textContent = text('allLibraries');
  $('shared-availability').options[0].textContent = text('allCopies');
  $('shared-availability').options[1].textContent = text('available');
  document.querySelectorAll('[data-locale]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.locale === locale)));
  $('super-library').options[0].textContent = text('allLibraries');
  $('super-state').options[0].textContent = text('allStates');
  for (const option of [...$('super-state').options].slice(1)) option.textContent = text(option.value);
  $('account-name').textContent = store?.user() ? text('account') + (profileData?.displayName || store.user().displayName || store.user().email || '') : '';
  if (spark) $('shared-label').textContent = text(sparkEmulator ? 'sparkEmulatorLabel' : 'sparkLabel');
  else if (staging && store?.borrowingEnabled) $('shared-label').textContent = text('stagingLabel');
}
function fillLibraries() {
  const select = $('shared-library');
  const selected = select.value;
  select.replaceChildren(node('option', text('allLibraries')));
  select.options[0].value = 'all';
  Object.values(catalogue.libraries).forEach(library => {
    const option = node('option', local(library.name)); option.value = library.id; select.append(option);
  });
  select.value = selected && [...select.options].some(option => option.value === selected) ? selected : 'all';
  const overview = $('super-library');
  const old = overview.value;
  overview.replaceChildren(node('option', text('allLibraries')));
  overview.options[0].value = 'all';
  Object.values(catalogue.libraries).forEach(library => { const option = node('option', local(library.name)); option.value = library.id; overview.append(option); });
  overview.value = old && [...overview.options].some(option => option.value === old) ? old : 'all';
}
function action(kind, targetId, label) {
  const button = node('button', text(label), 'button button-dark'); button.type = 'button';
  button.addEventListener('click', async () => {
    button.disabled = true;
    const result = await store.execute(kind, targetId);
    status(result.code);
    if (result.ok) await refresh();
    else button.disabled = false;
  });
  return button;
}
function operatorCancel(requestId) {
  const form = node('form', '', 'cancel-form');
  const label = node('label', text('cancelReason'));
  const input = document.createElement('input'); input.required = true; input.maxLength = 200;
  const button = node('button', text('cancelRequest'), 'button button-outline'); button.type = 'submit';
  label.append(input); form.append(label, button);
  form.addEventListener('submit', async event => {
    event.preventDefault(); button.disabled = true;
    const result = await store.execute('cancelRequest', requestId, false, '', input.value.trim());
    status(result.code); if (result.ok) await refresh(); else button.disabled = false;
  });
  return form;
}
async function beginGoogleSignIn() {
  if (signingIn) return;
  signingIn = true;
  $('google-sign-in').disabled = true;
  try { await store.signInGoogle(); authError = false; }
  catch (error) {
    authError = true; $('retry-sign-in').hidden = false;
    status(['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(error.code) ? 'cancelledSignIn' : 'signInFailed');
  } finally { signingIn = false; $('google-sign-in').disabled = false; }
}
async function selectCopy(copyId) {
  if (!store.borrowingEnabled) return status('borrowingDisabled');
  if (allRequests) return status('permissionDenied');
  selectedCopy = copyId;
  if (!store.user()) {
    status('selected');
    $('cancel-sign-in').hidden = spark;
    if (spark) return beginGoogleSignIn();
    (staging ? $('google-sign-in') : $('sign-in').elements.namedItem('email')).focus();
    return;
  }
  await showConfirmation();
}
async function showConfirmation() {
  if (!selectedCopy || !store.user()) return;
  if (spark && (!profileData?.displayName?.trim() || profileData.displayName !== profileData.displayName.trim())) {
    status('profileRequired'); $('profile-name').focus(); return;
  }
  try {
    const copy = await store.getCopy(selectedCopy);
    if (!copy || copy.availability !== 'available' || copy.activeRequestId !== null) {
      selectedCopy = null; $('confirmation').hidden = true; status('confirmationUnavailable'); await refresh(); return;
    }
    catalogue.copies[copy.id] = copy;
    const work = book(copy);
    $('confirmation-copy').textContent = work ? local(work.title) : copy.id;
    $('confirmation-library').textContent = text('source') + local(catalogue.libraries[copy.libraryId]?.name);
    if (spark) $('confirmation-reader').textContent = text('requestingAs') + profileData.displayName;
    $('confirmation').hidden = false;
    $('confirm-request').focus();
    status('');
  } catch { status(navigator.onLine ? 'serverUnavailable' : 'offline'); }
}
function renderCatalogue() {
  const target = $('shared-catalogue'); target.replaceChildren();
  const term = $('shared-search').value.trim().normalize('NFC').toLocaleLowerCase();
  const library = $('shared-library').value;
  const availableOnly = $('shared-availability').value === 'available';
  const filteredCopies = Object.values(catalogue.copies).filter(copy => {
    const work = book(copy); if (!work || work.archived === true) return false;
    const searchable = [...Object.values(work.title), ...Object.values(work.authorDisplay), ...Object.values(work.topics).flat()].join(' ').normalize('NFC').toLocaleLowerCase();
    return (!term || searchable.includes(term)) && (library === 'all' || copy.libraryId === library);
  });
  const holdings = groupHoldings(filteredCopies).filter(group => !availableOnly || group.availableCopies.length > 0);
  holdings.forEach(group => {
    const copy = group.selectedCopy;
    const work = book(copy);
    const article = node('article', '', 'book-card');
    const body = node('div', '', 'book-body');
    body.append(node('p', text('sample'), 'book-category'), node('h3', local(work.title)), node('p', local(work.authorDisplay), 'book-author'), node('p', local(catalogue.libraries[copy.libraryId]?.name), 'book-location'));
    const foot = node('div', '', 'book-foot');
    const available = group.availableCopies.length > 0;
    const count = new Intl.NumberFormat(locale).format(group.availableCopies.length);
    foot.append(node('span', available ? (locale === 'bn' ? `${count}টি পাওয়া যাচ্ছে` : `${count} available`) : text('unavailable'), 'availability ' + (available ? 'available' : 'unavailable')));
    if (available && store?.borrowingEnabled && !allRequests) { const button = node('button', text('requestCopy'), 'button button-dark'); button.type = 'button'; button.addEventListener('click', () => selectCopy(copy.id)); foot.append(button); }
    body.append(foot); article.append(body); target.append(article);
  });
  if (!target.childElementCount) target.append(node('p', text('empty')));
}
function requestCard(request, mode) {
  const copy = catalogue.copies[request.copyId];
  const work = copy && book(copy);
  const article = node('article', '', 'journey-card');
  const library = catalogue.libraries[request.libraryId];
  article.append(node('h3', work ? local(work.title) : request.copyId), node('p', text('source') + (local(library?.name) || request.libraryId)), node('p', text(request.state), 'stage-pill stage-' + request.state));
  if (spark && (mode === 'operator' || mode === 'reader')) article.append(node('p', text('borrower') + (request.readerName || text('unnamedBorrower'))));
  if (request.decisionReason) article.append(node('p', request.decisionReason));
  if (mode !== 'super') {
    const next = { requested: 'waiting', ready: 'collect', borrowed: 'bringBack', returned: 'completed', cancelled: 'cancelledNext' };
    article.append(node('p', text(next[request.state])));
    article.append(node('p', text('pickup') + (library?.approvedPickupLocation ? local(library.approvedPickupLocation) : text('locationUnconfirmed'))));
    article.append(node('p', text('returnLocation') + (request.returnedAt ? local(library?.name) : text('notConfirmed'))));
    const event = (key, at) => at && `${text(key)} · ${new Intl.DateTimeFormat(locale === 'bn' ? 'bn-BD' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(at.toDate?.() || new Date(at))}`;
    article.append(node('p', text('recorded') + [event('requested', request.createdAt), event('ready', request.readyAt), event('borrowed', request.borrowedAt), event('returned', request.returnedAt), event('cancelled', request.cancelledAt)].filter(Boolean).join(' / ')));
    if (library?.publicHelpContact) article.append(node('p', text('help') + library.publicHelpContact));
    if (request.contact) article.append(node('p', text('contact') + request.contact));
  }
  const actions = node('div', '', 'journey-actions');
  if (mode === 'operator') {
    if (request.state === 'requested') actions.append(action('markReady', request.id, 'markReady'));
    if (request.state === 'ready') actions.append(action('checkOut', request.id, 'checkOut'));
    if (request.state === 'borrowed') actions.append(action('markReturned', request.id, 'markReturned'));
    if (!spark && ['requested', 'ready'].includes(request.state)) actions.append(operatorCancel(request.id));
  } else if (mode === 'reader' && !allRequests && ['requested', 'ready'].includes(request.state)) actions.append(action('cancelRequest', request.id, 'cancelRequest'));
  article.append(actions);
  return article;
}
function render() {
  renderLabels(); fillLibraries(); renderCatalogue();
  if (spark) {
    $('profile-section').hidden = false;
    $('profile-form').hidden = !store?.user();
    $('profile-note').hidden = !!store?.user();
    if (document.activeElement !== $('profile-name')) $('profile-name').value = profileData?.displayName || '';
  }
  if (selectedCopy && !$('confirmation').hidden) {
    const copy = catalogue.copies[selectedCopy];
    const work = copy && book(copy);
    $('confirmation-copy').textContent = work ? local(work.title) : selectedCopy;
    $('confirmation-library').textContent = text('source') + local(catalogue.libraries[copy?.libraryId]?.name);
    if (spark) $('confirmation-reader').textContent = text('requestingAs') + (profileData?.displayName || '');
  }
  $('reader-section').hidden = !store?.user();
  $('shared-requests').replaceChildren();
  for (const [heading, states] of [['activeRequests', ['requested', 'ready']], ['currentLoans', ['borrowed']], ['returnedBooks', ['returned']], ['cancelledRequests', ['cancelled']]]) {
    const group = mine.filter(request => states.includes(request.state));
    if (group.length) $('shared-requests').append(node('h3', text(heading)), ...group.map(request => requestCard(request, 'reader')));
  }
  if (!mine.length) $('shared-requests').append(node('p', text('noRequests')));
  $('operator-section').hidden = !libraries.length;
  $('operator-requests').replaceChildren(...operatorRequests.map(request => requestCard(request, 'operator')));
  if (libraries.length && !operatorRequests.length) $('operator-requests').append(node('p', text('noOperator')));
  $('super-section').hidden = !allRequests;
  const visible = (allRequests || []).filter(request => ($('super-library').value === 'all' || request.libraryId === $('super-library').value) && ($('super-state').value === 'all' || request.state === $('super-state').value));
  $('super-requests').replaceChildren(...visible.map(request => requestCard(request, 'super')));
  if (allRequests && !visible.length) $('super-requests').append(node('p', text('noSuper')));
  status(lastCode);
}
async function refresh() {
  try {
    catalogue = await store.catalogue();
    if (spark) profileData = await store.profile();
    mine = await store.myRequests();
    libraries = await store.operatorLibrary() || [];
    operatorRequests = (await Promise.all(libraries.map(id => store.libraryRequests(id)))).flat();
    allRequests = await store.allRequests();
    await Promise.all([...mine, ...operatorRequests].map(async request => { try { request.contact = await store.contact(request.id); } catch { request.contact = ''; } }));
    render();
  } catch { status(navigator.onLine ? 'serverUnavailable' : 'offline'); }
}
document.querySelectorAll('[data-locale]').forEach(button => button.addEventListener('click', () => {
  locale = button.dataset.locale;
  try { localStorage.setItem(localeKey, locale); } catch { /* Page selection still works. */ }
  render();
}));
renderLabels();
if (store) {
  if (spark) $('profile-form').addEventListener('submit', async event => {
    event.preventDefault();
    const name = $('profile-name').value.trim();
    if (!name || name.length > 120) return status('invalidName');
    const button = $('profile-save'); button.disabled = true;
    try {
      profileData = await store.updateProfile(name);
      render(); status('profileSaved');
      if (selectedCopy) await showConfirmation();
    } catch { status('profileSaveFailed'); }
    finally { button.disabled = false; }
  });
  $('sign-in').addEventListener('submit', async event => {
    event.preventDefault();
    try { await store.signIn(event.target.elements.namedItem('email').value, event.target.elements.namedItem('password').value); authError = false; $('retry-sign-in').hidden = true; status(''); }
    catch { authError = true; $('retry-sign-in').hidden = false; status('signInFailed'); }
  });
  $('google-sign-in').addEventListener('click', beginGoogleSignIn);
  $('cancel-sign-in').addEventListener('click', () => {
    $('cancel-sign-in').hidden = true; $('retry-sign-in').hidden = false; status('cancelledSignIn');
  });
  $('retry-sign-in').addEventListener('click', () => {
    $('retry-sign-in').hidden = true; $('cancel-sign-in').hidden = !selectedCopy;
    if (spark) {
      $('cancel-sign-in').hidden = true;
      if (store.user()) return store.ensureReader().then(async () => { await refresh(); if (selectedCopy) await showConfirmation(); }).catch(() => { status('accountPending'); $('retry-sign-in').hidden = false; });
      return beginGoogleSignIn();
    }
    (staging ? $('google-sign-in') : $('sign-in').elements.namedItem('email')).focus();
  });
  $('sign-out').addEventListener('click', async () => {
    await store.signOut(); selectedCopy = null; $('confirmation').hidden = true; status('');
  });
  $('cancel-selection').addEventListener('click', () => { selectedCopy = null; $('confirmation').hidden = true; status(''); });
  $('confirm-request').addEventListener('click', async () => {
    if (submitting || store.pending() || !selectedCopy) return;
    const whatsapp = $('whatsapp').value.trim();
    if (whatsapp && !/^\+[1-9][0-9]{7,14}$/.test(whatsapp)) return status('invalidContact');
    submitting = true; $('confirm-request').disabled = true;
    try {
      const copy = await store.getCopy(selectedCopy);
      if (!copy || copy.availability !== 'available' || copy.activeRequestId !== null) {
        selectedCopy = null; $('confirmation').hidden = true; status('confirmationUnavailable'); await refresh(); return;
      }
      const result = await store.execute('requestCopy', selectedCopy, false, whatsapp);
      status(result.code);
      if (result.ok || store.pending()) { selectedCopy = null; $('confirmation').hidden = true; $('whatsapp').value = ''; }
      if (result.ok || result.code === 'copyUnavailable') await refresh();
    } catch { status('serverUnavailable'); }
    finally { submitting = false; $('confirm-request').disabled = false; }
  });
  $('retry-command').addEventListener('click', async () => {
    const result = await store.execute(null, null, true);
    status(result.code);
    if (result.ok) await refresh();
  });
  ['shared-search', 'shared-library', 'shared-availability'].forEach(id => $(id).addEventListener(id === 'shared-search' ? 'input' : 'change', renderCatalogue));
  ['super-library', 'super-state'].forEach(id => $(id).addEventListener('change', render));
  store.onAuth(async user => {
    $('sign-in').hidden = staging || !!user;
    $('google-sign-in').hidden = (!staging && !spark) || !!user;
    $('shared-account').hidden = !user;
    if (spark) { $('profile-form').hidden = !user; $('profile-note').hidden = !!user; }
    $('cancel-sign-in').hidden = true;
    mine = []; libraries = []; operatorRequests = []; allRequests = null; profileData = null;
    let accountReady = true;
    if (user && (staging || spark)) { try { await store.ensureReader(); } catch { accountReady = false; status('accountPending'); if (spark) $('retry-sign-in').hidden = false; } }
    await refresh();
    if (user && selectedCopy && accountReady) await showConfirmation();
    if (user && accountReady && spark) $('retry-sign-in').hidden = true;
    if (store.pending()) status('unknownOutcome');
  });
} else {
  $('sign-in').hidden = true;
  $('google-sign-in').hidden = !spark;
  $('google-sign-in').disabled = true;
  if (spark) $('google-sign-in').title = text('setup');
  renderLabels(); status('setup');
}
