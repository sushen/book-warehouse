'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { createCirculation } = require('../functions/circulation.cjs');
const firebase = require('firebase/compat/app');
require('firebase/compat/firestore');

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Firestore emulator is required.');
const projectId = 'demo-book-warehouse';
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
const environment = initializeTestEnvironment({ projectId, firestore: { host, port: Number(port), rules: fs.readFileSync('firestore.rules', 'utf8') } });
const adminApp = initializeApp({ projectId }, 'emulator-test');
const db = getFirestore(adminApp);
const service = createCirculation(db, () => new Date());
after(async () => { await deleteApp(adminApp); await (await environment).cleanup(); });

async function seed() {
  const env = await environment;
  await env.clearFirestore();
  const batch = db.batch();
  batch.set(db.doc('libraries/lib-a'), { status: 'active', visibility: 'public', name: { en: 'Fictional library' } });
  batch.set(db.doc('libraries/lib-private'), { status: 'draft', visibility: 'private' });
  batch.set(db.doc('works/work-a'), { visibility: 'public' });
  batch.set(db.doc('editions/edition-a'), { visibility: 'public', workId: 'work-a' });
  batch.set(db.doc('copies/copy-a'), { visibility: 'public', editionId: 'edition-a', libraryId: 'lib-a', availability: 'available', activeRequestId: null, version: 0 });
  batch.set(db.doc('copies/copy-b'), { visibility: 'public', editionId: 'edition-a', libraryId: 'lib-a', availability: 'available', activeRequestId: null, version: 0 });
  batch.set(db.doc('memberships/lib-a_operator'), { uid: 'operator', libraryId: 'lib-a', role: 'operator', status: 'active' });
  batch.set(db.doc('memberships/lib-other_outsider'), { uid: 'outsider', libraryId: 'lib-other', role: 'operator', status: 'active' });
  batch.set(db.doc('adminGrants/superuser'), { uid: 'superuser', role: 'superuser', status: 'active' });
  await batch.commit();
  return env;
}

test('public/private reads, role scope and direct writes', async () => {
  const env = await seed();
  const anonymous = env.unauthenticatedContext().firestore();
  const reader = env.authenticatedContext('reader').firestore();
  const operator = env.authenticatedContext('operator').firestore();
  const outsider = env.authenticatedContext('outsider').firestore();
  const superuser = env.authenticatedContext('superuser').firestore();
  await assertSucceeds(anonymous.doc('copies/copy-a').get());
  await assertSucceeds(anonymous.collection('copies').where('visibility', '==', 'public').get());
  await assertFails(anonymous.doc('libraries/lib-private').get());
  await assertFails(anonymous.collection('libraries').get());
  await assertFails(anonymous.doc('memberships/lib-a_operator').get());
  await assertFails(reader.doc('copies/copy-a').update({ availability: 'held' }));
  await assertFails(operator.doc('copies/copy-a').update({ availability: 'held' }));
  await assertFails(operator.doc('memberships/lib-a_operator').update({ status: 'active' }));
  await assertFails(operator.doc('adminGrants/operator').set({ status: 'active' }));
  const request = await service.execute('reader', { kind: 'requestCopy', targetId: 'copy-a', operationId: 'one', whatsapp: '+8801700000000' });
  await assertSucceeds(reader.doc(`requests/${request.requestId}`).get());
  await assertSucceeds(operator.doc(`requests/${request.requestId}`).get());
  await assertFails(outsider.doc(`requests/${request.requestId}`).get());
  await assertFails(anonymous.doc(`requests/${request.requestId}`).get());
  await assertSucceeds(superuser.collection('requests').limit(20).get());
  await assertFails(reader.collection('requests').limit(20).get());
  await assertSucceeds(reader.collection('requests').where('readerUid', '==', 'reader').limit(20).get());
  await assertSucceeds(operator.collection('requests').where('libraryId', '==', 'lib-a').limit(20).get());
  await assertFails(outsider.collection('requests').where('libraryId', '==', 'lib-a').limit(20).get());
  await assertSucceeds(reader.doc(`requestContacts/${request.requestId}`).get());
  await assertSucceeds(operator.doc(`requestContacts/${request.requestId}`).get());
  await assertFails(outsider.doc(`requestContacts/${request.requestId}`).get());
  await assertFails(superuser.doc(`requestContacts/${request.requestId}`).get());
  await assertFails(superuser.collection('requestContacts').get());
  await assertFails(superuser.doc(`requests/${request.requestId}`).update({ state: 'ready' }));
  assert.equal((await service.execute('superuser', { kind: 'markReady', targetId: request.requestId, operationId: 'no-mutation' })).code, 'permissionDenied');
  assert.equal((await service.execute('superuser', { kind: 'requestCopy', targetId: 'copy-b', operationId: 'no-request' })).code, 'permissionDenied');
  await assertFails(reader.doc(`requests/${request.requestId}`).update({ state: 'returned' }));
  await assertSucceeds(reader.doc('operations/6_reader_one').get());
  await assertFails(outsider.doc('operations/6_reader_one').get());
});

test('real emulator transactions serialize reservations, retries, return and revocation', async () => {
  await seed();
  const [a, b] = await Promise.all([
    service.execute('reader-a', { kind: 'requestCopy', targetId: 'copy-a', operationId: 'a' }),
    service.execute('reader-b', { kind: 'requestCopy', targetId: 'copy-a', operationId: 'b' })
  ]);
  assert.equal([a, b].filter(result => result.ok).length, 1);
  const winner = a.ok ? 'reader-a' : 'reader-b';
  const intent = a.ok ? 'a' : 'b';
  const request = a.ok ? a : b;
  assert.deepEqual(await service.execute(winner, { kind: 'requestCopy', targetId: 'copy-a', operationId: intent }), request);
  assert.equal((await service.execute(winner, { kind: 'requestCopy', targetId: 'copy-b', operationId: intent })).code, 'operationMismatch');
  assert.equal((await service.execute('outsider', { kind: 'markReady', targetId: request.requestId, operationId: 'wrong' })).code, 'permissionDenied');
  assert.equal((await service.execute('operator', { kind: 'markReady', targetId: request.requestId, operationId: 'ready' })).ok, true);
  assert.equal((await service.execute('operator', { kind: 'checkOut', targetId: request.requestId, operationId: 'checkout' })).ok, true);
  await db.doc('memberships/lib-a_operator').update({ status: 'suspended' });
  assert.equal((await service.execute('operator', { kind: 'markReturned', targetId: request.requestId, operationId: 'blocked' })).code, 'permissionDenied');
  await db.doc('memberships/lib-a_operator').update({ status: 'active' });
  assert.equal((await service.execute('operator', { kind: 'markReturned', targetId: request.requestId, operationId: 'return' })).ok, true);
  assert.equal((await service.execute('operator', { kind: 'markReturned', targetId: request.requestId, operationId: 'duplicate' })).ok, false);
  const copy = (await db.doc('copies/copy-a').get()).data();
  const loan = (await db.doc(`loans/${request.requestId}`).get()).data();
  assert.deepEqual([copy.availability, copy.activeRequestId, loan.state], ['available', null, 'closed']);
  assert.equal((await service.execute('reader-c', { kind: 'requestCopy', targetId: 'copy-a', operationId: 'new' })).ok, true);
});

const clock = () => firebase.firestore.FieldValue.serverTimestamp();
async function adminReview(client, uid, id, state, reason = '') {
  return client.runTransaction(async tx => {
    const ref = client.doc('sparkRequests/' + id), snapshot = await tx.get(ref), old = snapshot.data();
    const copyRef = client.doc('copies/' + old.copyId), copy = (await tx.get(copyRef)).data();
    tx.update(ref, { state, [state === 'ready' ? 'readyAt' : 'cancelledAt']: clock(),
      reviewedBy: uid, reviewedAt: clock(), decisionReason: reason, updatedAt: clock(), version: old.version + 1 });
    tx.update(copyRef, { availability: state === 'ready' ? 'ready' : 'available',
      activeRequestId: state === 'ready' ? id : null, updatedAt: clock(), version: copy.version + 1 });
  });
}
async function profile(client, uid) {
  return client.runTransaction(async tx => {
    const ref = client.doc(`accounts/${uid}`);
    if ((await tx.get(ref)).exists) return false;
    tx.set(ref, { displayName: '', status: 'active', createdAt: clock(), updatedAt: clock() });
    return true;
  });
}
async function sparkCommand(client, uid, kind, target, operationId = 'intent', whatsapp = '', nameOverride = null) {
  const id = kind === 'request' ? `${uid}_${operationId}` : target;
  const requestRef = client.doc(`sparkRequests/${id}`);
  return client.runTransaction(async tx => {
    const old = await tx.get(requestRef);
    if (kind === 'request' && old.exists) return id;
    const request = old.exists ? old.data() : null;
    const copyRef = client.doc(`copies/${request ? request.copyId : target}`);
    const copy = (await tx.get(copyRef)).data();
    if (kind === 'request') {
      const account = await tx.get(client.doc(`accounts/${uid}`));
      if (copy.availability !== 'available') return null;
      tx.set(requestRef, { readerUid: uid, readerName: nameOverride ?? account.data()?.displayName ?? '', copyId: target, libraryId: copy.libraryId, operationId,
        state: 'requested', createdAt: clock(), updatedAt: clock(), readyAt: null, borrowedAt: null,
        returnedAt: null, cancelledAt: null, version: 1 });
      tx.update(copyRef, { availability: 'held', activeRequestId: id, updatedAt: clock(), version: copy.version + 1 });
      if (whatsapp) tx.set(client.doc(`sparkContacts/${id}`), { readerUid: uid, libraryId: copy.libraryId, whatsapp });
    } else {
      const state = { cancel: 'cancelled', ready: 'ready', checkout: 'borrowed', return: 'returned' }[kind];
      const field = { cancel: 'cancelledAt', ready: 'readyAt', checkout: 'borrowedAt', return: 'returnedAt' }[kind];
      tx.update(requestRef, { state, [field]: clock(), updatedAt: clock(), version: request.version + 1 });
      tx.update(copyRef, { availability: state === 'ready' ? 'ready' : state === 'borrowed' ? 'onLoan' : 'available',
        activeRequestId: ['cancelled', 'returned'].includes(state) ? null : id,
        updatedAt: clock(), version: copy.version + 1 });
    }
    return id;
  });
}

test('Spark profile allowlist, paired transitions, scope and concurrent lock', async () => {
  const env = await seed();
  const reader = env.authenticatedContext('reader').firestore();
  const second = env.authenticatedContext('second').firestore();
  const operator = env.authenticatedContext('operator').firestore();
  const outsider = env.authenticatedContext('outsider').firestore();
  const anonymous = env.unauthenticatedContext().firestore();
  await assertFails(anonymous.doc('accounts/reader').set({ displayName: '', status: 'active' }));
  await assertFails(sparkCommand(anonymous, 'anonymous', 'request', 'copy-a', 'guest'));
  await assertFails(sparkCommand(reader, 'reader', 'request', 'copy-a', 'before-profile'));
  assert.equal(await assertSucceeds(profile(reader, 'reader')), true);
  assert.equal(await assertSucceeds(profile(reader, 'reader')), false);
  await assertSucceeds(reader.doc('accounts/reader').get());
  await assertFails(operator.doc('accounts/reader').get());
  await assertFails(outsider.doc('accounts/reader').get());
  await assertFails(profile(reader, 'second'));
  await assertFails(reader.doc('accounts/reader').update({ status: 'operator' }));
  await assertFails(sparkCommand(reader, 'reader', 'request', 'copy-a', 'unnamed'));
  await assertFails(reader.doc('accounts/reader').update({ displayName: '   ', updatedAt: clock() }));
  await assertFails(reader.doc('accounts/reader').update({ displayName: 'Reader', role: 'admin', updatedAt: clock() }));
  await assertSucceeds(reader.doc('accounts/reader').update({ displayName: 'Reader One', updatedAt: clock() }));
  await assertFails(sparkCommand(reader, 'reader', 'request', 'copy-a', 'forged', '', 'Another Person'));
  await assertFails(reader.doc('accounts/new').set({ displayName: '', status: 'active', role: 'admin', createdAt: clock(), updatedAt: clock() }));
  await assertFails(anonymous.doc('sparkRequests/anonymous').set({ state: 'requested' }));
  await assertFails(reader.doc('copies/copy-a').update({ availability: 'held', activeRequestId: 'fake' }));
  await assertFails(reader.doc('sparkRequests/fake').set({ readerUid: 'reader', state: 'requested' }));
  await assertSucceeds(profile(second, 'second'));
  await assertSucceeds(second.doc('accounts/second').update({ displayName: 'Reader Two', updatedAt: clock() }));
  const attempts = await Promise.allSettled([
    sparkCommand(reader, 'reader', 'request', 'copy-a', 'first'),
    sparkCommand(second, 'second', 'request', 'copy-a', 'second')
  ]);
  const winners = attempts.filter(result => result.status === 'fulfilled' && result.value);
  assert.equal(winners.length, 1);
  const winner = attempts[0].status === 'fulfilled' && attempts[0].value ? reader : second;
  const uid = winner === reader ? 'reader' : 'second';
  const requestId = winners[0].value;
  assert.equal(await assertSucceeds(sparkCommand(winner, uid, 'request', 'copy-a', uid === 'reader' ? 'first' : 'second')), requestId);
  await assertFails(anonymous.doc(`sparkRequests/${requestId}`).get());
  await assertFails(outsider.doc(`sparkRequests/${requestId}`).get());
  await assertSucceeds(operator.doc(`sparkRequests/${requestId}`).get());
  assert.equal((await operator.doc(`sparkRequests/${requestId}`).get()).data().readerName, uid === 'reader' ? 'Reader One' : 'Reader Two');
  const signalRef = winner.doc(`borrowingSignals/${requestId}`);
  await assertSucceeds(signalRef.get());
  const pickupSignal = { readerUid: uid, libraryId: 'lib-a', pickupRequestedAt: clock(), returnRequestedAt: null, updatedAt: clock() };
  await assertFails(signalRef.set(pickupSignal));
  await assertSucceeds(winner.doc(`accounts/${uid}`).update({ displayName: 'Updated Reader', updatedAt: clock() }));
  assert.equal((await operator.doc(`sparkRequests/${requestId}`).get()).data().readerName, uid === 'reader' ? 'Reader One' : 'Reader Two');
  await assertFails(operator.doc(`sparkRequests/${requestId}`).update({ readerName: 'Forged Name' }));
  await assertSucceeds(operator.collection('sparkRequests').where('libraryId', '==', 'lib-a').limit(20).get());
  await assertSucceeds(winner.collection('sparkRequests').where('readerUid', '==', uid).limit(20).get());
  await assertSucceeds(env.authenticatedContext('superuser').firestore().collection('sparkRequests').limit(20).get());
  await assertFails(outsider.collection('sparkRequests').where('libraryId', '==', 'lib-a').get());
  await assertFails(winner.doc(`sparkRequests/${requestId}`).update({ state: 'ready' }));
  await assertFails(operator.doc('copies/copy-a').update({ availability: 'ready' }));
  await assertFails(operator.doc(`sparkRequests/${requestId}`).update({ libraryId: 'lib-private' }));
  await assertFails(outsider.doc(`sparkContacts/${requestId}`).get());
  await assertFails(env.authenticatedContext('superuser').firestore().doc(`sparkContacts/${requestId}`).get());
  await assertFails(winner.doc(`sparkContacts/${requestId}`).set({ readerUid: uid, libraryId: 'lib-a', whatsapp: '+8801700000000' }));
  await assertFails(outsider.runTransaction(async tx => {
    const ref = outsider.doc(`sparkRequests/${requestId}`); const old = await tx.get(ref);
    tx.update(ref, { state: 'ready', readyAt: clock(), updatedAt: clock(), version: old.data().version + 1 });
  }));
  await assertSucceeds(sparkCommand(operator, 'operator', 'ready', requestId));
  await assertSucceeds(signalRef.set(pickupSignal));
  await assertFails(outsider.doc(`borrowingSignals/${requestId}`).get());
  await assertFails(anonymous.doc(`borrowingSignals/${requestId}`).get());
  await assertSucceeds(env.authenticatedContext('superuser').firestore().collection('borrowingSignals').get());
  await assertFails(signalRef.update({ returnRequestedAt: clock(), updatedAt: clock() }));
  await assertFails(outsider.doc(`borrowingSignals/${requestId}`).update({ pickupRequestedAt: clock(), updatedAt: clock() }));
  await assertFails(signalRef.update({ libraryId: 'lib-private', updatedAt: clock() }));
  await assertSucceeds(sparkCommand(operator, 'operator', 'checkout', requestId));
  await assertSucceeds(signalRef.update({ returnRequestedAt: clock(), updatedAt: clock() }));
  assert.equal((await winner.doc(`sparkRequests/${requestId}`).get()).data().state, 'borrowed');
  assert.equal((await winner.doc('copies/copy-a').get()).data().availability, 'onLoan');
  await assertFails(signalRef.update({ returnRequestedAt: clock(), updatedAt: clock() }));
  await assertFails(sparkCommand(winner, uid, 'cancel', requestId));
  await assertSucceeds(sparkCommand(operator, 'operator', 'return', requestId));
  const copy = (await db.doc('copies/copy-a').get()).data();
  assert.deepEqual([copy.availability, copy.activeRequestId], ['available', null]);
  await assertSucceeds(sparkCommand(reader, 'reader', 'request', 'copy-a', 'after-return', '+8801700000000'));
  await assertSucceeds(reader.doc('sparkContacts/reader_after-return').get());
  await assertSucceeds(operator.doc('sparkContacts/reader_after-return').get());
  await assertFails(outsider.doc('sparkContacts/reader_after-return').get());
  await assertSucceeds(sparkCommand(reader, 'reader', 'cancel', 'reader_after-return'));
  await assertFails(operator.doc(`sparkRequests/${requestId}`).update({ readerUid: 'operator' }));
  await db.doc('sparkRequests/legacy').set({ readerUid: 'reader', copyId: 'copy-b', libraryId: 'lib-a', operationId: 'legacy',
    state: 'requested', createdAt: new Date(), updatedAt: new Date(), readyAt: null, borrowedAt: null,
    returnedAt: null, cancelledAt: null, version: 1 });
  await db.doc('copies/copy-b').update({ availability: 'held', activeRequestId: 'legacy', version: 1 });
  await assertSucceeds(sparkCommand(operator, 'operator', 'ready', 'legacy'));
  await assertSucceeds(sparkCommand(operator, 'operator', 'checkout', 'legacy'));
  await assertSucceeds(sparkCommand(operator, 'operator', 'return', 'legacy'));
});

test('super admin reviews requests with audit fields and registers real lending stock', async () => {
  const env = await seed();
  const reader = env.authenticatedContext('reader').firestore();
  const supervisor = env.authenticatedContext('superuser').firestore();
  const outsider = env.authenticatedContext('outsider').firestore();
  // The dashboard reads each complete collection, including nonpublic inventory.
  await db.doc('copies/private-admin-copy').set({ visibility: 'private', libraryId: 'lib-private' });
  for (const name of ['libraries', 'works', 'editions', 'copies']) {
    await assertSucceeds(supervisor.collection(name).orderBy(firebase.firestore.FieldPath.documentId()).limit(100).get());
  }
  await assertFails(outsider.collection('copies').orderBy(firebase.firestore.FieldPath.documentId()).limit(100).get());
  await profile(reader, 'reader');
  await reader.doc('accounts/reader').update({ displayName: 'Reader', updatedAt: clock() });
  const id = await sparkCommand(reader, 'reader', 'request', 'copy-a', 'review-test');
  await assertFails(adminReview(outsider, 'outsider', id, 'ready'));
  await assertFails(sparkCommand(supervisor, 'superuser', 'ready', id));
  await assertSucceeds(adminReview(supervisor, 'superuser', id, 'ready'));
  assert.equal((await reader.doc('sparkRequests/' + id).get()).data().reviewedBy, 'superuser');
  await assertSucceeds(sparkCommand(supervisor, 'superuser', 'checkout', id));
  await assertSucceeds(sparkCommand(supervisor, 'superuser', 'return', id));
  const rejection = await sparkCommand(reader, 'reader', 'request', 'copy-a', 'reject-test');
  await assertFails(adminReview(supervisor, 'superuser', rejection, 'cancelled', ''));
  await assertSucceeds(adminReview(supervisor, 'superuser', rejection, 'cancelled', 'Copy needs repair'));
  assert.equal((await db.doc('copies/copy-a').get()).data().availability, 'available');
  const work = { title: { en: 'Real title', bn: 'Real title' }, authorDisplay: { en: 'Author', bn: 'Author' },
    topics: { en: [], bn: [] }, visibility: 'public', createdAt: clock(), updatedAt: clock() };
  await assertFails(reader.doc('works/new-work').set(work));
  await assertFails(outsider.doc('works/new-work').set(work));
  const batch = supervisor.batch();
  batch.set(supervisor.doc('works/new-work'), work);
  batch.set(supervisor.doc('editions/new-edition'), { workId: 'new-work', languageCode: 'bn', format: 'print',
    isbn: '', visibility: 'public', createdAt: clock(), updatedAt: clock() });
  batch.set(supervisor.doc('copies/new-copy'), { editionId: 'new-edition', libraryId: 'lib-a',
    visibility: 'public', availability: 'available', activeRequestId: null, version: 0,
    createdAt: clock(), updatedAt: clock() });
  await assertSucceeds(batch.commit());
  await assertFails(reader.doc('works/new-work').update({ archived: true, updatedAt: clock() }));
  await assertFails(supervisor.doc('works/new-work').update({ archived: true, title: { en:'changed' }, updatedAt: clock() }));
  await assertSucceeds(supervisor.doc('works/new-work').update({ archived: true, updatedAt: clock() }));
  assert.equal((await reader.doc('copies/new-copy').get()).data().availability, 'available');
  await assertSucceeds(supervisor.doc('works/new-work').update({ archived: false, updatedAt: clock() }));
  await assertFails(supervisor.doc('copies/new-copy').update({ availability: 'held' }));
  await assertFails(supervisor.doc('copies/invalid-copy').set({ editionId: 'missing', libraryId: 'lib-a',
    visibility: 'public', availability: 'available', activeRequestId: null, version: 0,
    createdAt: clock(), updatedAt: clock() }));
});
