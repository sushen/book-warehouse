"use strict";
const PROJECT = 'book-warehouse-staging-261115';
/** Runtime separation: real Firestore is the application default; emulators are explicit tests. */
function firestoreHost(env) {
  const mode = env.BW_PROTECTED_DATABASE || 'firebase';
  if (mode === 'firebase') {
    if (env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_AUTH_EMULATOR_HOST)
      throw Error('Firebase mode refuses emulator settings. Clear emulator variables before starting.');
    if (env.GCLOUD_PROJECT && env.GCLOUD_PROJECT !== PROJECT)
      throw Error('Unexpected Firebase project. Use the existing Book Warehouse Staging project.');
    return { mode, projectId: PROJECT, authMode: 'google' };
  }
  if (mode !== 'emulator' || env.GCLOUD_PROJECT !== 'demo-book-warehouse' || env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080')
    throw Error('Tests require explicit emulator mode, demo project and loopback Firestore.');
  const authMode = env.BW_PROTECTED_AUTH_MODE || 'google';
  if (!['google','emulator'].includes(authMode) || authMode === 'emulator' && env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099')
    throw Error('Invalid test authentication setup.');
  return { mode, projectId: 'demo-book-warehouse', authMode };
}
module.exports = { firestoreHost, PROJECT };
