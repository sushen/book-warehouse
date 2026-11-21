import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { publicConfig } from './scripts/public-site-config.cjs';

const pagesBuild = process.env.BW_PAGES_BUILD === '1';

const demoScripts = ['sample-data.js', 'demo-store.js', 'locales.js', 'app.js'];

export default defineConfig({
  base: pagesBuild ? '/book-warehouse/' : './',
  plugins: [{
    name: 'copy-offline-demo-scripts',
    apply: 'build',
    async generateBundle() {
      for (const fileName of demoScripts) {
        this.emitFile({
          type: 'asset',
          fileName,
          source: await readFile(resolve(import.meta.dirname, fileName))
        });
      }
    }
  }, ...(pagesBuild ? [{
    name: 'public-pages-config', apply: 'build',
    async generateBundle() {
      const config = publicConfig(JSON.parse(await readFile(resolve(import.meta.dirname, 'public-site-config.json'), 'utf8')));
      this.emitFile({ type:'asset', fileName:'spark-config.json', source:JSON.stringify(config, null, 2) });
      this.emitFile({ type:'asset', fileName:'.nojekyll', source:'' });
    }
  }] : [])],
  build: {
    rollupOptions: {
      input: pagesBuild ? {
        demo: resolve(import.meta.dirname, 'index.html'),
        spark: resolve(import.meta.dirname, 'spark.html'),
        admin: resolve(import.meta.dirname, 'admin.html')
      } : {
        demo: resolve(import.meta.dirname, 'index.html'),
        emulator: resolve(import.meta.dirname, 'shared.html'),
        staging: resolve(import.meta.dirname, 'staging.html'),
        spark: resolve(import.meta.dirname, 'spark.html'),
        admin: resolve(import.meta.dirname, 'admin.html'),
        sparkEmulator: resolve(import.meta.dirname, 'spark-emulator.html')
      }
    }
  }
});
