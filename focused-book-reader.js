export const boundedPage = (value, limit) => Math.max(1, Math.min(limit, Math.floor(Number(value) || 1)));
/** Reading only: no wallet refresh, catalogue render or payment controls on a page turn. */
export class FocusedBookReader {
  constructor({ root, app, api, getUser, onClose, onUnlock }) {
    Object.assign(this, { root, app, api, getUser, onClose, onUnlock });
    this.generation = 0; this.url = null; this.state = null; this.fit = 'page';
    this.$ = id => root.querySelector('#' + id);
    this.$('protected-close').onclick = () => this.close();
    this.$('reader-prev').onclick = () => this.turn(-1);
    this.$('reader-next').onclick = () => this.turn(1);
    this.$('reader-retry').onclick = () => this.load(this.retryPage || this.state.page);
    this.$('reader-jump').onsubmit = e => { e.preventDefault(); this.load(this.$('reader-page-number').value); };
    this.$('reader-fit').onclick = () => {
      this.zoom = 100;
      this.fit = this.fit === 'page' ? 'width' : 'page'; root.dataset.fit = this.fit;
      this.$('reader-fit').textContent = this.fit === 'page' ? 'Fit width' : 'Fit page';
      this.$('reader-canvas').scrollTop = 0;
      this.$('reader-canvas').scrollLeft = 0;
    };
    this.zoom = 100;
    this.$('reader-zoom-in').onclick = () => this.setZoom(Math.min(200, this.zoom + 25));
    this.$('reader-zoom-out').onclick = () => this.setZoom(Math.max(75, this.zoom - 25));
    this.$('reader-fullscreen').onclick = async () => {
      try { if (document.fullscreenElement) await document.exitFullscreen(); else await root.requestFullscreen(); }
      catch { this.$('reader-status').textContent = 'Fullscreen is unavailable. You can still read here.'; }
    };
    root.addEventListener('keydown', e => {
      if (!this.state) return;
      if (e.key === 'Escape') { e.preventDefault(); this.close(); return; }
      if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); this.turn(e.key === 'ArrowRight' ? 1 : -1); }
      if (e.key === 'Tab') {
        const nodes = [...root.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href]')].filter(n => n.getClientRects().length);
        const first = nodes[0], last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    });
  }
  key(book, mode, uid) { return JSON.stringify(['bw-reading-position', uid || 'guest', book.id, book.version, mode]); }
  async open(book, mode) {
    const previous = this.state;
    const continuation = previous?.book.id === book.id && previous.uid === this.getUser()?.uid && previous.mode === 'preview' && mode !== 'preview'
      ? Math.min(previous.page + 1, book.pageCount) : 1;
    this.close(false);
    const openingGeneration = this.generation;
    const uid = this.getUser()?.uid;
    if (mode !== 'preview') await this.api('/books/' + book.id + '/read');
    if (uid !== this.getUser()?.uid || openingGeneration !== this.generation) return;
    const limit = mode === 'preview' ? book.previewPages : book.pageCount;
    if (!limit) throw Error('No preview pages are available.');
    this.opener = document.activeElement;
    const key = this.key(book, mode, uid);
    let page = continuation; try { const saved = localStorage.getItem(key); if (saved !== null) page = boundedPage(saved, limit); } catch {}
    this.state = { book, mode, uid, limit, page, key };
    this.$('protected-reader-title').textContent = book.title;
    this.$('protected-reader-note').textContent = mode === 'preview' ? 'Free preview · first 10%' : 'Your book · reading position saved on this device';
    this.$('reader-page-number').max = String(limit);
    this.$('reader-page-total').textContent = '/ ' + limit;
    this.root.hidden = false; this.root.dataset.fit = 'page'; this.fit = 'page';
    this.zoom = 100;
    this.$('reader-fit').textContent = 'Fit width';
    this.app.inert = true; document.body.classList.add('reader-is-open');
    this.$('protected-close').focus();
    await this.load(page);
  }
  async load(value) {
    if (!this.state || this.loading) return;
    const current = this.state, page = boundedPage(value, current.limit), generation = ++this.generation;
    this.loading = true; this.retryPage = page;
    this.$('reader-status').textContent = 'Opening page ' + page + '…';
    this.$('reader-retry').hidden = true;
    this.updateControls();
    try {
      const blob = await this.api('/books/' + current.book.id + '/page/' + page, { binary: true });
      if (generation !== this.generation || this.state !== current || this.getUser()?.uid !== current.uid) return;
      const url = URL.createObjectURL(blob), image = new Image(); image.src = url;
      try { await image.decode(); } catch { URL.revokeObjectURL(url); throw Error('This page could not be displayed. Please retry.'); }
      if (generation !== this.generation || this.state !== current || this.getUser()?.uid !== current.uid) { URL.revokeObjectURL(url); return; }
      const old = this.url; this.url = url;
      this.$('protected-pdf').src = url;
      this.$('protected-pdf').alt = `${current.book.title} — page ${page}`;
      if (old) URL.revokeObjectURL(old);
      current.page = page;
      this.$('reader-page-number').value = String(page);
      this.$('reader-canvas').scrollTop = 0;
      this.$('reader-canvas').scrollLeft = 0;
      this.$('reader-status').textContent = '';
      try { localStorage.setItem(current.key, String(page)); } catch {}
      const unlock = this.$('protected-unlock'); unlock.replaceChildren();
      unlock.hidden = !(current.mode === 'preview' && page === current.limit);
      if (!unlock.hidden) {
        const label = document.createElement('span'); label.textContent = 'You’ve reached the end of your free preview.';
        const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Continue to the full book';
        button.onclick = async () => {
          button.disabled = true;
          try { await this.onUnlock(current.book); }
          catch (error) { this.$('reader-status').textContent = error.message; }
          finally { button.disabled = false; }
        }; unlock.append(label, button);
      }
    } catch (error) {
      if (generation !== this.generation || this.state !== current) return;
      this.$('protected-pdf').removeAttribute('src');
      if (this.url) URL.revokeObjectURL(this.url); this.url = null;
      this.$('reader-status').textContent = error.message;
      this.$('reader-retry').hidden = false;
    } finally {
      if (generation === this.generation) { this.loading = false; this.updateControls(); }
    }
  }
  updateControls() {
    if (!this.state) return;
    this.$('reader-prev').disabled = this.loading || this.state.page <= 1;
    this.$('reader-next').disabled = this.loading || this.state.page >= this.state.limit;
    this.$('reader-page-number').disabled = this.loading;
    this.$('reader-go').disabled = this.loading;
  }
  setZoom(percent) {
    this.zoom = percent; this.fit = 'zoom'; this.root.dataset.fit = 'zoom';
    this.root.style.setProperty('--reader-zoom', String(percent / 100));
    this.$('reader-fit').textContent = 'Fit page';
    this.$('reader-fit').title = `Zoom ${percent}% — return to fit page`;
    this.$('reader-status').textContent = '';
  }
  turn(delta) { if (this.state && !this.loading && boundedPage(this.state.page + delta, this.state.limit) !== this.state.page) return this.load(this.state.page + delta); }
  close(restore = true) {
    this.generation++; this.state = null; this.loading = false;
    this.root.hidden = true; this.$('protected-pdf').removeAttribute('src');
    if (this.url) URL.revokeObjectURL(this.url); this.url = null;
    this.app.inert = false; document.body.classList.remove('reader-is-open');
    if (document.fullscreenElement === this.root) document.exitFullscreen().catch(() => {});
    if (restore) { this.onClose?.(); this.opener?.focus?.({ preventScroll: true }); }
  }
}
