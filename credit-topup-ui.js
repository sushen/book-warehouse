import { taka } from './protected-offer.js';
const el = (tag, text = '') => { const n = document.createElement(tag); n.textContent = text; return n; };
export class CreditTopupView {
  constructor({ root, adminRoot, api, action, getUser, onShowRequests }) { Object.assign(this, { root, adminRoot, api, action, getUser, onShowRequests }); this.operation = null; this.generation = 0; }
  reset() { this.generation++; this.operation = null; this.reviewedRequestId = null; this.root.replaceChildren(); this.adminRoot.replaceChildren(); }
  async refresh(signedIn, admin) {
    const generation = ++this.generation, uid = this.getUser?.()?.uid;
    const current = () => generation === this.generation && uid === this.getUser?.()?.uid;
    this.root.replaceChildren(el('h2', 'Buy BW Credits'));
    this.root.append(el('p', 'A simple way to make your next book yours. One BW Credit equals ৳1. Choose how to pay, share the transaction details, and follow your request here.'));
    const steps = el('ol');
    for (const text of ['Choose a method and amount.', 'Enter the transaction ID or the sending bank account before submitting.', 'Wait for Super Admin to verify receipt.', 'Credits are added; return to the catalogue and buy the book.']) steps.append(el('li', text));
    this.root.append(steps);
    this.adminRoot.replaceChildren();
    if (!signedIn) { const note = el('p', 'Your reading journey belongs to you. Sign in with Google above to add credits and follow your requests.'); note.id = 'credit-requests'; this.root.append(note); return; }
    const [methods, requests] = await Promise.all([this.api('/topup-methods'), this.api('/topups')]);
    if (!current()) return;
    const form = el('form'); form.className = 'protected-form credit-compose';
    const methodLabel = el('label', 'Payment method'), select = el('select'); select.name = 'methodId';
    for (const method of methods) {
      const option = el('option', method.label + (method.enabled ? '' : ' — setup pending'));
      option.value = method.id; option.disabled = !method.enabled; select.append(option);
    }
    methodLabel.append(select);
    const recipient = el('p'), amountLabel = el('label', 'Credits to buy / amount in BDT'), amount = el('input');
    amount.type = 'number'; amount.min = '1'; amount.max = '1000000'; amount.step = '1'; amount.required = true; amount.value = '1040'; amountLabel.append(amount);
    const referenceLabel = el('label'), referenceCaption = el('span'), reference = el('input'); reference.minLength = 4; reference.maxLength = 100; referenceLabel.append(referenceCaption, reference);
    const senderLabel = el('label', 'Sending bank account number (required)'), sender = el('input'); sender.minLength = 6; sender.maxLength = 64; senderLabel.append(sender);
    const due = el('p'), update = () => {
      const method = methods.find(m => m.id === select.value);
      const bank = method?.id === 'dutch-bangla';
      referenceCaption.textContent = bank ? 'Bank transfer / receipt reference (if available)' : method?.currency === 'USDT' ? 'USDT transaction hash / TxID (required)' : 'Payment transaction ID (required)';
      reference.required = !bank;
      sender.required = bank; senderLabel.style.display = bank ? 'grid' : 'none';
      recipient.textContent = method ? `${method.label} receiving details: ${method.recipient}` : 'No payment method configured.';
      amount.min = method?.currency === 'USDT' ? String(Math.ceil((method.minimumAmountMinor || 1) * method.bdtPerUsdtMinor / 100000000)) : '1';
      const payment = method?.currency === 'USDT' ? `${(Math.ceil(Number(amount.value) * 100000000 / method.bdtPerUsdtMinor) / 1000000).toFixed(6)} USDT · ${method.network} · fixed rate: 1 USDT = ${taka(method.bdtPerUsdtMinor / 100)}` : taka(Number(amount.value) || 0);
      due.textContent = `Amount due: ${payment} · ${amount.value} BW Credits`;
      this.operation = null;
    };
    select.onchange = update; amount.oninput = update; update();
    const submit = el('button', 'Submit credit purchase request'); submit.className = 'button button-dark'; submit.disabled = !methods.some(m => m.enabled);
    form.append(methodLabel, recipient, amountLabel, due, referenceLabel, senderLabel, submit);
    form.onsubmit = event => { event.preventDefault(); this.action(async () => {
      const payload = { methodId: select.value, credits: Number(amount.value), reference: reference.value, senderAccountNumber: sender.value };
      const existing = requests.find(r => r.methodId === payload.methodId && r.credits === payload.credits && ['awaiting-payment', 'pending-review'].includes(r.status) && (r.status === 'awaiting-payment' || (r.reference || '') === payload.reference.trim().toUpperCase()));
      if (existing) {
        if (existing.status === 'awaiting-payment') await this.api(`/topups/${existing.id}/reference`, { method: 'POST', body: { reference: payload.reference } });
        this.focusRequestId = existing.id; this.onShowRequests?.(); return;
      }
      this.operation ||= crypto.randomUUID();
      const created = await this.api('/topups', { method: 'POST', body: { ...payload, operationId: this.operation } });
      this.focusRequestId = created.id;
      this.onShowRequests?.();
      this.operation = null;
    }); };
    const requestList = el('div'); requestList.className = 'credit-requests'; requestList.id = 'credit-requests';
    requestList.append(el('h3', 'Your credit journey'));
    this.root.append(form, requestList);
    for (const method of methods.filter(m => !m.enabled)) this.root.append(el('p', `${method.label}: ${method.recipient}. This method is not yet available.`));
    if (!requests.length) { const empty = el('p', 'Your next read starts with a little credit. Once you submit a request, its progress will appear here.'); empty.className = 'credit-empty'; requestList.append(empty); }
    for (const request of requests) requestList.append(this.requestCard(request, false));
    if (this.focusRequestId) {
      const selected = document.getElementById('credit-request-' + this.focusRequestId);
      if (selected) { selected.scrollIntoView({ behavior: 'smooth', block: 'center' }); selected.focus({ preventScroll: true }); }
      this.focusRequestId = null;
    }
    if (admin) {
      this.adminRoot.append(el('h3', 'Credit purchase review'));
      const all = await this.api('/admin/topups');
      if (!current()) return;
      const pending = all.filter(r => ['awaiting-payment', 'pending-review'].includes(r.status));
      this.adminRoot.append(el('p', `${pending.length} requests waiting. Check the receiving account independently before approving; references alone are not payment proof.`));
      for (const request of all.filter(r => pending.includes(r) || r.id === this.reviewedRequestId)) this.adminRoot.append(this.requestCard(request, true));
    }
  }
  requestCard(request, admin) {
    const box = el('article'); box.className = 'protected-form credit-request'; box.dataset.state = request.status;
    if (!admin) { box.id = 'credit-request-' + request.id; box.tabIndex = -1; }
    const status = el('span', ({'awaiting-payment':'Payment details needed','pending-review':'Under review','approved':'Credits added','rejected':'Not approved'})[request.status] || request.status); status.className = 'request-status';
    box.append(status, el('h4', `${request.methodLabel} · ${taka(request.credits)} · ${request.credits} credits`), el('p', `Receiving details: ${request.recipient}`));
    box.append(el('p', `Amount due: ${request.currency === 'USDT' ? (request.amountMinor / 1000000).toFixed(6) + ' USDT · ' + request.network : taka(request.credits)}`));
    if (request.reference) box.append(el('p', `Payment reference: ${request.reference}`));
    if (request.senderAccountNumber) box.append(el('p', `Sending bank account: ${request.senderAccountNumber}`));
    if (request.reason) box.append(el('p', `Review note: ${request.reason}`));
    if (admin) box.append(el('p', `Reader: ${request.readerName || 'Reader'} · ${request.readerEmail || ''} · ID: ${request.uid}`));
    if (!admin) {
      const next = request.status === 'awaiting-payment'
        ? 'Next: submit the transaction reference below. This request has not added credits.'
        : request.status === 'pending-review' ? 'Submitted. Waiting for Super Admin to confirm receipt. No new payment or duplicate request is needed.'
        : request.status === 'approved' ? 'Complete. Credits have been added to your balance. You can now return to the catalogue and buy the book.'
        : 'This request was rejected. Read the review note before making another request.';
      box.append(el('strong', next));
      if (request.status === 'approved') { const link = el('a', 'Return to catalogue and buy the book'); link.href = 'index.html#digital-catalogue'; link.className = 'button button-dark'; box.append(link); }
      else { const refresh = el('button', 'Refresh request status'); refresh.type = 'button'; refresh.className = 'button button-outline'; refresh.onclick = () => this.action(async () => { this.focusRequestId = request.id; }); box.append(refresh); }
    }
    if (!admin && request.status === 'awaiting-payment') {
      const form = el('form'), label = el('label', 'Payment transaction reference'), input = el('input');
      input.required = true; input.minLength = 4; input.maxLength = 100; label.append(input);
      const submit = el('button', 'Submit reference for review'); submit.className = 'button button-outline'; form.append(label, submit);
      form.onsubmit = e => { e.preventDefault(); this.action(async () => { await this.api(`/topups/${request.id}/reference`, { method: 'POST', body: { reference: input.value } }); this.focusRequestId = request.id; }); };
      box.append(form);
    }
    if (admin && ['awaiting-payment', 'pending-review'].includes(request.status)) {
      if (request.status === 'pending-review') {
        const form = el('form'), referenceLabel = el('label', 'Verified transaction reference'), reference = el('input');
        reference.required = true; referenceLabel.append(reference);
        const amountLabel = el('label', `Verified amount received (${request.currency || 'BDT'})`), amount = el('input'); amount.type = 'number'; amount.required = true; amount.step = request.currency === 'USDT' ? '0.000001' : '0.01'; amount.min = amount.step; amountLabel.append(amount);
        const checkLabel = el('label', 'I checked the receiving account and confirmed this exact payment.'), check = el('input'); check.type = 'checkbox'; check.required = true; checkLabel.prepend(check);
        const approve = el('button', 'Approve receipt and add credits'); approve.className = 'button button-dark'; form.append(referenceLabel, amountLabel, checkLabel, approve);
        form.onsubmit = e => { e.preventDefault(); this.action(async () => { await this.api(`/admin/topups/${request.id}/review`, { method: 'POST', body: { decision: 'approve', confirmed: check.checked, verifiedReference: reference.value, verifiedAmountMinor: Math.round(Number(amount.value) * (request.minorUnitsPerUnit || 100)) } }); this.reviewedRequestId = request.id; }); };
        box.append(form);
      }
      const reject = el('form'), reasonLabel = el('label', 'Reason for rejection'), reason = el('input'); reason.required = true; reason.minLength = 3; reason.maxLength = 500; reasonLabel.append(reason);
      const button = el('button', 'Reject request'); button.className = 'button button-outline'; reject.append(reasonLabel, button);
      reject.onsubmit = e => { e.preventDefault(); this.action(async () => { await this.api(`/admin/topups/${request.id}/review`, { method: 'POST', body: { decision: 'reject', reason: reason.value } }); this.reviewedRequestId = request.id; }); }; box.append(reject);
    }
    return box;
  }
}
