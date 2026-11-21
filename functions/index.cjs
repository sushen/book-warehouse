'use strict';
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { createCirculation } = require('./circulation.cjs');
const { ensureReader } = require('./reader.cjs');

initializeApp();
const service = createCirculation(getFirestore(), () => FieldValue.serverTimestamp());
exports.circulation = onCall({ cors: true }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  try { return await service.execute(request.auth.uid, request.data); }
  catch (error) {
    console.error('Circulation transaction failed:', error.code || error.name || 'unknown');
    throw new HttpsError('unavailable', 'Transaction outcome must be checked before retrying.');
  }
});
exports.ensureReader = onCall({ cors: true }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  return ensureReader(getFirestore(), request.auth.uid, request.auth.token.name);
});
