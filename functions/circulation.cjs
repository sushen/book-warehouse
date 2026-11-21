'use strict';
const { createHash } = require('node:crypto');

const COMMANDS = new Set(['requestCopy', 'cancelRequest', 'markReady', 'checkOut', 'markReturned']);
const ID = /^[A-Za-z0-9_-]{1,128}$/;

function failure(code) { return { ok: false, code }; }
function commandInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      !Object.keys(input).every(key => ['kind', 'targetId', 'operationId', 'reason', 'whatsapp'].includes(key)) ||
      !COMMANDS.has(input.kind) || !ID.test(input.targetId || '') ||
      !ID.test(input.operationId || '') ||
      (input.reason !== undefined && (input.kind !== 'cancelRequest' || typeof input.reason !== 'string' ||
        input.reason.trim().length < 1 || input.reason.length > 200)) ||
      (input.whatsapp !== undefined && (input.kind !== 'requestCopy' || typeof input.whatsapp !== 'string' ||
        !/^\+[1-9][0-9]{7,14}$/.test(input.whatsapp)))) return null;
  return { kind: input.kind, targetId: input.targetId, operationId: input.operationId,
    ...(input.reason === undefined ? {} : { reason: input.reason.trim() }),
    ...(input.whatsapp === undefined ? {} : { whatsapp: input.whatsapp }) };
}

function createCirculation(db, timestamp) {
  async function execute(uid, input) {
    const command = commandInput(input);
    if (!uid || !command) return failure('invalidInput');
    const { kind, targetId, operationId, reason, whatsapp } = command;
    const receiptRef = db.collection('operations').doc(`${uid.length}_${uid}_${operationId}`);
    const requestRef = kind === 'requestCopy' ? db.collection('requests').doc() : db.collection('requests').doc(targetId);
    const fingerprint = createHash('sha256').update(JSON.stringify({ kind, targetId, reason: reason || null, whatsapp: whatsapp || null })).digest('hex');

    return db.runTransaction(async tx => {
      const receipt = await tx.get(receiptRef);
      const grant = await tx.get(db.collection('adminGrants').doc(uid));
      if (grant.exists && grant.data().status === 'active' && grant.data().role === 'superuser') return failure('permissionDenied');
      if (receipt.exists) {
        return receipt.data().fingerprint === fingerprint ? receipt.data().result : failure('operationMismatch');
      }
      const finish = result => {
        tx.create(receiptRef, { uid, kind, targetId, fingerprint, result, createdAt: timestamp() });
        return result;
      };

      const requestSnap = kind === 'requestCopy' ? null : await tx.get(requestRef);
      if (requestSnap && !requestSnap.exists) return finish(failure('requestMissing'));
      const request = requestSnap && requestSnap.data();
      const copyRef = db.collection('copies').doc(kind === 'requestCopy' ? targetId : request.copyId);
      const copySnap = await tx.get(copyRef);
      if (!copySnap.exists) return finish(failure('copyUnavailable'));
      const copy = copySnap.data();
      if (request && (request.copyId !== copyRef.id || request.libraryId !== copy.libraryId)) return finish(failure('conflict'));

      if (kind === 'requestCopy') {
        if (copy.visibility !== 'public' || copy.availability !== 'available' || copy.activeRequestId !== null) return finish(failure('copyUnavailable'));
      } else if (copy.activeRequestId !== targetId) {
        return finish(failure('conflict'));
      }

      const operatorCommand = kind === 'markReady' || kind === 'checkOut' || kind === 'markReturned';
      if (operatorCommand) {
        const member = await tx.get(db.collection('memberships').doc(`${copy.libraryId}_${uid}`));
        if (!member.exists || member.data().uid !== uid || member.data().libraryId !== copy.libraryId ||
            member.data().role !== 'operator' || member.data().status !== 'active') return finish(failure('permissionDenied'));
      } else if (request && request.readerUid !== uid) {
        if (kind !== 'cancelRequest') return finish(failure('permissionDenied'));
        const member = await tx.get(db.collection('memberships').doc(`${copy.libraryId}_${uid}`));
        if (!member.exists || member.data().uid !== uid || member.data().libraryId !== copy.libraryId ||
            member.data().role !== 'operator' || member.data().status !== 'active') return finish(failure('permissionDenied'));
        if (!reason) return finish(failure('invalidInput'));
      }

      let loanRef;
      let loan;
      if (kind === 'checkOut' || kind === 'markReturned') {
        loanRef = db.collection('loans').doc(targetId);
        loan = await tx.get(loanRef);
      }
      const at = timestamp();
      let result;
      if (kind === 'requestCopy') {
        tx.create(requestRef, { readerUid: uid, copyId: targetId, libraryId: copy.libraryId,
          state: 'requested', operationId, createdAt: at, updatedAt: at, version: 1 });
        if (whatsapp) tx.create(db.collection('requestContacts').doc(requestRef.id),
          { readerUid: uid, libraryId: copy.libraryId, whatsapp });
        tx.update(copyRef, { availability: 'held', activeRequestId: requestRef.id, updatedAt: at, version: copy.version + 1 });
        result = { ok: true, code: 'requestCreated', requestId: requestRef.id };
      } else if (kind === 'cancelRequest' && ['requested', 'ready'].includes(request.state) && ['held', 'ready'].includes(copy.availability)) {
        tx.update(requestRef, { state: 'cancelled', cancelledAt: at, updatedAt: at, version: request.version + 1,
          ...(reason ? { cancellationReason: reason } : {}) });
        tx.update(copyRef, { availability: 'available', activeRequestId: null, updatedAt: at, version: copy.version + 1 });
        result = { ok: true, code: 'stageChanged', stage: 'cancelled', requestId: targetId };
      } else if (kind === 'markReady' && request.state === 'requested' && copy.availability === 'held') {
        tx.update(requestRef, { state: 'ready', readyAt: at, updatedAt: at, version: request.version + 1 });
        tx.update(copyRef, { availability: 'ready', updatedAt: at, version: copy.version + 1 });
        result = { ok: true, code: 'stageChanged', stage: 'ready', requestId: targetId };
      } else if (kind === 'checkOut' && request.state === 'ready' && copy.availability === 'ready' && !loan.exists) {
        tx.update(requestRef, { state: 'borrowed', borrowedAt: at, updatedAt: at, version: request.version + 1 });
        tx.update(copyRef, { availability: 'onLoan', updatedAt: at, version: copy.version + 1 });
        tx.create(loanRef, { requestId: targetId, readerUid: request.readerUid, copyId: copyRef.id,
          libraryId: copy.libraryId, checkedOutAt: at, state: 'open' });
        result = { ok: true, code: 'stageChanged', stage: 'borrowed', requestId: targetId };
      } else if (kind === 'markReturned' && request.state === 'borrowed' && copy.availability === 'onLoan' &&
                 loan.exists && loan.data().state === 'open' && loan.data().copyId === copyRef.id && loan.data().requestId === targetId) {
        tx.update(requestRef, { state: 'returned', returnedAt: at, updatedAt: at, version: request.version + 1 });
        tx.update(copyRef, { availability: 'available', activeRequestId: null, updatedAt: at, version: copy.version + 1 });
        tx.update(loanRef, { state: 'closed', returnedAt: at });
        result = { ok: true, code: 'stageChanged', stage: 'returned', requestId: targetId };
      } else {
        return finish(failure('stageInvalid'));
      }
      return finish(result);
    });
  }
  return { execute };
}

module.exports = { createCirculation, commandInput };
