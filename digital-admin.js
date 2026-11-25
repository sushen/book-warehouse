/** Public Drive-link publication was retired when paid access became required. */
export function initDigitalAdmin() {
  const section = document.getElementById('digital-books');
  const render = () => {
    const bn = document.documentElement.lang === 'bn', local = /^https?:$/.test(location.protocol);
    section.replaceChildren();
    const heading = document.createElement('h2'), note = document.createElement('p'), warning = document.createElement('p');
    heading.textContent = bn ? 'সুরক্ষিত ডিজিটাল প্রকাশনা' : 'Protected digital publishing';
    note.textContent = bn ? 'বইয়ের আলাদা বিনামূল্যের প্রিভিউ তৈরি করুন এবং পুরো PDF ব্যক্তিগত রেখে ক্রয় ও লাইসেন্সের মাধ্যমে পড়ার সুযোগ দিন।' : 'Prepare a separate free preview and keep the full PDF private, with purchases and reading licenses managed by BW.';
    section.append(heading, note);
    if (local) {
      const link = document.createElement('a'); link.href = 'protected.html#publishing-tools'; link.className = 'button button-dark';
      link.textContent = bn ? 'সুরক্ষিত বই প্রকাশ করুন' : 'Open protected publishing'; section.append(link);
    } else {
      const unavailable = document.createElement('p');
      unavailable.textContent = bn ? 'সুরক্ষিত প্রকাশনার সেবা এই ওয়েবসাইটে এখনও যুক্ত হয়নি।' : 'Protected publishing is not connected on this website yet.'; section.append(unavailable);
    }
    warning.textContent = bn ? 'পুরো PDF-এর উন্মুক্ত Drive লিংক প্রকাশ বন্ধ আছে। আগের উন্মুক্ত ফাইলগুলোর sharing আলাদাভাবে ব্যক্তিগত করতে হবে।' : 'Public full-PDF Drive publication is disabled. Previously public Drive files still need their sharing restricted separately.';
    section.append(warning);
  };
  render(); new MutationObserver(render).observe(document.documentElement, { attributes:true, attributeFilter:['lang'] });
}
