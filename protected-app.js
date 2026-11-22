import { createSparkStore } from "./spark-store.js";
import { emulatorLogin } from "./emulator-login.js";
import { ProtectedBooksClient } from "./protected-client.js";
import { taka, offerActions } from "./protected-offer.js";
import { CreditTopupView } from "./credit-topup-ui.js";
import { catalogueCard } from "./catalogue-card.js";
import { FocusedBookReader } from "./focused-book-reader.js";
const $ = (id) => document.getElementById(id),
  origin = "http://127.0.0.1:8787";
const node = (tag, text = "", className = "") => {
  const e = document.createElement(tag);
  e.textContent = text;
  e.className = className;
  return e;
};
let store,
  admin = false,
  busy = false,
  books = [],
  booksLoaded = false,
  licenses = {},
  epoch = 0,
  routeOpened = false;
const client = new ProtectedBooksClient({
  origin,
  getUser: () => store?.user(),
});
const requestedBook = new URLSearchParams(location.search).get("book"),
  requestedMode = new URLSearchParams(location.search).get("mode");
const operations = new Map();
const topupView = new CreditTopupView({ root: $('credits'), adminRoot: $('protected-topup-review'), api, action, getUser: () => store?.user(), onShowRequests: () => navigateView('requests') });
const reader = new FocusedBookReader({ root: $('protected-reader'), app: $('reading-app'), api, getUser: () => store?.user(),
  onClose: () => navigateView('books'), onUnlock: async book => {
    const licensed = store.user() && (await api('/books/' + book.id + '/license')).licensed;
    if (licensed) return showPdf(book, 'read');
    return buy(book);
  } });
const viewHashes = { books:'#reading-shelf', credits:'#credits', requests:'#credit-requests', manage:'#protected-topup-review' };
function applyAppView() {
  let view = Object.keys(viewHashes).find(key => viewHashes[key] === location.hash) || 'books';
  if (location.hash === '#publishing-tools') view = 'manage';
  if (view === 'manage' && !admin) view = 'books';
  document.body.dataset.view = view;
  $('reading-shelf').hidden = view !== 'books';
  $('credits').hidden = !['credits','requests'].includes(view);
  $('protected-admin').hidden = view !== 'manage' || !admin;
  document.querySelectorAll('[data-view-link]').forEach(link => { if (link.dataset.viewLink === view) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current'); });
  const heading = $('credits').querySelector('h2');
  if (heading) heading.textContent = view === 'requests' ? 'Your credit requests' : 'Buy BW Credits';
  if (view === 'manage' && location.hash === '#publishing-tools') { $('publishing-tools').open = true; $('publishing-tools').scrollIntoView({ block:'start' }); }
}
function navigateView(view) { reader.close(false); history.replaceState(null,'',viewHashes[view] || viewHashes.books); $('account-menu').open = false; applyAppView(); }
document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', event => {
  const view = Object.keys(viewHashes).find(key => viewHashes[key] === link.getAttribute('href'));
  if (view) { event.preventDefault(); navigateView(view); }
}));
window.addEventListener('hashchange', applyAppView);
document.addEventListener('click', event => { if (!$('account-menu').contains(event.target)) $('account-menu').open = false; });
applyAppView();
const operation = (kind, payload) => {
  const key = kind + JSON.stringify(payload);
  if (!operations.has(key)) operations.set(key, crypto.randomUUID());
  return operations.get(key);
};
const messages = {
  'payment-reference-required': 'Enter the payment transaction ID before submitting.',
  'invalid-payment-reference': 'Enter a valid transaction ID. USDT requires the complete 0x transaction hash.',
  'sender-account-required': 'Enter the bank account number from which the transfer was sent.',
  'payment-verification-required': 'Confirm receipt independently, then enter the exact transaction reference and amount.',
  'payment-reference-already-used': 'This payment reference has already funded a credit purchase. It cannot be credited again.',
  'payment-method-minimum': 'This amount is below the selected payment method’s minimum. USDT requires at least 2 credits.',
  'operation-mismatch': 'This saved request differs from the form. Check My credit purchase requests before submitting again.',
  "sign-in-required": "Sign in to purchase or read protected books.",
  "insufficient-credits":
    "You do not have enough test credits. Real-money top-ups are not connected yet.",
  "offer-changed":
    "The price or edition changed. Refresh the offer before buying.",
  "license-required": "Purchase access before reading this book.",
  "license-revoked": "This reading license has been revoked.",
  "admin-required": "This account is not an approved administrator.",
  "book-unavailable": "This book is not available.",
  "preview-unavailable": "This short book has no free preview pages.",
  "invalid-pdf": "Choose a valid PDF.",
  "body-too-large": "This PDF exceeds the 25 MB limit.",
};
async function api(
  route,
  { body, method = "GET", raw = false, binary = false } = {},
) {
  try {
    return await client.request(route, { body, method, raw, binary });
  } catch (error) {
    throw new Error(messages[error.message] || error.message);
  }
}
async function action(fn) {
  if (busy) return;
  busy = true;
  document.querySelector('main').setAttribute('aria-busy','true');
  try {
    $("protected-feedback").textContent = "Working…";
    await fn();
    await refresh();
    if ($("protected-feedback").textContent === "Working…")
      $("protected-feedback").textContent = "Ready.";
  } catch (error) {
    $("protected-feedback").textContent = error.message;
  } finally {
    busy = false;
    document.querySelector('main').setAttribute('aria-busy','false');
  }
}
function button(text, fn) {
  const b = node("button", text, "button button-outline");
  b.type = "button";
  b.onclick = () => action(fn);
  return b;
}
function readingButton(text, book, mode) {
  const control = node('button', text, 'button button-outline'); control.type = 'button';
  control.onclick = async () => {
    control.disabled = true;
    try { await showPdf(book, mode); }
    catch (error) { $('protected-feedback').textContent = error.message; }
    finally { control.disabled = false; }
  };
  return control;
}
function renderAccountControls() {
  const user = store.user(), controls = $("protected-auth-controls");
  controls.replaceChildren(user
    ? button("Sign out", () => store.signOut())
    : button("Sign in with Google", () => store.signInGoogle()));
  renderAccount(user);
}
function renderAccount(user, balance) {
  $('protected-account-label').textContent = user ? (user.displayName || user.email || 'Account').split(' ')[0] : 'Sign in';
  $('protected-balance-short').textContent = user && balance !== undefined ? `${new Intl.NumberFormat('en-BD').format(balance)} credits` : 'BW Credits';
  const box = $("protected-account"); box.replaceChildren();
  const avatar = node('span', user ? (user.displayName || user.email || 'Reader').slice(0,1).toUpperCase() : 'BW', 'reader-avatar');
  box.append(avatar, node('h2', user ? user.displayName || 'Welcome, reader' : 'A little space for you'), node('p', user ? user.email || '' : 'Sign in to keep your books and credits together.', 'reader-email'));
  if (user) {
    const wallet = node('div', '', 'reader-wallet');
    wallet.append(node('span', 'Your BW Credits'), node('strong', balance === undefined ? 'Checking…' : new Intl.NumberFormat('en-BD').format(balance)), node('small', balance === undefined ? 'Getting your reading balance' : `${taka(balance)} for your next read`)); box.append(wallet);
    const details = node('details', '', 'reader-account-details'); details.append(node('summary', 'Account details'), node('p', `User ID: ${user.uid}`)); box.append(details);
  }
}
async function showPdf(book, mode) { return reader.open(book, mode); }
async function buy(book) {
  if (!store.user()) await store.signInGoogle();
  await api("/books/" + book.id + "/purchase", {
    method: "POST",
    body: {
      operationId: operation("buy", { id: book.id, version: book.version }),
      version: book.version,
      priceCredits: book.priceCredits,
    },
  });
  $("protected-feedback").textContent =
    "License active. The full book is unlocked.";
  await showPdf(book, "read");
}
function render() {
  $("protected-books").replaceChildren();
  if (!books.length)
    $("protected-books").append(
      node(
        "p",
        booksLoaded ? "Your shelf is waiting for its first book." : "Finding your books…",
      ),
    );
  for (const book of books.filter(
    (b) => !requestedBook || b.id === requestedBook,
  )) {
    const { card, foot } = catalogueCard({ id:book.id, title:book.title, author:book.author,
      format:'Digital edition', location:`${book.previewPages} preview pages · ${book.pageCount} pages in all`,
      status:licenses[book.id] ? 'In your library' : `${taka(book.priceCredits)} · ${book.priceCredits} credits`, available:true });
    for (const access of offerActions(
      licenses[book.id] === true,
      book.previewPages,
      book.downloadAllowed,
    )) {
      if (access === "preview")
        foot.append(
          readingButton("Read free 10% preview", book, "preview"),
        );
      if (access === "buy")
        foot.append(
          button("Buy full book · " + taka(book.priceCredits), () => buy(book)),
        );
      if (access === "read")
        foot.append(readingButton("Read full book", book, "read"));
      if (access === "download")
        foot.append(
          button("Download purchased PDF", async () => {
            const blob = await api("/books/" + book.id + "/download", {
                binary: true,
              }),
              url = URL.createObjectURL(blob),
              link = node("a");
            link.href = url;
            link.download = "licensed-book.pdf";
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 30000);
          }),
        );
    }
    $("protected-books").append(card);
  }
}
async function refresh() {
  const current = ++epoch,
    uid = store.user()?.uid,
    records = await api("/books"),
    next = {};
  if (uid)
    await Promise.all(
      records.map(async (b) => {
        try {
          next[b.id] =
            (await api("/books/" + b.id + "/license")).licensed === true;
        } catch {
          next[b.id] = false;
        }
      }),
    );
  if (current !== epoch || uid !== store.user()?.uid) return;
  books = records;
  booksLoaded = true;
  licenses = next;
  render();
  if (!routeOpened && requestedBook) {
    const selected = books.find(b => b.id === requestedBook);
    if (selected && (requestedMode === 'preview' || requestedMode === 'read' && licenses[selected.id])) {
      routeOpened = true; await showPdf(selected, requestedMode);
    }
  }
  if (!store.user()) {
    renderAccount(null);
    admin = false;
    await topupView.refresh(false, false);
    applyAppView();
    return;
  }
  const me = await api("/me");
  if (current !== epoch || uid !== store.user()?.uid) return;
  renderAccount(store.user(), me.balance);
  try {
    const records = await api("/admin/books");
    admin = true;
    $("protected-manage-link").hidden = false;
    renderAdmin(records);
    await report();
  } catch (error) {
    admin = false;
    $("protected-manage-link").hidden = true;
  }
  await topupView.refresh(true, admin);
  applyAppView();
}
function renderAdmin(records) {
  $("protected-drafts").replaceChildren();
  for (const book of records) {
    const form = node("form", "", "protected-policy");
    form.append(
      node("strong", book.title),
      node(
        "p",
        `${book.status} · ${book.pageCount || 0} pages · ${book.previewPages || 0} preview pages`,
      ),
      node("p", `Book ID: ${book.id}`),
    );
    if (book.version)
      form.append(node("p", "Version fingerprint: " + book.version));
    const label = node("label", "Price in test credits"),
      price = node("input");
    price.type = "number";
    price.min = "1";
    price.max = "1000000";
    price.value = book.priceCredits;
    label.append(price);
    form.append(label);
    const down = node("label", "Allow licensed download "),
      check = node("input");
    check.type = "checkbox";
    check.checked = book.downloadAllowed;
    down.append(check);
    form.append(down);
    if (book.version) {
      for (const [text, status] of [
        ["Publish / save policy", "published"],
        ["Withdraw from catalogue", "withdrawn"],
      ])
        form.append(
          button(text, async () => {
            await api("/admin/books/" + book.id + "/policy", {
              method: "POST",
              body: {
                priceCredits: Number(price.value),
                downloadAllowed: check.checked,
                status,
              },
            });
            $("protected-feedback").textContent = "Policy saved.";
          }),
        );
    }
    form.onsubmit = (e) => e.preventDefault();
    $("protected-drafts").append(form);
  }
}
async function report() {
  const data = await api("/admin/report"),
    box = $("protected-report");
  const metrics = node('div', '', 'sales-metrics');
  for (const [value, label] of [[data.totals.purchases, 'Book purchases'],[data.totals.creditsSold || 0, 'Credits sold'],[data.totals.creditsSpent, 'Credits spent on books'],[data.totals.testCreditsGranted, 'Credits granted by admin']]) {
    const metric = node('article'); metric.append(node('strong', new Intl.NumberFormat('en-BD').format(value)), node('span', label)); metrics.append(metric);
  }
  box.replaceChildren(metrics,
    node(
      "p",
      "Payments and reading activity, kept distinct. These figures reflect this local preview; payments are reviewed manually.", 'sales-note',
    ),
  );
  box.append(node('p', `${data.totals.manuallyVerifiedTopups || 0} manually reviewed top-ups · ${taka((data.totals.manuallyVerifiedMoneyByCurrency?.BDT || 0) / 100)} confirmed in the local review ledger. These are separate from automatic provider verification and discretionary grants.`));
  box.append(node('p', `${((data.totals.manuallyVerifiedMoneyByCurrency?.USDT || 0) / 1000000).toFixed(6)} USDT manually confirmed in the local review ledger.`));
  const table = node("table", "", "protected-report-table");
  const head = node("tr");
  for (const text of ["Type", "Reader", "Credits", "Money"])
    head.append(node("th", text));
  table.append(head);
  for (const entry of data.entries) {
    const names = { 'test-credit-grant':'Admin credit grant', 'book-access':'Book purchase', 'manually-verified-credit-topup':'Credit sale — manually confirmed', 'verified-credit-topup':'Credit sale — provider verified' };
    const row = node("tr");
    for (const value of [
      names[entry.kind] || entry.kind,
      entry.uid,
      String(entry.amount),
      entry.currency
        ? entry.currency === 'BDT' ? taka(entry.amountMinor / 100) : `${(entry.amountMinor / (entry.minorUnitsPerUnit || 1000000)).toFixed(6)} ${entry.currency}`
        : "—",
    ])
      row.append(node("td", value));
    table.append(row);
  }
  const history = node('details', '', 'transaction-history'), tableWrap = node('div', '', 'transaction-table-wrap');
  history.append(node('summary', `View transaction history · ${data.entries.length} entries`)); tableWrap.append(table); history.append(tableWrap); box.append(history);
}
$("protected-upload").onsubmit = (e) => {
  e.preventDefault();
  action(async () => {
    const form = e.target,
      file = form.elements.pdf.files[0];
    if (!file || file.size > 25 * 1024 * 1024)
      throw new Error("Choose a PDF no larger than 25 MB.");
    const input = {
      title: form.elements.title.value,
      author: form.elements.author.value,
      ownershipClaim: form.elements.ownershipClaim.value,
      priceCredits: Number(form.elements.priceCredits.value),
    };
    if (
      form.elements.referenceAmount.value ||
      form.elements.referenceRate.value
    )
      input.priceReference = {
        asset: "USDT",
        amountMicros: Math.round(
          Number(form.elements.referenceAmount.value) * 1_000_000,
        ),
        bdtPerUnitMinor: Math.round(
          Number(form.elements.referenceRate.value) * 100,
        ),
      };
    if (!form.dataset.bookId) {
      const result = await api("/admin/books", {
        method: "POST",
        body: {
          ...input,
          operationId: operation("draft", {
            ...input,
            file: file.name,
            size: file.size,
            lastModified: file.lastModified,
          }),
        },
      });
      form.dataset.bookId = result.id;
    }
    await api("/admin/books/" + form.dataset.bookId + "/file", {
      method: "PUT",
      raw: true,
      body: file,
    });
    delete form.dataset.bookId;
    form.reset();
    $("protected-feedback").textContent =
      "Encrypted draft and separate preview generated. Review before publishing.";
  });
};
$("protected-grant").onsubmit = (e) => {
  e.preventDefault();
  action(async () => {
    const input = {
      uid: e.target.elements.uid.value,
      amount: Number(e.target.elements.amount.value),
    };
    await api("/admin/grant", {
      method: "POST",
      body: { ...input, operationId: operation("grant", input) },
    });
    operations.delete("grant" + JSON.stringify(input));
    e.target.reset();
    $("protected-feedback").textContent =
      "Test-credit grant saved. This is not a payment.";
  });
};
$("protected-revoke").onsubmit = (e) => {
  e.preventDefault();
  action(async () => {
    await api("/admin/revoke", {
      method: "POST",
      body: Object.fromEntries(new FormData(e.target)),
    });
    $("protected-feedback").textContent =
      "Future access requests for that license are revoked.";
  });
};
$("protected-refresh").onclick = () => action(refresh);
for (const name of ["referenceAmount", "referenceRate"])
  $("protected-upload").elements[name].addEventListener("input", () => {
    const form = $("protected-upload"),
      amount = Math.round(
        Number(form.elements.referenceAmount.value) * 1_000_000,
      ),
      rate = Math.round(Number(form.elements.referenceRate.value) * 100);
    if (
      Number.isSafeInteger(amount) &&
      Number.isSafeInteger(rate) &&
      amount > 0 &&
      rate > 0 &&
      Number.isSafeInteger(amount * rate)
    )
      form.elements.priceCredits.value = Math.ceil(
        (amount * rate) / 100_000_000,
      );
  });
if (!["127.0.0.1", "localhost"].includes(location.hostname)) {
  $("protected-feedback").textContent =
    "The protected-books prototype is local only. No payment or protected-content service is deployed.";
} else
  try {
    const emulator = new URLSearchParams(location.search).get("emulator") === "1";
    store = await createSparkStore(emulator);
    if (emulator) emulatorLogin(store.auth);
    store.onAuth(() => {
      epoch++;
      $("protected-admin").hidden = true;
      $("protected-manage-link").hidden = true;
      renderAccountControls();
      topupView.reset();
      licenses = {};
      reader.close(false);
      admin = false;
      applyAppView();
      render();
      refresh().catch((error) => {
        $("protected-feedback").textContent = error.message;
      });
    });
    await refresh();
  } catch (error) {
    $("protected-feedback").textContent =
      "Local protected service unavailable. " + error.message;
  }
