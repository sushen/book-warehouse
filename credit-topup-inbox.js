import { FirebaseBookAccess } from './firebase-book-access.js';
import { isLocalRuntime } from './local-runtime.js';
export function mountCreditTopupInbox(store) {
  const box = document.createElement('p'), link = document.createElement('a');
  link.href = 'protected.html#protected-topup-review'; link.className = 'button button-outline'; box.append(link);
  document.getElementById('admin-content').prepend(box);
  const client = new FirebaseBookAccess({store:{...store,user:()=>store.auth.currentUser}});
  let active = true;
  async function refresh() {
    try {
      const requests = await client.request('/admin/topups');
      if (!active) return;
      const ready = requests.filter(r => r.status === 'pending-review').length, waiting = requests.filter(r => r.status === 'awaiting-payment').length;
      link.textContent = document.documentElement.lang === 'bn' ? `ক্রেডিট কেনার অনুরোধ: ${ready}টি যাচাই বাকি · ${waiting}টি রেফারেন্সের অপেক্ষায়` : `Credit requests: ${ready} ready for review · ${waiting} awaiting reference`;
    } catch { if (active) link.textContent = 'Open credit purchase review'; }
  }
  refresh(); const timer = setInterval(refresh, 30000);
  const stop = () => { active = false; clearInterval(timer); box.remove(); };
  window.addEventListener('pagehide', stop, { once: true });
  return stop;
}
