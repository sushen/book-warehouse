const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const config = { projectId: 'staging-project', appId: 'staging-app' };

function sessionHarness(currentUser, oldUser) {
  const apps = [];
  const sessions = new Map();
  const calls = [];
  const context = {
    getApps: () => apps,
    initializeApp(options, name = '[DEFAULT]') {
      const app = { name, options };
      apps.push(app);
      sessions.set(name, {
        currentUser: null,
        async authStateReady() {
          calls.push('restore:' + name);
          this.currentUser = name === '[DEFAULT]' ? currentUser : oldUser;
        }
      });
      return app;
    },
    getAuth: app => sessions.get(app.name),
    async updateCurrentUser(auth, user) {
      calls.push('transfer');
      auth.currentUser = user;
    },
    async signOut(auth) {
      calls.push('clear-legacy');
      auth.currentUser = null;
    }
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, '../firebase-reader-session.js'), 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replace('export async function', 'async function');
  vm.runInContext(source, context);
  return { restore: () => context.restoreReaderSession(config), calls, sessions };
}

test('restores the existing staging login before exposing the reader session', async () => {
  const reader = { uid: 'reader-current' };
  const harness = sessionHarness(reader, null);
  const result = await harness.restore();
  assert.equal(result.app.name, '[DEFAULT]');
  assert.equal(result.auth.currentUser, reader);
  assert.deepEqual(harness.calls, ['restore:[DEFAULT]', 'restore:spark']);
});

test('moves an earlier Spark login into the shared session without a new login', async () => {
  const reader = { uid: 'reader-legacy' };
  const harness = sessionHarness(null, reader);
  const result = await harness.restore();
  assert.equal(result.auth.currentUser, reader);
  assert.equal(harness.sessions.get('spark').currentUser, null);
  assert.deepEqual(harness.calls, ['restore:[DEFAULT]', 'restore:spark', 'transfer', 'clear-legacy']);
});

test('keeps the current identity when an older Spark identity also exists', async () => {
  const reader = { uid: 'reader-current' };
  const harness = sessionHarness(reader, { uid: 'reader-old' });
  const result = await harness.restore();
  assert.equal(result.auth.currentUser, reader);
  assert.equal(harness.sessions.get('spark').currentUser, null);
  assert.equal(harness.calls.includes('transfer'), false);
});

test('leaves guests signed out after session restoration', async () => {
  const harness = sessionHarness(null, null);
  const result = await harness.restore();
  assert.equal(result.auth.currentUser, null);
  assert.equal(harness.calls.includes('transfer'), false);
});
