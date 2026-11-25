import { initializeApp } from 'firebase/app';
import { restoreReaderSession } from './firebase-reader-session.js';
import { getAuth, connectAuthEmulator, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, signOut, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, collection, doc, getDoc, getDocs, query, where, limit, orderBy, documentId, startAfter, runTransaction, serverTimestamp, updateDoc, onSnapshot } from 'firebase/firestore';

const emulatorConfig = { apiKey: 'demo-book-warehouse-key', authDomain: 'demo-book-warehouse.firebaseapp.com', projectId: 'demo-book-warehouse', appId: 'demo-book-warehouse-spark' };
const pendingKey = 'book-warehouse-spark-pending-v1';
const idFor = (uid, operationId) => `${uid}_${operationId}`;
const readPending = () => { try { return JSON.parse(localStorage.getItem(pendingKey) || 'null'); } catch { return null; } };
const savePending = value => { try { if (value) localStorage.setItem(pendingKey, JSON.stringify(value)); else localStorage.removeItem(pendingKey); } catch { /* Current page retains the intent. */ } };
const mapped = snapshot => Object.fromEntries(snapshot.docs.map(item => [item.id, { id: item.id, ...item.data() }]));
const outcome = (code, extra = {}) => ({ ok: code === 'requestCreated' || code === 'stageChanged', code, ...extra });

export async function createSparkStore(emulator = false) {
  let config = emulatorConfig;
  if (!emulator) {
    const response = await fetch('./spark-config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('setup');
    config = await response.json();
    if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId || config.projectId === emulatorConfig.projectId) throw new Error('setup');
  }
  const session = emulator ? null : await restoreReaderSession(config);
  const app = session ? session.app : initializeApp(config, 'spark-emulator');
  const auth = session ? session.auth : getAuth(app);
  const db = getFirestore(app);
  if (emulator) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    await setPersistence(auth, browserSessionPersistence);
  }
  await auth.authStateReady();
  const borrowingEnabled = emulator || config.sparkBorrowingEnabled === true;
  let currentPending = readPending();
  async function ensureReader() {
    const user = auth.currentUser;
    if (!user) throw new Error('signInRequired');
    const ref = doc(db, 'accounts', user.uid);
    return runTransaction(db, async tx => {
      const existing = await tx.get(ref);
      if (existing.exists()) return false;
      tx.set(ref, { displayName: (user.displayName || '').trim().slice(0, 120).trim(), status: 'active', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      return true;
    });
  }
  async function profile() {
    if (!auth.currentUser) return null;
    const snapshot = await getDoc(doc(db, 'accounts', auth.currentUser.uid));
    return snapshot.exists() ? snapshot.data() : null;
  }
  async function updateProfile(displayName) {
    const name = displayName.trim();
    if (!name || name.length > 120) throw new Error('invalidName');
    if (!auth.currentUser) throw new Error('signInRequired');
    await updateDoc(doc(db, 'accounts', auth.currentUser.uid), { displayName: name, updatedAt: serverTimestamp() });
    return profile();
  }
  async function runIntent(input) {
    const uid = auth.currentUser.uid;
    const requestId = input.kind === 'requestCopy' ? idFor(uid, input.operationId) : input.targetId;
    const requestRef = doc(db, 'sparkRequests', requestId);
    return runTransaction(db, async tx => {
      const prior = await tx.get(requestRef);
      if (input.kind === 'requestCopy' && prior.exists()) {
        const data = prior.data();
        return data.readerUid === uid && data.copyId === input.targetId ? outcome('requestCreated', { requestId }) : outcome('operationMismatch');
      }
      if (input.kind !== 'requestCopy' && !prior.exists()) return outcome('requestMissing');
      const record = prior.exists() ? prior.data() : null;
      const copyId = record ? record.copyId : input.targetId;
      const copyRef = doc(db, 'copies', copyId);
      const copySnap = await tx.get(copyRef);
      if (!copySnap.exists()) return outcome('copyUnavailable');
      const copy = copySnap.data();
      if (input.kind === 'requestCopy') {
        const account = await tx.get(doc(db, 'accounts', uid));
        const readerName = account.data()?.displayName?.trim();
        if (!readerName) return outcome('profileRequired');
        if (copy.visibility !== 'public' || copy.availability !== 'available' || copy.activeRequestId !== null) return outcome('copyUnavailable');
        const at = serverTimestamp();
        tx.set(requestRef, { readerUid: uid, readerName, copyId, libraryId: copy.libraryId, operationId: input.operationId, state: 'requested', createdAt: at, updatedAt: at,
          readyAt: null, borrowedAt: null, returnedAt: null, cancelledAt: null, version: 1 });
        tx.update(copyRef, { availability: 'held', activeRequestId: requestId, version: copy.version + 1, updatedAt: at });
        if (input.whatsapp) tx.set(doc(db, 'sparkContacts', requestId), { readerUid: uid, libraryId: copy.libraryId, whatsapp: input.whatsapp });
        return outcome('requestCreated', { requestId });
      }
      const nextState = { cancelRequest: 'cancelled', markReady: 'ready', checkOut: 'borrowed', markReturned: 'returned' }[input.kind];
      if (!nextState) return outcome('invalidInput');
      if (record.state === nextState) return outcome('stageChanged', { requestId, stage: nextState });
      const legal = nextState === 'cancelled' ? ['requested', 'ready'].includes(record.state) :
        (nextState === 'ready' && record.state === 'requested') ||
        (nextState === 'borrowed' && record.state === 'ready') ||
        (nextState === 'returned' && record.state === 'borrowed');
      if (!legal || copy.activeRequestId !== requestId || copy.libraryId !== record.libraryId) return outcome('stageInvalid');
      const at = serverTimestamp();
      const stamp = { ready: 'readyAt', borrowed: 'borrowedAt', returned: 'returnedAt', cancelled: 'cancelledAt' }[nextState];
      tx.update(requestRef, { state: nextState, [stamp]: at, updatedAt: at, version: record.version + 1 });
      tx.update(copyRef, { availability: nextState === 'ready' ? 'ready' : nextState === 'borrowed' ? 'onLoan' : 'available',
        activeRequestId: ['cancelled', 'returned'].includes(nextState) ? null : requestId,
        updatedAt: at, version: copy.version + 1 });
      return outcome('stageChanged', { requestId, stage: nextState });
    });
  }
  return {
    app, auth, config,
    staging: !emulator, spark: true, borrowingEnabled,
    onAuth: callback => onAuthStateChanged(auth, callback), user: () => auth.currentUser,
    signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
    signInGoogle: () => signInWithPopup(auth, new GoogleAuthProvider()), ensureReader, profile, updateProfile, signOut: () => signOut(auth),
    pending: () => currentPending,
    watchJourney(callback, onError) {
      if (!auth.currentUser) { callback([], {}); return () => {}; }
      let requests = [], signals = {};
      const uid = auth.currentUser.uid;
      const a = onSnapshot(query(collection(db, 'sparkRequests'), where('readerUid', '==', uid)), snapshot => {
        requests = snapshot.docs.map(d => ({ id: d.id, ...d.data() })); callback(requests, signals);
      }, onError);
      const b = onSnapshot(query(collection(db, 'borrowingSignals'), where('readerUid', '==', uid)), snapshot => {
        signals = Object.fromEntries(snapshot.docs.map(d => [d.id, d.data()])); callback(requests, signals);
      }, onError);
      return () => { a(); b(); };
    },
    async signal(kind, requestId) {
      if (!borrowingEnabled || !auth.currentUser) throw new Error('signInRequired');
      const field = { pickup: 'pickupRequestedAt', return: 'returnRequestedAt' }[kind];
      if (!field) throw new Error('invalidInput');
      const requestRef = doc(db, 'sparkRequests', requestId), signalRef = doc(db, 'borrowingSignals', requestId);
      await runTransaction(db, async tx => {
        const request = await tx.get(requestRef), prior = await tx.get(signalRef);
        if (!request.exists() || request.data().readerUid !== auth.currentUser.uid ||
            request.data().state !== (kind === 'pickup' ? 'ready' : 'borrowed')) throw new Error('stageInvalid');
        if (prior.exists() && prior.data()[field]) return;
        const at = serverTimestamp();
        if (prior.exists()) tx.update(signalRef, { [field]: at, updatedAt: at });
        else tx.set(signalRef, { readerUid: auth.currentUser.uid, libraryId: request.data().libraryId,
          pickupRequestedAt: kind === 'pickup' ? at : null, returnRequestedAt: kind === 'return' ? at : null, updatedAt: at });
      });
    },
    async catalogue() {
      async function published(name, constraints) {
        const result = {};
        let cursor;
        do {
          const page = [...constraints, orderBy(documentId()), limit(100)];
          if (cursor) page.push(startAfter(cursor));
          const snapshot = await getDocs(query(collection(db, name), ...page));
          Object.assign(result, mapped(snapshot));
          cursor = snapshot.size === 100 ? snapshot.docs.at(-1) : null;
        } while (cursor);
        return result;
      }
      const [libraries, works, editions, copies] = await Promise.all([
        published('libraries', [where('status', '==', 'active'), where('visibility', '==', 'public')]),
        published('works', [where('visibility', '==', 'public')]),
        published('editions', [where('visibility', '==', 'public')]),
        published('copies', [where('visibility', '==', 'public')])
      ]);
      return { libraries, works, editions, copies };
    },
    async myRequests() {
      if (!auth.currentUser) return [];
      const result = await getDocs(query(collection(db, 'sparkRequests'), where('readerUid', '==', auth.currentUser.uid), limit(20)));
      return result.docs.map(item => ({ id: item.id, ...item.data() }));
    },
    async operatorLibrary() {
      if (!auth.currentUser) return [];
      const result = await getDocs(query(collection(db, 'memberships'), where('uid', '==', auth.currentUser.uid), limit(20)));
      return result.docs.map(item => item.data()).filter(item => item.status === 'active' && item.role === 'operator').map(item => item.libraryId);
    },
    async libraryRequests(libraryId) {
      const result = await getDocs(query(collection(db, 'sparkRequests'), where('libraryId', '==', libraryId), limit(20)));
      return result.docs.map(item => ({ id: item.id, ...item.data() }));
    },
    async allRequests() {
      if (!auth.currentUser) return null;
      const grant = await getDoc(doc(db, 'adminGrants', auth.currentUser.uid));
      if (!grant.exists() || grant.data().status !== 'active' || grant.data().role !== 'superuser') return null;
      const result = await getDocs(query(collection(db, 'sparkRequests'), limit(20)));
      return result.docs.map(item => ({ id: item.id, ...item.data() }));
    },
    async getCopy(copyId) { const result = await getDoc(doc(db, 'copies', copyId)); return result.exists() ? { id: result.id, ...result.data() } : null; },
    async contact(requestId) { const result = await getDoc(doc(db, 'sparkContacts', requestId)); return result.exists() ? result.data().whatsapp : ''; },
    async execute(kind, targetId, retry = false, whatsapp = '') {
      if (!borrowingEnabled) return outcome('borrowingDisabled');
      if (!auth.currentUser) return outcome('signInRequired');
      if (!navigator.onLine) return outcome('offline');
      const uid = auth.currentUser.uid;
      if (currentPending && currentPending.uid !== uid) return outcome('unknownOutcome');
      if (currentPending && !retry) return outcome('unknownOutcome');
      const input = retry ? currentPending?.input : { kind, targetId, operationId: crypto.randomUUID(), ...(whatsapp ? { whatsapp } : {}) };
      if (!input || !/^[A-Za-z0-9_-]{1,128}$/.test(input.targetId || '') ||
          (input.whatsapp && !/^\+[1-9][0-9]{7,14}$/.test(input.whatsapp))) return outcome('invalidInput');
      currentPending = { uid, input }; savePending(currentPending);
      try {
        const result = await runIntent(input);
        currentPending = null; savePending(null);
        return result;
      } catch (error) {
        // A lost response keeps the same operation ID until the server state is observed.
        try {
          const id = input.kind === 'requestCopy' ? idFor(uid, input.operationId) : input.targetId;
          const snapshot = await getDoc(doc(db, 'sparkRequests', id));
          if (snapshot.exists() && (input.kind !== 'requestCopy' || (snapshot.data().readerUid === uid && snapshot.data().copyId === input.targetId))) {
            const state = snapshot.data().state;
            const expected = { requestCopy: 'requested', cancelRequest: 'cancelled', markReady: 'ready', checkOut: 'borrowed', markReturned: 'returned' }[input.kind];
            if (state === expected || (input.kind === 'requestCopy' && ['ready','borrowed','returned','cancelled'].includes(state))) {
              currentPending = null; savePending(null);
              return outcome(input.kind === 'requestCopy' ? 'requestCreated' : 'stageChanged', { requestId: id, stage: state });
            }
          }
          if (error.code === 'permission-denied' || error.code === 'failed-precondition') { currentPending = null; savePending(null); return outcome('permissionDenied'); }
        } catch { /* Keep the intent for a deliberate retry. */ }
        return outcome('unknownOutcome');
      }
    }
  };
}
