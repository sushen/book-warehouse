import { onAuthStateChanged } from 'firebase/auth';
import { createDigitalStore } from './digital-store.js';
import { createDriveBooks, inspectPdf } from './drive-books.js';

const words = {
  en: {
    heading: 'Digital books', note: 'Upload PDFs to Google Drive. Drafts stay private. Publish only books you are authorized to share.',
    connect: 'Connect Google Drive', connectedButton: 'Google Drive connected', disconnect: 'Disconnect Google Drive', connected: 'Drive connected for this session.', edit: 'Edit draft details', save: 'Save draft details',
    config: 'Google Drive connection is not set up for this website yet. The site owner needs to configure Google Drive access before uploads can begin.',
    title: 'Book title', author: 'Author / credit (required to publish)', language: 'Language', description: 'Description (optional)',
    file: 'PDF file (up to 25 MB)', upload: 'Upload private draft', loading: 'Loading digital books…',
    public: 'Publish reading link', disclosure: 'Publishing makes this PDF readable by anyone with its Drive link, including outside BW. Confirm you have permission to share it.',
    draft: 'Private draft', uploading: 'Upload incomplete — select the same PDF to retry', published: 'Published',
    retry: 'Retry this upload', refresh: 'Refresh digital books', read: 'Open PDF', new: 'Start another book',
    done: 'Private draft uploaded. Review the credits before publishing.', empty: 'No digital books yet.',
    publishedDone: 'Published. The reading link is available in the digital catalogue.',
    error: 'Action failed. Reconnect Drive if needed, then retry. Existing drafts are preserved.', rules: 'Digital catalogue access is not available yet. The site owner needs to update its access rules.',
    partial: 'Publication did not finish. The Drive file may already be readable by link; retry Publish to finish the catalogue entry.',
    PDF_SIZE: 'Choose a nonempty PDF no larger than 25 MB.', PDF_TYPE: 'Choose a PDF with a valid PDF header.',
    DRIVE_CONNECT: 'Connect Google Drive again, then retry.', DRIVE_PRIVATE: 'A private repository folder could not be verified.',
    DRIVE_MISMATCH: 'The selected file does not match this upload. Select the original PDF.',
    CREDITS_REQUIRED: 'Enter author / credit before uploading a book you intend to publish.',
    review: 'Open draft in Drive', progress: 'Upload progress', signedOut: 'Sign in as an approved administrator.',
    setupNote: 'Drive permission is separate from BW sign-in. Choose the Google account that will own the repository. No Drive token is saved.'
  },
  bn: {
    heading: 'ডিজিটাল বই', note: 'Google Drive-এ PDF রাখুন। খসড়া ব্যক্তিগত থাকে। শুধু অনুমতিপ্রাপ্ত বই প্রকাশ করুন।',
    connect: 'Google Drive যুক্ত করুন', connectedButton: 'Google Drive যুক্ত আছে', disconnect: 'Google Drive সংযোগ বিচ্ছিন্ন করুন', connected: 'এই সেশনে Drive যুক্ত হয়েছে।', edit: 'খসড়ার তথ্য সম্পাদনা করুন', save: 'খসড়ার তথ্য সংরক্ষণ করুন',
    config: 'এই সাইটে Google Drive সংযোগ এখনও সেটআপ করা হয়নি। আপলোডের আগে সাইটের মালিককে Drive সংযোগের ব্যবস্থা করতে হবে।',
    title: 'বইয়ের নাম', author: 'লেখক / কৃতিত্ব (প্রকাশের জন্য আবশ্যক)', language: 'ভাষা', description: 'বিবরণ (ঐচ্ছিক)',
    file: 'PDF ফাইল (সর্বোচ্চ ২৫ MB)', upload: 'ব্যক্তিগত খসড়া আপলোড করুন', loading: 'ডিজিটাল বই আসছে…',
    public: 'পড়ার লিংক প্রকাশ করুন', disclosure: 'প্রকাশ করলে Drive লিংক দিয়ে BW-এর বাইরেও সবাই PDF পড়তে পারবেন। বইটি ভাগ করার অনুমতি আছে নিশ্চিত করুন।',
    draft: 'ব্যক্তিগত খসড়া', uploading: 'আপলোড অসম্পূর্ণ — একই PDF বেছে আবার চেষ্টা করুন', published: 'প্রকাশিত',
    retry: 'এই আপলোড আবার করুন', refresh: 'ডিজিটাল বই হালনাগাদ করুন', read: 'PDF খুলুন', new: 'অন্য বই শুরু করুন',
    done: 'ব্যক্তিগত খসড়া আপলোড হয়েছে। প্রকাশের আগে কৃতিত্ব যাচাই করুন।', empty: 'এখনও ডিজিটাল বই নেই।',
    publishedDone: 'প্রকাশিত হয়েছে। ডিজিটাল তালিকায় পড়ার লিংক পাওয়া যাবে।',
    error: 'কাজটি হয়নি। প্রয়োজনে Drive আবার যুক্ত করে চেষ্টা করুন। খসড়া সংরক্ষিত আছে।', rules: 'ডিজিটাল তালিকার অনুমতি এখনও প্রস্তুত নয়। সাইটের মালিককে অনুমতির নিয়ম হালনাগাদ করতে হবে।',
    partial: 'প্রকাশ শেষ হয়নি। Drive লিংকে ফাইলটি ইতোমধ্যে পড়া যেতে পারে; তালিকায় প্রকাশ শেষ করতে আবার চেষ্টা করুন।',
    PDF_SIZE: '২৫ MB-এর মধ্যে খালি নয় এমন PDF বাছুন।', PDF_TYPE: 'সঠিক PDF ফাইল বাছুন।',
    DRIVE_CONNECT: 'Google Drive আবার যুক্ত করে চেষ্টা করুন।', DRIVE_PRIVATE: 'ব্যক্তিগত ফোল্ডার নিশ্চিত করা যায়নি।',
    DRIVE_MISMATCH: 'এই আপলোডের মূল PDF ফাইলটি বাছুন।', CREDITS_REQUIRED: 'প্রকাশের আগে লেখক / কৃতিত্ব প্রয়োজন।',
    review: 'Drive-এ খসড়া দেখুন', progress: 'আপলোডের অগ্রগতি', signedOut: 'অনুমোদিত অ্যাডমিন হিসেবে সাইন ইন করুন।',
    setupNote: 'Drive অনুমতি BW সাইন ইনের থেকে আলাদা। সংগ্রহের মালিকের Google অ্যাকাউন্ট বাছুন। Drive টোকেন সংরক্ষণ হয় না।'
  }
};
export function initDigitalAdmin({ app, auth, config }) {
  const section = document.getElementById('digital-books');
  section.innerHTML = `<h2 data-digital="heading"></h2><p data-digital="note"></p><p data-digital="setupNote"></p>
    <p id="drive-setup" role="status"></p><button type="button" class="button button-outline" id="drive-connect" data-digital="connect"></button>
    <button type="button" class="button button-outline" id="drive-disconnect" data-digital="disconnect" hidden></button>
    <form id="digital-form" class="admin-form">
    <label><span data-digital="title"></span><input name="title" required maxlength="120"></label>
    <label><span data-digital="author"></span><input name="author" maxlength="120"></label>
    <label><span data-digital="language"></span><select name="language"><option value="bn">বাংলা</option><option value="en">English</option><option value="other">Other</option></select></label>
    <label><span data-digital="description"></span><textarea name="description" maxlength="2000"></textarea></label>
    <label><span data-digital="file"></span><input name="pdf" type="file" accept="application/pdf,.pdf" required></label>
    <button type="submit" class="button button-dark" data-digital="upload"></button></form>
    <progress id="digital-progress" max="100" value="0" hidden></progress>
    <p id="digital-feedback" role="status" aria-live="polite"></p>
    <button type="button" id="digital-new" class="button button-outline" data-digital="new"></button>
    <button type="button" id="digital-refresh" class="button button-outline" data-digital="refresh"></button>
    <div id="digital-list" class="request-list"></div>`;
  const $ = id => document.getElementById(id);
  const form = $('digital-form'), store = createDigitalStore(app, auth), drive = createDriveBooks(config.driveClientId);
  let rows = [], selected = null, busy = false, permitted = false, generation = 0, message = '';
  const t = key => words[document.documentElement.lang === 'en' ? 'en' : 'bn'][key] || words.en[key] || words.en.error;
  const say = key => { message = key; $('digital-feedback').textContent = t(key); };
  const element = (tag, text) => { const item = document.createElement(tag); item.textContent = text; return item; };
  function render() {
    section.querySelectorAll('[data-digital]').forEach(el => { el.textContent = t(el.dataset.digital); });
    document.querySelector('[href="#digital-books"]').textContent = t('heading');
    $('digital-progress').setAttribute('aria-label', t('progress'));
    $('drive-setup').textContent = config.driveClientId ? '' : t('config');
    const connected = drive.isConnected();
    $('drive-connect').textContent = t(connected ? 'connectedButton' : 'connect');
    $('drive-connect').disabled = busy || !permitted || !config.driveClientId || connected;
    $('drive-disconnect').hidden = !connected;
    $('drive-disconnect').disabled = busy;
    form.querySelectorAll('input,select,textarea,button').forEach(el => { el.disabled = busy || !permitted || (selected?.status === 'uploading' && el.name !== 'pdf' && el.type !== 'submit'); });
    form.elements.pdf.disabled = busy || !permitted || selected?.status === 'draft';
    form.elements.pdf.required = selected?.status !== 'draft';
    form.querySelector('button').textContent = t(selected?.status === 'draft' ? 'save' : 'upload');
    if (!config.driveClientId) form.querySelector('button').disabled = true;
    $('digital-new').disabled = busy; $('digital-refresh').disabled = busy || !permitted;
    $('digital-feedback').textContent = message ? t(message) : '';
    const target = $('digital-list'); target.replaceChildren();
    if (!rows.length) target.append(element('p', t('empty')));
    for (const record of rows) {
      const card = element('article', ''); card.className = 'journey-card';
      card.append(element('h3', record.title), element('p', record.author), element('p', t(record.status)));
      if (record.status !== 'uploading') {
        const link = element('a', t(record.status === 'published' ? 'read' : 'review'));
        link.href = `https://drive.google.com/file/d/${encodeURIComponent(record.fileId)}/view`; link.target = '_blank'; link.rel = 'noopener noreferrer'; card.append(link);
      }
      if (record.status === 'uploading') {
        const retry = element('button', t('retry')); retry.className = 'button button-outline'; retry.disabled = busy;
        retry.onclick = () => { selected = record; for (const name of ['title','author','language','description']) form.elements[name].value = record[name]; render(); form.elements.pdf.focus(); };
        card.append(retry);
      }
      if (record.status === 'draft') {
        const edit = element('button', t('edit')); edit.className = 'button button-outline'; edit.disabled = busy;
        edit.onclick = () => { selected = record; for (const name of ['title','author','language','description']) form.elements[name].value = record[name]; render(); form.elements.title.focus(); };
        card.append(edit);
      }
      if (record.status === 'draft' && record.author.trim()) {
        const label = element('label', ''), consent = document.createElement('input'); consent.type = 'checkbox'; consent.disabled = busy;
        label.append(consent, document.createTextNode(t('disclosure'))); card.append(label);
        const publish = element('button', t('public')); publish.className = 'button button-dark'; publish.disabled = true;
        consent.onchange = () => { publish.disabled = busy || !consent.checked; };
        publish.onclick = () => run(async () => {
          await store.authorized();
          try { const url = await drive.publish(record); await store.advance(record, 'published', url); }
          catch (error) { say('partial'); throw error; }
          say('publishedDone');
        }, true);
        card.append(publish);
      }
      target.append(card);
    }
  }
  async function refresh() { rows = await store.list(true); }
  async function run(action, publication = false) {
    if (busy || !permitted) return; busy = true; const current = generation; render();
    try { await action(); if (current === generation) await refresh(); }
    catch (error) { if (current === generation && !(publication && message === 'partial')) say(words.en[error.message] ? error.message : 'error'); }
    finally { busy = false; if (current === generation) render(); }
  }
  $('drive-connect').onclick = () => run(async () => { await store.authorized(); await drive.connect(); say('connected'); });
  $('drive-disconnect').onclick = () => { drive.disconnect(); message = ''; render(); };
  const connectionTimer = setInterval(() => { if (!busy && !drive.isConnected() && $('drive-disconnect').hidden === false) { message = 'DRIVE_CONNECT'; render(); } }, 15000);
  window.addEventListener('pagehide', () => clearInterval(connectionTimer), { once: true });
  $('digital-refresh').onclick = () => run(async () => { await refresh(); });
  $('digital-new').onclick = () => { selected = null; form.reset(); render(); };
  form.onsubmit = event => {
    event.preventDefault(); run(async () => {
      await store.authorized();
      const input = Object.fromEntries(['title','author','language','description'].map(key => [key, form.elements[key].value.trim()]));
      if (selected?.status === 'draft') { await store.edit(selected, input); selected = null; form.reset(); say('done'); return; }
      const file = form.elements.pdf.files[0], info = await inspectPdf(file);
      let record = selected;
      if (record && record.sha256 !== info.sha256) throw new Error('DRIVE_MISMATCH');
      if (!record) {
        const folderId = await drive.folder(), fileId = await drive.reserveId();
        record = await store.create(crypto.randomUUID(), { ...input, ...info, folderId, fileId }); selected = record;
      }
      $('digital-progress').hidden = false; $('digital-progress').value = 0;
      await drive.upload(record, file, value => { $('digital-progress').value = value; });
      await drive.verifyPrivate(record.fileId);
      await store.advance(record, 'draft'); selected = null; form.reset(); say('done');
    });
  };
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  onAuthStateChanged(auth, async user => {
    const current = ++generation; drive.disconnect(); permitted = false; rows = []; selected = null; form.reset(); render();
    if (!user) return;
    try { await store.authorized(); if (current !== generation) return; permitted = true; await refresh(); }
    catch (error) { say(error.code === 'permission-denied' ? 'rules' : 'error'); }
    if (current === generation) render();
  });
  render();
}
