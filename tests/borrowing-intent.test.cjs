const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync(require('node:path').join(__dirname, '../borrowing-intent.js'), 'utf8')
  .replace('export async function', 'async function');
const context = vm.createContext({});
vm.runInContext(source, context);

function storeFor(signedIn) {
  let user = signedIn ? { uid: 'reader' } : null;
  const calls = [];
  return {
    calls, user: () => user,
    async signInGoogle() { calls.push('sign-in'); user = { uid: 'reader' }; },
    async ensureReader() { calls.push('profile'); },
    async profile() { return { displayName: 'Reader Name' }; },
    async getCopy(id) { calls.push(id); return { id, availability: 'available', activeRequestId: null }; }
  };
}
test('signed-in reader reaches the selected copy without another sign-in', async () => {
  const store = storeFor(true);
  const result = await context.prepareBorrowing(store, 'copy-selected');
  assert.equal(result.code, 'ready');
  assert.equal(result.copy.id, 'copy-selected');
  assert.deepEqual(store.calls, ['profile', 'copy-selected']);
});
test('guest signs in once and resumes the same copy', async () => {
  const store = storeFor(false);
  const result = await context.prepareBorrowing(store, 'copy-selected');
  assert.equal(result.code, 'ready');
  assert.deepEqual(store.calls, ['sign-in', 'profile', 'copy-selected']);
});
test('a copy reserved during sign-in cannot proceed to confirmation', async () => {
  const store = storeFor(false);
  store.getCopy = async () => ({ availability: 'held', activeRequestId: 'another' });
  assert.equal((await context.prepareBorrowing(store, 'copy-selected')).code, 'copyUnavailable');
});
test('cancelled Google sign-in cannot proceed to the reader profile', async () => {
  const store = storeFor(false);
  store.signInGoogle = async () => { throw new Error('cancelled'); };
  await assert.rejects(context.prepareBorrowing(store, 'copy-selected'), /cancelled/);
  assert.deepEqual(store.calls, []);
});
