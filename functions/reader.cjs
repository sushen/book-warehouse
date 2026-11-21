'use strict';

async function ensureReader(db, uid, displayName) {
  const ref = db.collection('accounts').doc(uid);
  return db.runTransaction(async transaction => {
    const current = await transaction.get(ref);
    if (current.exists) return { created: false };
    transaction.create(ref, {
      displayName: typeof displayName === 'string' ? displayName.slice(0, 120) : '',
      status: 'active', createdAt: require('firebase-admin/firestore').FieldValue.serverTimestamp(),
      updatedAt: require('firebase-admin/firestore').FieldValue.serverTimestamp()
    });
    return { created: true };
  });
}

module.exports = { ensureReader };
