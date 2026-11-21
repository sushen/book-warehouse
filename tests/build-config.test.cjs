const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { resolve } = require('node:path');

test('offline demo classic scripts are emitted at their HTML paths in order', async () => {
  const root = resolve(__dirname, '..');
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  const references = [...html.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)]
    .map((match) => match[1]);
  assert.deepEqual(references, ['sample-data.js', 'demo-store.js', 'locales.js', 'app.js']);

  const { default: config } = await import('../vite.config.js');
  const plugin = config.plugins.find((entry) => entry.name === 'copy-offline-demo-scripts');
  assert.ok(plugin);
  const emitted = [];
  await plugin.generateBundle.call({ emitFile(asset) { emitted.push(asset); } });
  assert.deepEqual(emitted.map((asset) => asset.fileName), references);
  for (const asset of emitted) {
    assert.equal(asset.type, 'asset');
    assert.deepEqual(asset.source, await readFile(resolve(root, asset.fileName)));
  }
});
