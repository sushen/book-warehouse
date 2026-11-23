import { catalogueCard } from "./catalogue-card.js";
import { taka, offerActions } from "./protected-offer.js";
import { FirebaseBookAccess } from "./firebase-book-access.js";
import { createDigitalStore } from './digital-store.js';
export function mountProtectedCatalogue(store) {
  const section = document.createElement("section");
  section.id = "digital-catalogue";
  section.className = "wrap";
  const heading = document.createElement("h2"),
    note = document.createElement("p"),
    account = document.createElement("p"),
    feedback = document.createElement("p"),
    list = document.createElement("div");
  list.className = "book-grid";
  feedback.setAttribute("role", "status");
  section.append(heading, note, account, feedback, list);
  const addCredits = document.createElement('a');
  addCredits.href = 'protected.html#credits'; addCredits.className = 'button button-outline';
  section.insertBefore(addCredits, list);
  const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'button button-outline';
  retry.textContent = 'Retry loading books'; retry.onclick = () => refresh().catch(() => {});
  section.insertBefore(retry, list);
  document.getElementById("catalogue").after(section);
  let books = [],
    legacyBooks = [],
    licenses = {},
    busy = false,
    generation = 0,
    message = "",
    loading = true,
    serviceUnavailable = false,
    wallet = null;
  const operations = new Map();
  const client = new FirebaseBookAccess({ store });
  const en = () => document.documentElement.lang === "en";
  const text = (english, bangla) => (en() ? english : bangla);
  const element = (tag, value, className = "") => {
    const node = document.createElement(tag);
    node.textContent = value;
    node.className = className;
    return node;
  };
  async function api(route, body) {
    return client.request(route, { body, method: body ? "POST" : "GET" });
  }
  async function refresh() {
    const current = ++generation,
      uid = store.user()?.uid;
    const records = await api('/books');
    if (current !== generation || store.user()?.uid !== uid) return;
    loading = false; serviceUnavailable = false; books = records; legacyBooks = [];
    const next = {}; message = ''; render();
    let nextWallet = null;
    if (uid) {
      try { nextWallet = await api("/me"); }
      catch {
        if (current !== generation || store.user()?.uid !== uid) return;
        message = text('Books are available, but your local balance could not be checked. Refresh or sign in again.', 'বই পাওয়া যাচ্ছে, তবে স্থানীয় ব্যালেন্স দেখা যায়নি। হালনাগাদ করুন বা আবার সাইন ইন করুন।');
      }
    }
    if (uid)
      await Promise.all(
        records.map(async (book) => {
          try {
            next[book.id] =
              (await api("/books/" + book.id + "/license")).licensed === true;
          } catch {
            next[book.id] = false;
          }
        }),
      );
    if (current !== generation || store.user()?.uid !== uid) return;
    books = records;
    licenses = next;
    wallet = nextWallet;
    render();
  }
  async function buy(book) {
    if (busy) return;
    busy = true;
    message = text("Preparing purchase…", "ক্রয়ের প্রস্তুতি হচ্ছে…");
    render();
    try {
      if (!store.user()) await store.signInGoogle();
      const uid = store.user()?.uid;
      if (!uid) throw new Error("sign-in-required");
      const key = JSON.stringify([uid, book.id, book.version]);
      if (!operations.has(key)) operations.set(key, crypto.randomUUID());
      await api("/books/" + book.id + "/purchase", {
        operationId: operations.get(key),
        version: book.version,
        priceCredits: book.priceCredits,
      });
      message = text(
        "Purchased. You can now read the full book.",
        "কেনা হয়েছে। এখন পুরো বই পড়তে পারবেন।",
      );
      await refresh();
    } catch (error) {
      message =
        error.message === "insufficient-credits"
          ? text(
            "Not enough local test credits. Open Protected books to see your Google user ID and balance; Super Admin can grant test credits to that ID.",
            "স্থানীয় পরীক্ষার ক্রেডিট যথেষ্ট নয়। সুরক্ষিত বইয়ের পাতায় আপনার Google ব্যবহারকারী আইডি ও ব্যালেন্স দেখুন; সুপার অ্যাডমিন সেই আইডিতে পরীক্ষার ক্রেডিট দিতে পারবেন।",
            )
          : error.code === "auth/popup-blocked"
            ? text("Allow the Google sign-in popup, then try Buy again. No credits were spent.", "Google সাইন-ইন পপআপের অনুমতি দিয়ে আবার কিনুন চাপুন। কোনো ক্রেডিট খরচ হয়নি।")
          : text(
              "Purchase not completed. Refresh and retry; a license is required for full reading.",
              "ক্রয় সম্পন্ন হয়নি। হালনাগাদ করে আবার চেষ্টা করুন; পুরো বই পড়তে লাইসেন্স প্রয়োজন।",
            );
    } finally {
      busy = false;
      render();
    }
  }
  function render() {
    heading.textContent = text("Digital books", "ডিজিটাল বই");
    note.textContent = text(
      "First 10% free. Buy with BW Credits to unlock the full book. Local test: 1 credit = ৳1.",
      "প্রথম ১০% বিনামূল্যে। BW ক্রেডিটে কিনে পুরো বই পড়ুন। স্থানীয় পরীক্ষা: ১ ক্রেডিট = ৳১।",
    );
    feedback.textContent = message;
    addCredits.textContent = text('Buy / add BW Credits', 'BW ক্রেডিট কিনুন / যোগ করুন');
    account.textContent = store.user()
      ? `${store.user().displayName || store.user().email || text("Reader", "পাঠক")} · ${wallet ? `${wallet.balance} BW Credits (${taka(wallet.balance)})` : text(serviceUnavailable ? "Balance unavailable" : "Checking local balance…", serviceUnavailable ? "ব্যালেন্স দেখা যাচ্ছে না" : "স্থানীয় ব্যালেন্স দেখা হচ্ছে…")}`
      : text("Sign in with Google to use your local credit balance.", "স্থানীয় ক্রেডিট ব্যালেন্স ব্যবহার করতে Google দিয়ে সাইন ইন করুন।");
    list.replaceChildren();
    if (!books.length && !legacyBooks.length)
      list.append(
        element(
          "p",
          text(
            loading ? "Loading protected books…" : serviceUnavailable ? "The book catalogue could not be loaded. Please retry." : "No protected books published in the local test yet.",
            loading ? "সুরক্ষিত বইয়ের তালিকা আসছে…" : serviceUnavailable ? "বইয়ের তালিকা আনা যায়নি। আবার চেষ্টা করুন।" : "স্থানীয় পরীক্ষায় এখনও সুরক্ষিত বই প্রকাশ করা হয়নি।",
          ),
        ),
      );
    for (const book of books) {
      const licensed = licenses[book.id] === true;
      const { card, foot } = catalogueCard({
        id: book.id,
        title: book.title,
        author: book.author,
        format: text("Digital book", "ডিজিটাল বই"),
        language: "",
        status: licensed
          ? text(
              "Purchased · Full book unlocked",
              "কেনা হয়েছে · পুরো বই উন্মুক্ত",
            )
          : text("Purchase to unlock", "কিনে পুরো বই পড়ুন"),
      });
      foot.append(
        element("p", book.protectedReady ? `${taka(book.priceCredits)} · ${book.priceCredits} BW Credits` : text("Access setup required", "প্রবেশাধিকার প্রস্তুত করা প্রয়োজন"), "book-location"),
      );
      if (book.priceReference)
        foot.append(
          element(
            "p",
            text(
              `${book.priceReference.fixedByFounder ? 'Fixed price' : 'Local estimate'} · ${book.priceReference.amountMicros / 1_000_000} ${book.priceReference.asset} reference`,
              `${book.priceReference.fixedByFounder ? 'নির্ধারিত মূল্য' : 'স্থানীয় আনুমানিক মূল্য'} · ${book.priceReference.amountMicros / 1_000_000} ${book.priceReference.asset} রেফারেন্স`,
            ),
            "book-location",
          ),
        );
      if (!book.protectedReady) {
        foot.append(element('p', text('This book is in Firebase. Its protected preview, price and licensed delivery need configuration.', 'বইটি Firebase-এ আছে। সুরক্ষিত প্রিভিউ, মূল্য ও লাইসেন্সভিত্তিক পড়া প্রস্তুত করা প্রয়োজন।'), 'book-location'));
        list.append(card); continue;
      }
      for (const action of offerActions(
        licensed,
        book.previewPages,
        book.downloadAllowed,
      )) {
        if (action === "buy") {
          const button = element(
            "button",
            text("Buy full book · ", "পুরো বই কিনুন · ") +
              taka(book.priceCredits),
            "request-button",
          );
          button.type = "button";
          button.disabled = busy;
          button.onclick = () => buy(book);
          foot.append(button);
        } else {
          const label =
            action === "preview"
              ? text("Read free 10% preview", "বিনামূল্যে ১০% পড়ুন")
              : action === "read"
                ? text("Read full book", "পুরো বই পড়ুন")
                : text("Download purchased PDF", "কেনা PDF ডাউনলোড");
          const link = element("a", label, "request-button");
          link.href =
            "protected.html?book=" +
            encodeURIComponent(book.id) +
            "&mode=" +
            action;
          foot.append(link);
        }
      }
      list.append(card);
    }
    for (const book of legacyBooks) {
      const { card, foot } = catalogueCard({ id:book.id, title:book.title, author:book.author,
        format:text('Digital book','ডিজিটাল বই'), status:serviceUnavailable ? text('Reading temporarily unavailable','পড়া সাময়িকভাবে বন্ধ') : text('Protected access not ready','সুরক্ষিত প্রবেশাধিকার প্রস্তুত নয়'), available:false,
        description:serviceUnavailable ? text('Your book remains in the catalogue. Secure access will be checked when the reading service returns.', 'বইটি তালিকায় আছে। পড়ার পরিষেবা চালু হলে সুরক্ষিত প্রবেশাধিকার যাচাই হবে।') : text('This edition needs protected publishing and a price before preview or purchase can open.', 'এই সংস্করণের প্রিভিউ বা ক্রয় চালু করতে সুরক্ষিত প্রকাশনা ও মূল্য নির্ধারণ প্রয়োজন।') });
      const locked = element('button', serviceUnavailable ? text('Reading unavailable','পড়া যাচ্ছে না') : text('Not available yet','এখনও প্রস্তুত নয়'), 'request-button'); locked.disabled = true;
      foot.append(locked); list.append(card);
    }
  }
  const observer = new MutationObserver(render);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"],
  });
  const unsubscribe = store.onAuth(() => {
    licenses = {};
    wallet = null;
    render();
    refresh().catch(() => {
      message = text(
        "Protected library unavailable.",
        "সুরক্ষিত বইয়ের তালিকা আসছে না।",
      );
      render();
    });
  });
  window.addEventListener("pageshow", () => refresh().catch(() => {}));
  window.addEventListener(
    "pagehide",
    () => {
      generation++;
      unsubscribe();
      observer.disconnect();
    },
    { once: true },
  );
  render();
  refresh().catch(() => {
    message = text(
      "Start the local protected service to load these books.",
      "বই দেখতে স্থানীয় সুরক্ষিত পরিষেবা চালু করুন।",
    );
    render();
  });
}
