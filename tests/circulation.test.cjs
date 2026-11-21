'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCirculation } = require('../functions/circulation.cjs');

function fakeDb() {
  const docs = new Map();
  let next = 0;
  let queue = Promise.resolve();
  const ref = (path, id) => ({ path: `${path}/${id}`, id });
  return {
    docs,
    collection(path) { return { doc(id) { return ref(path, id || `generated-${++next}`); } }; },
    runTransaction(callback) {
      const run = queue.then(async () => {
        const changes = [];
        const tx = {
          get: async target => ({ exists: docs.has(target.path), data: () => structuredClone(docs.get(target.path)) }),
          create: (target, value) => changes.push(['create', target.path, value]),
          update: (target, value) => changes.push(['update', target.path, value])
        };
        const result = await callback(tx);
        for (const [kind, path, value] of changes) {
          if (kind === 'create' && docs.has(path)) throw new Error('duplicate create');
          docs.set(path, { ...(kind === 'update' ? docs.get(path) : {}), ...value });
        }
        return result;
      });
      queue = run.catch(() => {});
      return run;
    }
  };
}

function setup() {
  const db = fakeDb();
  db.docs.set('copies/copy-1', { libraryId: 'lib-1', visibility: 'public', availability: 'available', activeRequestId: null, version: 0 });
  db.docs.set('memberships/lib-1_operator', { uid: 'operator', libraryId: 'lib-1', role: 'operator', status: 'active' });
  return { db, service: createCirculation(db, () => 'emulator-time') };
}
const cmd = (kind, targetId, operationId) => ({ kind, targetId, operationId });

test('competing readers, replay, changed payload, and lost-response retry', async () => {
  const { db, service } = setup();
  const [first, second] = await Promise.all([
    service.execute('reader-1', cmd('requestCopy', 'copy-1', 'intent-1')),
    service.execute('reader-2', cmd('requestCopy', 'copy-1', 'intent-2'))
  ]);
  assert.equal([first, second].filter(result => result.ok).length, 1);
  const winner = first.ok ? 'reader-1' : 'reader-2';
  const intent = first.ok ? 'intent-1' : 'intent-2';
  const result = first.ok ? first : second;
  assert.deepEqual(await service.execute(winner, cmd('requestCopy', 'copy-1', intent)), result);
  assert.equal((await service.execute(winner, cmd('requestCopy', 'other-copy', intent))).code, 'operationMismatch');
  assert.equal(db.docs.get('copies/copy-1').activeRequestId, result.requestId);
  assert.equal([...db.docs.keys()].filter(path => path.startsWith('requests/')).length, 1);
});

test('scoped operator, cancellation and full return free the copy atomically', async () => {
  const { db, service } = setup();
  const request = await service.execute('reader', cmd('requestCopy', 'copy-1', 'request'));
  const id = request.requestId;
  assert.equal((await service.execute('other', cmd('markReady', id, 'wrong'))).code, 'permissionDenied');
  db.docs.set('memberships/lib-2_other', { uid: 'other', libraryId: 'lib-2', role: 'operator', status: 'active' });
  assert.equal((await service.execute('other', cmd('markReady', id, 'wrong-2'))).code, 'permissionDenied');
  assert.equal((await service.execute('operator', cmd('checkOut', id, 'early'))).code, 'stageInvalid');
  assert.equal((await service.execute('operator', cmd('markReady', id, 'ready'))).ok, true);
  assert.equal((await service.execute('operator', cmd('checkOut', id, 'checkout'))).ok, true);
  assert.equal((await service.execute('reader', cmd('cancelRequest', id, 'late-cancel'))).code, 'stageInvalid');
  db.docs.get('memberships/lib-1_operator').status = 'suspended';
  assert.equal((await service.execute('operator', cmd('markReturned', id, 'revoked'))).code, 'permissionDenied');
  db.docs.get('memberships/lib-1_operator').status = 'active';
  assert.equal((await service.execute('operator', cmd('markReturned', id, 'return'))).ok, true);
  assert.equal((await service.execute('operator', cmd('markReturned', id, 'new-return'))).code, 'conflict');
  assert.equal(db.docs.get('loans/' + id).state, 'closed');
  assert.deepEqual([db.docs.get('copies/copy-1').availability, db.docs.get('copies/copy-1').activeRequestId], ['available', null]);
  assert.equal((await service.execute('reader-2', cmd('requestCopy', 'copy-1', 'next'))).ok, true);
});

test('cancelled request releases the copy; malformed commands do not write', async () => {
  const { db, service } = setup();
  assert.equal((await service.execute('reader', { kind: 'requestCopy', targetId: 'copy-1', operationId: 'x', state: 'ready' })).code, 'invalidInput');
  const first = await service.execute('reader', cmd('requestCopy', 'copy-1', 'first'));
  assert.equal((await service.execute('operator', cmd('cancelRequest', first.requestId, 'no-reason'))).code, 'invalidInput');
  assert.equal((await service.execute('reader', cmd('cancelRequest', first.requestId, 'cancel'))).ok, true);
  assert.equal(db.docs.get('copies/copy-1').availability, 'available');
  assert.equal((await service.execute('reader', cmd('cancelRequest', first.requestId, 'again'))).code, 'conflict');
});

test('optional contact is validated, private, and bound to the retry payload', async () => {
  const { db, service } = setup();
  assert.equal((await service.execute('reader', { ...cmd('requestCopy', 'copy-1', 'bad'), whatsapp: '01700000000' })).code, 'invalidInput');
  const input = { ...cmd('requestCopy', 'copy-1', 'contact'), whatsapp: '+8801700000000' };
  const result = await service.execute('reader', input);
  assert.equal(result.ok, true);
  assert.equal(db.docs.get('requestContacts/' + result.requestId).whatsapp, input.whatsapp);
  assert.equal(db.docs.get('requests/' + result.requestId).whatsapp, undefined);
  assert.equal(db.docs.get('operations/6_reader_contact').fingerprint.includes(input.whatsapp), false);
  assert.deepEqual(await service.execute('reader', input), result);
  assert.equal((await service.execute('reader', { ...input, whatsapp: '+8801700000001' })).code, 'operationMismatch');
  assert.equal((await service.execute('superuser', cmd('markReady', result.requestId, 'super-mutation'))).code, 'permissionDenied');
  db.docs.set('adminGrants/superuser', { role: 'superuser', status: 'active' });
  assert.equal((await service.execute('superuser', cmd('requestCopy', 'copy-1', 'super-request'))).code, 'permissionDenied');
});
