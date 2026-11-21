export const MAX_PDF_BYTES = 25 * 1024 * 1024;
export function driveLink(id) {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(id)) throw new Error('Invalid Drive file ID');
  return `https://drive.google.com/file/d/${id}/view`;
}
export async function inspectPdf(file) {
  if (!file || !file.size || file.size > MAX_PDF_BYTES) throw new Error('PDF_SIZE');
  if (!file.name.toLowerCase().endsWith('.pdf') || (file.type && file.type !== 'application/pdf')) throw new Error('PDF_TYPE');
  const bytes = await file.arrayBuffer();
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('PDF_TYPE');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return { size: file.size, sha256: [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('') };
}

// OAuth tokens stay in this instance only, never in storage or Firestore.
export function createDriveBooks(clientId, { fetcher = fetch, xhrFactory = () => new XMLHttpRequest() } = {}) {
  let token = '', expires = 0;
  async function api(path, options = {}) {
    if (!token || Date.now() >= expires) throw new Error('DRIVE_CONNECT');
    const response = await fetcher(`https://www.googleapis.com/drive/v3/${path}`, {
      ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers }
    });
    if (!response.ok) {
      if (response.status === 401) { token = ''; throw new Error('DRIVE_CONNECT'); }
      const error = new Error(`DRIVE_${response.status}`); error.status = response.status; throw error;
    }
    return response.status === 204 ? null : response.json();
  }
  const json = data => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  async function permissions(id) { return (await api(`files/${id}/permissions?fields=permissions(id,type,role)`)).permissions || []; }
  return {
    isConnected() { return !!token && Date.now() < expires; },
    async connect() {
      if (!clientId || !clientId.endsWith('.apps.googleusercontent.com')) throw new Error('DRIVE_CONFIG');
      if (!window.google?.accounts?.oauth2) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client';
          script.onload = resolve; script.onerror = () => reject(new Error('DRIVE_CONNECT')); document.head.append(script);
        });
      }
      await new Promise((resolve, reject) => {
        const client = window.google.accounts.oauth2.initTokenClient({ client_id: clientId,
          scope: 'https://www.googleapis.com/auth/drive.file',
          callback: result => {
            if (result.error || !result.access_token) return reject(new Error('DRIVE_CONNECT'));
            token = result.access_token; expires = Date.now() + Math.max(0, Number(result.expires_in) - 60) * 1000; resolve();
          }, error_callback: () => reject(new Error('DRIVE_CONNECT')) });
        client.requestAccessToken({ prompt: 'select_account' });
      });
    },
    disconnect() { token = ''; expires = 0; },
    async folder() {
      const q = "trashed = false and mimeType = 'application/vnd.google-apps.folder' and 'me' in owners and appProperties has { key='bwRepository' and value='v1' }";
      const result = await api(`files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=100`);
      for (const folder of result.files) {
        const access = await permissions(folder.id);
        if (access.length === 1 && access[0].role === 'owner' && access[0].type === 'user') return folder.id;
      }
      const folder = await api('files?fields=id', json({ name: 'Book Warehouse — private repository',
        mimeType: 'application/vnd.google-apps.folder', appProperties: { bwRepository: 'v1' } }));
      const access = await permissions(folder.id);
      if (access.length !== 1 || access[0].role !== 'owner' || access[0].type !== 'user') throw new Error('DRIVE_PRIVATE');
      return folder.id;
    },
    async reserveId() { return (await api('files/generateIds?count=1&space=drive')).ids[0]; },
    async verifyPrivate(id) {
      const access = await permissions(id);
      if (access.length !== 1 || access[0].role !== 'owner' || access[0].type !== 'user') throw new Error('DRIVE_PRIVATE');
    },
    async upload(record, file, progress) {
      try {
        const old = await api(`files/${record.fileId}?fields=id,size,trashed,appProperties`);
        if (!old.trashed && old.appProperties?.sha256 === record.sha256 && Number(old.size) === file.size) return;
        throw new Error('DRIVE_MISMATCH');
      } catch (error) { if (error.status !== 404) throw error; }
      // A pre-generated ID makes a retried create safe after an uncertain response.
      const response = await fetcher('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
          'X-Upload-Content-Type': 'application/pdf', 'X-Upload-Content-Length': String(file.size) },
        body: JSON.stringify({ id: record.fileId, name: `${record.id}.pdf`, parents: [record.folderId],
          mimeType: 'application/pdf', appProperties: { bwBook: record.id, sha256: record.sha256 } })
      });
      if (!response.ok) throw new Error(`DRIVE_${response.status}`);
      const location = response.headers.get('Location');
      if (!location || new URL(location).origin !== 'https://www.googleapis.com') throw new Error('DRIVE_SESSION');
      await new Promise((resolve, reject) => {
        const xhr = xhrFactory(); xhr.open('PUT', location); xhr.setRequestHeader('Content-Type', 'application/pdf');
        xhr.timeout = 180000;
        xhr.upload.onprogress = e => { if (e.lengthComputable) progress(Math.round(e.loaded / e.total * 100)); };
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`DRIVE_${xhr.status}`));
        xhr.onerror = xhr.ontimeout = () => reject(new Error('DRIVE_RETRY')); xhr.send(file);
      });
    },
    async publish(record) {
      const file = await api(`files/${record.fileId}?fields=id,size,trashed,mimeType,appProperties`);
      if (file.trashed || file.mimeType !== 'application/pdf' || file.appProperties?.sha256 !== record.sha256 || Number(file.size) !== record.size) throw new Error('DRIVE_MISMATCH');
      const before = await permissions(record.fileId);
      if (!before.some(p => p.type === 'anyone' && p.role === 'reader')) {
        await api(`files/${record.fileId}/permissions`, json({ type: 'anyone', role: 'reader' }));
      }
      const after = await permissions(record.fileId);
      if (!after.some(p => p.type === 'anyone' && p.role === 'reader')) throw new Error('DRIVE_SHARING');
      return driveLink(record.fileId);
    }
  };
}
