const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
function harness(fetcher) {
  const context = { TextDecoder, crypto: webcrypto, URL, Date, fetch: async () => { throw new Error('Unexpected network call'); }, window: { google: { accounts: { oauth2: {
    initTokenClient(options) { return { requestAccessToken() { options.callback({ access_token: 'test-token', expires_in: 3600 }); } }; }
  } } } } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('drive-books.js', 'utf8').replaceAll('export ', '') + '\nglobalThis.api = { inspectPdf, driveLink, createDriveBooks };', context);
  return { ...context.api, drive: context.api.createDriveBooks('test.apps.googleusercontent.com', { fetcher }) };
}
const pdf = (content = '%PDF-1.4\nfictional', name = 'fictional.pdf', size) => ({ name, type: 'application/pdf', size: size ?? Buffer.byteLength(content), async arrayBuffer() { return new TextEncoder().encode(content).buffer; } });
test('PDF validation rejects false extensions, bad headers, empty and oversize files', async () => {
  const { inspectPdf, driveLink } = harness();
  const info = await inspectPdf(pdf()); assert.match(info.sha256, /^[a-f0-9]{64}$/);
  for (const invalid of [pdf('not PDF'), pdf('%PDF-', 'bad.exe'), pdf('%PDF-', 'empty.pdf', 0), pdf('%PDF-', 'large.pdf', 26214401)]) await assert.rejects(inspectPdf(invalid));
  assert.throws(() => driveLink('x/../../bad'));
});
test('lost upload response reuses the existing file ID instead of creating another file', async () => {
  const calls = [];
  const { drive } = harness(async url => { calls.push(url); return { ok: true, status: 200, json: async () => ({ size: '5', appProperties: { sha256: 'same' } }) }; });
  await drive.connect(); await drive.upload({ fileId: 'stable', sha256: 'same' }, { size: 5 }, () => {});
  assert.equal(calls.length, 1); assert.match(calls[0], /files\/stable/);
});
test('private draft check refuses public or shared files', async () => {
  const { drive } = harness(async () => ({ ok: true, status: 200, json: async () => ({ permissions: [{ type: 'user', role: 'owner' }, { type: 'anyone', role: 'reader' }] }) }));
  await drive.connect(); await assert.rejects(drive.verifyPrivate('file'), /DRIVE_PRIVATE/);
});
test('publication retry verifies existing public permission without duplicating it', async () => {
  let writes = 0;
  const { drive } = harness(async (url, options) => {
    if (options.method === 'POST') writes++;
    return { ok: true, status: 200, json: async () => url.includes('permissions') ?
      { permissions: [{ type: 'anyone', role: 'reader' }] } : { size: '5', mimeType: 'application/pdf', appProperties: { sha256: 'same' } } };
  });
  assert.equal(drive.isConnected(), false);
  await drive.connect(); assert.equal(drive.isConnected(), true);
  assert.equal(await drive.publish({ fileId: 'stable', sha256: 'same', size: 5 }), 'https://drive.google.com/file/d/stable/view');
  assert.equal(writes, 0); drive.disconnect(); assert.equal(drive.isConnected(), false);
  await assert.rejects(drive.publish({ fileId: 'stable' }), /DRIVE_CONNECT/);
});
