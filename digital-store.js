import { collection, doc, getDoc, getDocs, getFirestore, limit, orderBy, query, runTransaction, serverTimestamp, startAfter, where } from 'firebase/firestore';
import { driveLink } from './drive-books.js';

export function createDigitalStore(app, auth) {
  const db = getFirestore(app);
  async function authorized() {
    if (!auth.currentUser) throw new Error('ADMIN_REQUIRED');
    const grant = await getDoc(doc(db, 'adminGrants', auth.currentUser.uid));
    if (!grant.exists() || grant.data().status !== 'active' || !['admin', 'superuser'].includes(grant.data().role || 'admin')) throw new Error('ADMIN_REQUIRED');
  }
  return {
    authorized,
    async list(admin = false) {
      const result = []; let cursor;
      do {
        const terms = admin ? [] : [where('status', '==', 'published')];
        terms.push(orderBy('__name__'), limit(100)); if (cursor) terms.push(startAfter(cursor));
        const page = await getDocs(query(collection(db, 'digitalBooks'), ...terms));
        result.push(...page.docs.map(d => ({ id: d.id, ...d.data() })));
        cursor = page.size === 100 ? page.docs.at(-1) : null;
      } while (cursor);
      return result;
    },
    async create(id, input) {
      await authorized();
      const ref = doc(db, 'digitalBooks', id);
      return runTransaction(db, async tx => {
        const old = await tx.get(ref);
        if (old.exists()) {
          if (old.data().sha256 !== input.sha256) throw new Error('DRIVE_MISMATCH');
          return { id, ...old.data() };
        }
        const data = { ...input, ownerUid: auth.currentUser.uid, status: 'uploading', readerUrl: '',
          createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
        tx.set(ref, data); return { id, ...data };
      });
    },
    async advance(record, status, readerUrl = '') {
      await authorized(); const ref = doc(db, 'digitalBooks', record.id);
      await runTransaction(db, async tx => {
        const snapshot = await tx.get(ref); if (!snapshot.exists()) throw new Error('DRAFT_MISSING');
        const old = snapshot.data();
        if (old.status === status) return;
        if (!(old.status === 'uploading' && status === 'draft') && !(old.status === 'draft' && status === 'published')) throw new Error('DRAFT_STATE');
        if (status === 'published' && (!old.author.trim() || readerUrl !== driveLink(old.fileId))) throw new Error('CREDITS_REQUIRED');
        tx.update(ref, { status, readerUrl, updatedAt: serverTimestamp() });
      });
    },
    async edit(record, input) {
      await authorized(); const ref = doc(db, 'digitalBooks', record.id);
      await runTransaction(db, async tx => {
        const old = await tx.get(ref);
        if (!old.exists() || old.data().status !== 'draft') throw new Error('DRAFT_STATE');
        tx.update(ref, { ...input, updatedAt: serverTimestamp() });
      });
    }
  };
}
