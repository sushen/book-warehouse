const { test } = require('node:test');
const assert = require('node:assert/strict');
const { GoogleFirebaseIdentity } = require('../protected/adapters/google-firebase-identity.cjs');
function fixture({ user = { uid: 'google-reader', auth_time: 100, firebase: { sign_in_provider: 'google.com' } }, account = { localId: 'google-reader', validSince: '90' }, grant = { status: { stringValue: 'active' }, role: { stringValue: 'superuser' } }, failGrant = false } = {}) {
  const calls = [];
  const identity = new GoogleFirebaseIdentity({
    projectId: 'expected-project', apiKey: 'public-web-key',
    context: { getStore: () => ({ authorization: 'Bearer signed-token' }) },
    auth: { async verifyIdToken(token) { assert.equal(token, 'signed-token'); if (user instanceof Error) throw user; return user; } },
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return { ok: url.includes('accounts:lookup') || !failGrant,
        json: async () => url.includes('accounts:lookup') ? { users: account ? [account] : [] } : { fields: grant } };
    }
  });
  return { identity, calls };
}
test('Google identity verifies the Firebase token and current account before trusting uid', async () => {
  const { identity, calls } = fixture();
  assert.equal((await identity.identify('Bearer signed-token')).uid, 'google-reader');
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(calls[0].init.body), { idToken: 'signed-token' });
});
test('invalid, disabled, revoked, wrong-user and non-Google sessions fail closed', async () => {
  for (const options of [
    { user: new Error('invalid-signature') },
    { account: { localId: 'google-reader', disabled: true } },
    { account: { localId: 'google-reader', validSince: '101' } },
    { account: { localId: 'other-user' } },
    { account: null },
    { user: { uid: 'google-reader', firebase: { sign_in_provider: 'anonymous' } } },
  ]) await assert.rejects(fixture(options).identity.identify('Bearer signed-token'), /sign-in-required/);
});
test('administrator access reads the existing project grant with the same verified bearer', async () => {
  const { identity, calls } = fixture();
  await identity.assertAdministrator('google-reader');
  assert.match(calls[1].url, /projects\/expected-project\/.*adminGrants\/google-reader$/);
  assert.equal(calls[1].init.headers.Authorization, 'Bearer signed-token');
  await assert.rejects(identity.assertAdministrator('another-uid'), /admin-required/);
  for (const options of [{ failGrant: true }, { grant: { status: { stringValue: 'revoked' }, role: { stringValue: 'superuser' } } }])
    await assert.rejects(fixture(options).identity.requireAdmin('Bearer signed-token'), /admin-required/);
});
test('actual Firebase SDK rejects unsigned emulator tokens in Google mode', async () => {
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, undefined);
  const { initializeApp, deleteApp } = require('firebase-admin/app');
  const { getAuth } = require('firebase-admin/auth');
  const app = initializeApp({ projectId: 'book-warehouse-staging-261115' }, 'google-token-boundary-test');
  const encoded = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = encoded({ alg: 'none', typ: 'JWT' }) + '.' + encoded({ aud: 'book-warehouse-staging-261115',
    iss: 'https://securetoken.google.com/book-warehouse-staging-261115', sub: 'forged',
    iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600 }) + '.';
  let sent = false;
  const identity = new GoogleFirebaseIdentity({ auth: getAuth(app), projectId: 'book-warehouse-staging-261115',
    apiKey: 'unused', fetcher: () => { sent = true; throw Error('must not send'); } });
  try { await assert.rejects(identity.identify('Bearer '+token), /sign-in-required/); assert.equal(sent,false); }
  finally { await deleteApp(app); }
});
test('domain administrator guards override local mirrored permissions and fail closed', async () => {
  const { CreditLicenseService } = require('../protected/core/credit-license-service.cjs');
  const { PublishingService } = require('../protected/core/publishing-service.cjs');
  const calls = [];
  const guard = async uid => { calls.push(uid); throw Error('admin-required'); };
  const repository = { runTransaction() {}, ref() {}, read() {} };
  const credits = new CreditLicenseService(repository, () => 0, guard);
  const publishing = new PublishingService({ repository, adminGuard: guard });
  await assert.rejects(credits.assertAdmin({}, 'revoked-admin'), /admin-required/);
  await assert.rejects(publishing.assertAdmin('revoked-admin', {}), /admin-required/);
  assert.deepEqual(calls, ['revoked-admin', 'revoked-admin']);
});
