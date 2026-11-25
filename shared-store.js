import { initializeApp } from 'firebase/app';
import { restoreReaderSession } from './firebase-reader-session.js';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, collection, doc, getDoc, getDocs, query, where, limit } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

const emulatorConfig = { apiKey: 'demo-book-warehouse-key', authDomain: 'demo-book-warehouse.firebaseapp.com', projectId: 'demo-book-warehouse', appId: 'demo-book-warehouse-app' };

const receiptId = (uid, operationId) => `${uid.length}_${uid}_${operationId}`;
const pendingKey = 'book-warehouse-shared-pending-v1';
function pending() {
  try { return JSON.parse(localStorage.getItem(pendingKey) || 'null'); } catch { return null; }
}
function savePending(value) {
  try {
    if (value) localStorage.setItem(pendingKey, JSON.stringify(value));
    else localStorage.removeItem(pendingKey);
  } catch { /* The current-page retry remains available. */ }
}

export async function createSharedStore(staging = false) {
  let config = emulatorConfig;
  if (staging) {
    const response = await fetch('./staging-config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('setup');
    config = await response.json();
    if (config.projectId !== 'book-warehouse-staging-261115' || config.appId !== '1:222757402819:web:f15b1082c1efc6e4e48a76') throw new Error('setup');
  }
  const session = staging ? await restoreReaderSession(config) : null;
  const app = session ? session.app : initializeApp(config);
  const auth = session ? session.auth : getAuth(app);
  const db = getFirestore(app);
  const functions = getFunctions(app);
  if (!staging) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  }
  const command = httpsCallable(functions, 'circulation');
  const ensureReader = httpsCallable(functions, 'ensureReader');
  let currentPending = pending();
  return {
    staging,
    borrowingEnabled: !staging || config.borrowingEnabled === true,
    onAuth: callback => onAuthStateChanged(auth, callback),
    user: () => auth.currentUser,
    signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
    signInGoogle: () => signInWithPopup(auth, new GoogleAuthProvider()),
    ensureReader: () => ensureReader(),
    signOut: () => signOut(auth),
    pending: () => currentPending,
    async catalogue() {
      const [libraries, works, editions, copies] = await Promise.all([
        getDocs(query(collection(db, 'libraries'), where('status', '==', 'active'), where('visibility', '==', 'public'), limit(20))),
        getDocs(query(collection(db, 'works'), where('visibility', '==', 'public'), limit(20))),
        getDocs(query(collection(db, 'editions'), where('visibility', '==', 'public'), limit(20))),
        getDocs(query(collection(db, 'copies'), where('visibility', '==', 'public'), limit(20)))
      ]);
      const mapped = snapshot => Object.fromEntries(snapshot.docs.map(item => [item.id, { id: item.id, ...item.data() }]));
      return { libraries: mapped(libraries), works: mapped(works), editions: mapped(editions), copies: mapped(copies) };
    },
    async myRequests() {
      if (!auth.currentUser) return [];
      const result = await getDocs(query(collection(db, 'requests'), where('readerUid', '==', auth.currentUser.uid), limit(20)));
      return result.docs.map(item => ({ id: item.id, ...item.data() }));
    },
    async operatorLibrary() {
      if (!auth.currentUser) return null;
      const memberships = await getDocs(query(collection(db, 'memberships'), where('uid', '==', auth.currentUser.uid), limit(20)));
      return memberships.docs.map(item => item.data()).filter(item => item.status === 'active' && item.role === 'operator').map(item => item.libraryId);
    },
    async libraryRequests(libraryId) {
      const result = await getDocs(query(collection(db, 'requests'), where('libraryId', '==', libraryId), limit(20)));
      return result.docs.map(item => ({ id: item.id, ...item.data() }));
    },
    async allRequests() {
      if (!auth.currentUser) return [];
      const grant = await getDoc(doc(db, 'adminGrants', auth.currentUser.uid));
      if (!grant.exists() || grant.data().status !== 'active' || grant.data().role !== 'superuser') return null;
      const result = await getDocs(query(collection(db, 'requests'), limit(20)));
      return result.docs.map(item => ({ id: item.id, ...item.data() }));
    },
    async getCopy(copyId) {
      const snapshot = await getDoc(doc(db, 'copies', copyId));
      return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
    },
    async contact(requestId) {
      const snapshot = await getDoc(doc(db, 'requestContacts', requestId));
      return snapshot.exists() ? snapshot.data().whatsapp : '';
    },
    async execute(kind, targetId, retry = false, whatsapp = '', reason = '') {
      if (staging && config.borrowingEnabled !== true) return { ok: false, code: 'borrowingDisabled' };
      if (!auth.currentUser) return { ok: false, code: 'signInRequired' };
      if (!navigator.onLine) return { ok: false, code: 'offline' };
      if (currentPending && currentPending.uid !== auth.currentUser.uid) return { ok: false, code: 'unknownOutcome' };
      if (currentPending && !retry) return { ok: false, code: 'unknownOutcome' };
      const input = retry ? currentPending?.input : { kind, targetId, operationId: crypto.randomUUID(), ...(whatsapp ? { whatsapp } : {}), ...(reason ? { reason } : {}) };
      if (!input) return { ok: false, code: 'invalidInput' };
      currentPending = { uid: auth.currentUser.uid, input };
      savePending(currentPending);
      try {
        const result = (await command(input)).data;
        currentPending = null;
        savePending(null);
        return result;
      } catch {
        try {
          const receipt = await getDoc(doc(db, 'operations', receiptId(auth.currentUser.uid, input.operationId)));
          if (receipt.exists()) {
            currentPending = null;
            savePending(null);
            return receipt.data().result;
          }
        } catch { /* Preserve the same intent for manual retry. */ }
        return { ok: false, code: 'unknownOutcome' };
      }
    }
  };
}
