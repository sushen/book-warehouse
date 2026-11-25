'use strict';
if (process.env.GCLOUD_PROJECT !== 'demo-book-warehouse' ||
    !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Seed requires GCLOUD_PROJECT=demo-book-warehouse and local Auth/Firestore emulator hosts.');
}
if (!process.env.BW_EMULATOR_PASSWORD) throw new Error('Set BW_EMULATOR_PASSWORD for fictional local test accounts.');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
initializeApp({ projectId: 'demo-book-warehouse' });

async function main() {
  const auth = getAuth();
  const db = getFirestore();
  const users = [
    ['fictional-reader', 'reader@example.invalid'],
    ['fictional-operator', 'operator@example.invalid'],
    ['fictional-outsider', 'outsider@example.invalid'],
    ['fictional-superuser', 'superuser@example.invalid']
  ];
  for (const [uid, email] of users) {
    try { await auth.createUser({ uid, email, displayName: uid, password: process.env.BW_EMULATOR_PASSWORD, emailVerified: true }); }
    catch (error) { if (error.code !== 'auth/uid-already-exists') throw error; }
  }
  const at = Timestamp.now();
  const batch = db.batch();
  const records = [
    ['libraries/fictional-lib', { name: { bn: 'কাল্পনিক পাঠাগার', en: 'Fictional Library' }, area: { bn: 'নমুনা এলাকা', en: 'Sample Area' }, status: 'active', visibility: 'public', createdAt: at, updatedAt: at }],
    ['libraries/other-lib', { name: { bn: 'অন্য নমুনা পাঠাগার', en: 'Other Sample Library' }, area: { bn: 'অন্য এলাকা', en: 'Other Area' }, status: 'active', visibility: 'public', createdAt: at, updatedAt: at }],
    ['works/fictional-work', { title: { bn: 'নদীর গল্প', en: 'River Stories' }, authorDisplay: { bn: 'কাল্পনিক লেখক', en: 'Fictional Author' }, topics: { bn: ['নদী', 'গল্প'], en: ['river', 'stories'] }, visibility: 'public', createdAt: at, updatedAt: at }],
    ['editions/fictional-edition', { workId: 'fictional-work', languageCode: 'bn', format: 'print', visibility: 'public', createdAt: at, updatedAt: at }],
    ['copies/fictional-copy-1', { editionId: 'fictional-edition', libraryId: 'fictional-lib', visibility: 'public', availability: 'available', activeRequestId: null, version: 0, createdAt: at, updatedAt: at }],
    ['copies/fictional-copy-2', { editionId: 'fictional-edition', libraryId: 'other-lib', visibility: 'public', availability: 'available', activeRequestId: null, version: 0, createdAt: at, updatedAt: at }],
    ['memberships/fictional-lib_fictional-operator', { uid: 'fictional-operator', libraryId: 'fictional-lib', role: 'operator', status: 'active', grantedBy: 'emulator-seed', grantedAt: at, revokedAt: null }],
    ['adminGrants/fictional-superuser', { uid: 'fictional-superuser', role: 'superuser', status: 'active', grantedBy: 'emulator-seed', grantedAt: at, revokedAt: null }]
  ];
  for (const [path, data] of records) batch.set(db.doc(path), data);
  await batch.commit();
  console.log('Fictional emulator catalogue and four Auth accounts seeded.');
}
main().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
