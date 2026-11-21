import { collection, doc, getDoc, getDocs, getCountFromServer, getFirestore, limit, orderBy, documentId,
  query, runTransaction, serverTimestamp, startAfter, where, onSnapshot } from 'firebase/firestore';
import { restoreReaderSession } from './firebase-reader-session.js';
import { createSparkStore } from './spark-store.js';

export async function createAdminStore(emulator = false) {
  if (emulator) return adminStore(await createSparkStore(true));
  const response = await fetch('./spark-config.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Configuration unavailable');
  const config = await response.json();
  if (config.projectId !== 'book-warehouse-staging-261115') throw new Error('Unexpected Firebase project');
  const { app, auth } = await restoreReaderSession(config);
  return adminStore({ app, auth, config });
}

function adminStore({ app, auth, config }) {
  const db = getFirestore(app);
  const records = snapshot => snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  return {
    app, config,
    auth,
    async archiveWork(workId, archived) {
      const ref = doc(db, 'works', workId);
      await runTransaction(db, async tx => {
        const work = await tx.get(ref);
        if (!work.exists()) throw new Error('Book not found');
        tx.update(ref, { archived, updatedAt: serverTimestamp() });
      });
    },
    watchAttention(callback, onError) {
      let requests = [], signals = {};
      const send = () => callback(requests.filter(r => r.state === 'requested' ||
        (r.state === 'ready' && signals[r.id]?.pickupRequestedAt) ||
        (r.state === 'borrowed' && signals[r.id]?.returnRequestedAt)), signals);
      const a = onSnapshot(query(collection(db, 'sparkRequests'), where('state', 'in', ['requested','ready','borrowed'])), snapshot => {
        requests = records(snapshot); send();
      }, onError);
      const b = onSnapshot(collection(db, 'borrowingSignals'), snapshot => {
        signals = Object.fromEntries(snapshot.docs.map(d => [d.id, d.data()])); send();
      }, onError);
      return () => { a(); b(); };
    },
    async overview() {
      const counts = await Promise.all(['requested', 'ready'].map(state =>
        getCountFromServer(query(collection(db, 'sparkRequests'), where('state', '==', state)))));
      return { pending: counts[0].data().count, ready: counts[1].data().count };
    },
    async authorized() {
      if (!auth.currentUser) return false;
      const grant = await getDoc(doc(db, 'adminGrants', auth.currentUser.uid));
      return grant.exists() && grant.data().status === 'active'
        && ['superuser', 'admin'].includes(grant.data().role || 'admin');
    },
    async requests(state, libraryId, cursor) {
      const constraints = [];
      if (state !== 'all') constraints.push(where('state', '==', state));
      if (libraryId !== 'all') constraints.push(where('libraryId', '==', libraryId));
      constraints.push(orderBy(documentId()));
      if (cursor) constraints.push(startAfter(cursor));
      constraints.push(limit(30));
      const snapshot = await getDocs(query(collection(db, 'sparkRequests'), ...constraints));
      return { records: records(snapshot), cursor: snapshot.docs.at(-1) || null, more: snapshot.size === 30 };
    },
    async catalogue() {
      const result = {};
      for (const name of ['libraries', 'works', 'editions', 'copies']) {
        result[name] = {};
        let cursor;
        do {
          const constraints = [orderBy(documentId()), limit(100)];
          if (cursor) constraints.push(startAfter(cursor));
          const snapshot = await getDocs(query(collection(db, name), ...constraints));
          for (const record of records(snapshot)) result[name][record.id] = record;
          cursor = snapshot.size === 100 ? snapshot.docs.at(-1) : null;
        } while (cursor);
      }
      return result;
    },
    async transition(requestId, state, reason = '') {
      if (!auth.currentUser) throw new Error('Sign in required');
      const ref = doc(db, 'sparkRequests', requestId);
      return runTransaction(db, async tx => {
        const request = await tx.get(ref);
        if (!request.exists()) throw new Error('Request not found');
        const old = request.data();
        if (old.state === state) return;
        const allowed = { requested: ['ready', 'cancelled'], ready: ['borrowed'], borrowed: ['returned'] };
        if (!allowed[old.state]?.includes(state)) throw new Error('The request changed. Refresh the dashboard.');
        if (state === 'cancelled' && reason.trim().length < 3) throw new Error('A rejection reason is required');
        const copyRef = doc(db, 'copies', old.copyId);
        const copy = await tx.get(copyRef);
        if (!copy.exists() || copy.data().activeRequestId !== requestId) throw new Error('Copy reservation changed');
        const at = serverTimestamp();
        const stamp = { ready: 'readyAt', cancelled: 'cancelledAt', borrowed: 'borrowedAt', returned: 'returnedAt' }[state];
        const changes = { state, [stamp]: at, updatedAt: at, version: old.version + 1 };
        if (old.state === 'requested') {
          Object.assign(changes, { reviewedBy: auth.currentUser.uid, reviewedAt: at, decisionReason: reason.trim() });
        }
        tx.update(ref, changes);
        tx.update(copyRef, {
          availability: { ready: 'ready', borrowed: 'onLoan', returned: 'available', cancelled: 'available' }[state],
          activeRequestId: ['returned', 'cancelled'].includes(state) ? null : requestId,
          updatedAt: at, version: copy.data().version + 1
        });
      });
    },
    async addLibrary(input) {
      const ref = doc(collection(db, 'libraries'));
      await runTransaction(db, async tx => {
        tx.set(ref, {
          name: { en: input.name, bn: input.nameBn || input.name },
          area: { en: input.address, bn: input.address },
          approvedPickupLocation: { en: input.address, bn: input.address },
          publicHelpContact: input.contact, status: 'active', visibility: 'public',
          createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
      });
      return ref.id;
    },
    async addBook(input, operationId) {
      const receipt = doc(db, 'inventoryOperations', operationId);
      const work = doc(db, 'works', 'work_' + operationId);
      const edition = doc(db, 'editions', 'edition_' + operationId);
      const count = Number(input.quantity);
      if (!Number.isInteger(count) || count < 1 || count > 20) throw new Error('Add 1–20 physical copies at a time');
      return runTransaction(db, async tx => {
        const prior = await tx.get(receipt);
        if (prior.exists()) return;
        const library = await tx.get(doc(db, 'libraries', input.library));
        if (!library.exists()) throw new Error('Choose an existing holding library');
        const at = serverTimestamp();
        tx.set(work, {
          title: { en: input.title, bn: input.titleBn || input.title },
          authorDisplay: { en: input.author, bn: input.authorBn || input.author },
          topics: { en: input.topics.split(',').map(s => s.trim()).filter(Boolean), bn: [] },
          visibility: 'public', createdAt: at, updatedAt: at
        });
        tx.set(edition, { workId: work.id, languageCode: input.language, format: 'print',
          isbn: input.isbn, visibility: 'public', createdAt: at, updatedAt: at });
        for (let i = 1; i <= count; i++) {
          tx.set(doc(db, 'copies', 'copy_' + operationId + '_' + i), {
            editionId: edition.id, libraryId: input.library, visibility: 'public',
            availability: 'available', activeRequestId: null, version: 0, createdAt: at, updatedAt: at
          });
        }
        tx.set(receipt, { actorUid: auth.currentUser.uid, workId: work.id, editionId: edition.id,
          libraryId: input.library, quantity: count, createdAt: at });
      });
    }
  };
}
