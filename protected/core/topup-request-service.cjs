"use strict";
const { keyFor, validId, credits, failure } = require('./credit-license-service.cjs');
class TopupRequestService {
  constructor({ repository, ledger, clock, methods = [] }) { Object.assign(this, { repository, ledger, clock, methods }); }
  paymentMethods() { return this.methods.map(method => ({ ...method })); }
  list(uid) { return this.repository.list('protectedTopupRequests', uid ? [['uid', '==', uid]] : []); }
  evidence(methodId, currency, input) {
    const reference = typeof input.reference === 'string' ? input.reference.trim().toUpperCase() : '';
    const senderAccountNumber = typeof input.senderAccountNumber === 'string' ? input.senderAccountNumber.trim() : '';
    if (methodId === 'dutch-bangla') {
      if (!/^[A-Za-z0-9 -]{6,64}$/.test(senderAccountNumber)) failure('sender-account-required');
      if (reference && !/^[A-Z0-9_-]{4,100}$/.test(reference)) failure('invalid-payment-reference');
    } else if (!/^[A-Z0-9_-]{4,100}$/.test(reference)) failure('payment-reference-required');
    if (currency === 'USDT' && !/^0X[A-F0-9]{64}$/.test(reference)) failure('invalid-payment-reference');
    return { reference: reference || null, senderAccountNumber: methodId === 'dutch-bangla' ? senderAccountNumber : null };
  }
  async create(uid, input, identity = {}) {
    const method = this.methods.find(item => item.id === input.methodId && item.enabled);
    if (!validId(uid) || !validId(input.operationId) || !credits(input.credits) || input.credits < 1 || input.credits > 1000000) failure('invalid-input');
    if (!method) failure('payment-method-unavailable');
    const currency = method.currency === 'USDT' ? 'USDT' : 'BDT';
    const evidence = this.evidence(method.id, currency, input);
    if (currency === 'USDT' && (!Number.isSafeInteger(method.bdtPerUsdtMinor) || method.bdtPerUsdtMinor < 1 || !method.network)) failure('payment-method-unavailable');
    const amountMinor = currency === 'USDT'
      ? Math.ceil(input.credits * 100 * 1000000 / method.bdtPerUsdtMinor)
      : input.credits * 100;
    if (!Number.isSafeInteger(amountMinor) || amountMinor < (method.minimumAmountMinor || 1)) failure('payment-method-minimum');
    const id = keyFor('topup', uid, input.operationId), ref = this.repository.ref('protectedTopupRequests', id);
    await this.repository.runTransaction(async tx => {
      const prior = await tx.get(ref);
      if (prior.exists) {
        const data = prior.data();
        if (data.uid !== uid || data.credits !== input.credits || data.methodId !== method.id || data.reference !== evidence.reference || data.senderAccountNumber !== evidence.senderAccountNumber) failure('operation-mismatch');
        return;
      }
      tx.create(ref, { uid, credits: input.credits, amountMinor, currency, minorUnitsPerUnit: currency === 'USDT' ? 1000000 : 100,
        readerName: String(identity.name || '').slice(0,120), readerEmail: String(identity.email || '').slice(0,254),
        ...(currency === 'USDT' ? { bdtPerUsdtMinor: method.bdtPerUsdtMinor, network: method.network } : {}), methodId: method.id,
        methodLabel: method.label, recipient: method.recipient, status: 'pending-review', ...evidence,
        mode: 'local-prototype', createdAt: this.clock(), updatedAt: this.clock() });
    });
    return { id };
  }
  async submitReference(uid, id, reference) {
    const normalized = typeof reference === 'string' ? reference.trim().toUpperCase() : '';
    if (!validId(id) || !/^[A-Z0-9_-]{4,100}$/.test(normalized)) failure('invalid-payment-reference');
    return this.repository.runTransaction(async tx => {
      const ref = this.repository.ref('protectedTopupRequests', id), snapshot = await tx.get(ref);
      if (!snapshot.exists || snapshot.data().uid !== uid) failure('request-not-found');
      const order = snapshot.data();
      if (order.currency === 'USDT' && !/^0X[A-F0-9]{64}$/.test(normalized)) failure('invalid-payment-reference');
      if (order.status === 'pending-review' && order.reference === normalized) return { replayed: true };
      if (order.status !== 'awaiting-payment') failure('request-not-pending');
      tx.update(ref, { reference: normalized, status: 'pending-review', updatedAt: this.clock() });
      return { status: 'pending-review' };
    });
  }
  async review(actor, id, input) {
    if (!validId(id) || !['approve','reject'].includes(input.decision)) failure('invalid-input');
    return this.repository.runTransaction(async tx => {
      await this.ledger.assertAdmin(tx, actor);
      const ref = this.repository.ref('protectedTopupRequests', id), snapshot = await tx.get(ref);
      if (!snapshot.exists) failure('request-not-found');
      const order = snapshot.data();
      if (order.status === 'approved' && input.decision === 'approve') return { replayed: true };
      if (!['awaiting-payment','pending-review'].includes(order.status)) failure('request-not-pending');
      if (input.decision === 'reject') {
        if (typeof input.reason !== 'string' || input.reason.trim().length < 3 || input.reason.length > 500) failure('reason-required');
        tx.update(ref, { status: 'rejected', reason: input.reason.trim(), reviewedBy: actor, reviewedAt: this.clock() });
        return { status: 'rejected' };
      }
      const verifiedReference = typeof input.verifiedReference === 'string' ? input.verifiedReference.trim().toUpperCase() : '';
      if (order.status !== 'pending-review' || input.confirmed !== true || !/^[A-Z0-9_-]{4,100}$/.test(verifiedReference) || (order.reference && verifiedReference !== order.reference) || input.verifiedAmountMinor !== order.amountMinor) failure('payment-verification-required');
      const receipt = this.repository.ref('protectedTopupReceipts', keyFor(order.methodId, verifiedReference)),
        wallet = this.repository.ref('protectedWallets', order.uid),
        [prior, balance] = await Promise.all([tx.get(receipt), tx.get(wallet)]);
      if (prior.exists) failure('payment-reference-already-used');
      const before = balance.exists ? balance.data().balance : 0;
      if (!credits(before) || !credits(before + order.credits)) failure('invalid-balance');
      const at = this.clock();
      tx.create(receipt, { requestId: id, methodId: order.methodId, reference: verifiedReference, reviewedBy: actor, createdAt: at });
      tx.set(wallet, { balance: before + order.credits, unit: 'test-credit', updatedAt: at });
      tx.update(ref, { status: 'approved', verifiedReference, reviewedBy: actor, reviewedAt: at, updatedAt: at });
      tx.create(this.repository.ref('protectedLedger', 'manual_topup_' + id), {
        kind: 'manually-verified-credit-topup', uid: order.uid, amount: order.credits, before, after: before + order.credits,
        currency: order.currency, amountMinor: order.amountMinor, provider: order.methodId, requestId: id, reviewedBy: actor,
        minorUnitsPerUnit: order.minorUnitsPerUnit, mode: 'local-prototype', createdAt: at });
      return { status: 'approved', credited: order.credits, balance: before + order.credits };
    });
  }
}
module.exports = { TopupRequestService };
