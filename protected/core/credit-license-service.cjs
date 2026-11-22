"use strict";
const { createHash } = require("node:crypto");
const keyFor = (...parts) =>
  createHash("sha256").update(JSON.stringify(parts)).digest("hex");
const validId = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const credits = (value) =>
  Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000;
function failure(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}
class CreditLicenseService {
  constructor(repository, clock, adminGuard) {
    if (
      !repository?.runTransaction ||
      !repository?.ref ||
      !repository?.read ||
      typeof clock !== "function"
    )
      throw new TypeError("Repository and clock ports are required");
    this.repository = repository;
    this.clock = clock;
    this.adminGuard = adminGuard;
  }
  async assertAdmin(transaction, uid) {
    if (this.adminGuard) return this.adminGuard(uid);
    const grant = await transaction.get(
      this.repository.ref("adminGrants", uid),
    );
    if (
      !grant.exists ||
      grant.data().status !== "active" ||
      !["admin", "superuser"].includes(grant.data().role || "admin")
    )
      failure("admin-required");
  }
  // Only a trusted, provider-specific verification adapter may call this.
  // The browser cannot mark an intent paid or choose its credit quantity.
  async applyVerifiedPayment(event) {
    if (
      !validId(event.id) ||
      !validId(event.intentId) ||
      event.status !== "succeeded" ||
      !Number.isSafeInteger(event.amountMinor) ||
      event.amountMinor < 1 ||
      typeof event.provider !== "string" ||
      !event.provider.trim() ||
      event.provider.length > 100 ||
      typeof event.paymentId !== "string" ||
      !event.paymentId.trim() ||
      event.paymentId.length > 256 ||
      typeof event.currency !== "string" ||
      !/^[A-Z]{3,8}$/.test(event.currency)
    )
      failure("invalid-payment");
    return this.repository.runTransaction(async (tx) => {
      const intentRef = this.repository.ref(
          "protectedPaymentIntents",
          event.intentId,
        ),
        eventRef = this.repository.ref("protectedPaymentEvents", event.id);
      const [intent, prior] = await Promise.all([
        tx.get(intentRef),
        tx.get(eventRef),
      ]);
      if (!intent.exists) failure("intent-missing");
      const order = intent.data();
      if (
        !validId(order.uid) ||
        !credits(order.credits) ||
        order.credits < 1 ||
        event.provider !== order.provider ||
        event.paymentId !== order.paymentId ||
        event.amountMinor !== order.amountMinor ||
        event.currency !== order.currency
      )
        failure("payment-mismatch");
      const wallet = this.repository.ref("protectedWallets", order.uid),
        balance = await tx.get(wallet);
      if (prior.exists) {
        if (prior.data().intentId !== event.intentId) failure("event-mismatch");
        return { replayed: true };
      }
      if (order.status === "paid") {
        tx.create(eventRef, {
          intentId: event.intentId,
          duplicate: true,
          createdAt: this.clock(),
        });
        return { replayed: true };
      }
      if (order.status !== "pending") failure("intent-not-pending");
      const before = balance.exists ? balance.data().balance : 0;
      if (!credits(before) || !credits(before + order.credits))
        failure("invalid-balance");
      const at = this.clock();
      tx.set(wallet, {
        balance: before + order.credits,
        unit: "test-credit",
        updatedAt: at,
      });
      tx.update(intentRef, { status: "paid", paidAt: at });
      tx.create(eventRef, { intentId: event.intentId, createdAt: at });
      tx.create(
        this.repository.ref("protectedLedger", "payment_" + event.intentId),
        {
          kind: "verified-credit-topup",
          uid: order.uid,
          amount: order.credits,
          before,
          after: before + order.credits,
          currency: order.currency,
          amountMinor: order.amountMinor,
          provider: order.provider,
          intentId: event.intentId,
          createdAt: at,
        },
      );
      return { credited: order.credits, balance: before + order.credits };
    });
  }
  async grant(actor, uid, amount, operationId) {
    if (
      !validId(actor) ||
      !validId(uid) ||
      !validId(operationId) ||
      !credits(amount) ||
      amount < 1
    )
      failure("invalid-input");
    const operation = this.repository.ref(
        "protectedLedger",
        keyFor("grant", actor, operationId),
      ),
      wallet = this.repository.ref("protectedWallets", uid);
    return this.repository.runTransaction(async (tx) => {
      await this.assertAdmin(tx, actor);
      const [old, balance] = await Promise.all([
        tx.get(operation),
        tx.get(wallet),
      ]);
      if (old.exists) {
        if (old.data().uid !== uid || old.data().amount !== amount)
          failure("operation-mismatch");
        return { replayed: true };
      }
      const before = balance.exists ? balance.data().balance : 0;
      if (!credits(before) || !credits(before + amount))
        failure("invalid-balance");
      const at = this.clock();
      tx.set(wallet, {
        balance: before + amount,
        unit: "test-credit",
        updatedAt: at,
      });
      tx.create(operation, {
        kind: "test-credit-grant",
        actorUid: actor,
        uid,
        amount,
        before,
        after: before + amount,
        createdAt: at,
      });
      return { balance: before + amount };
    });
  }
  async purchase(uid, bookId, operationId, expectedVersion, expectedPrice) {
    if (!validId(uid) || !validId(bookId) || !validId(operationId))
      failure("invalid-input");
    return this.repository.runTransaction(async (tx) => {
      const book = await tx.get(this.repository.ref("protectedBooks", bookId));
      if (!book.exists || book.data().status !== "published")
        failure("book-unavailable");
      const item = book.data();
      if (
        item.version !== expectedVersion ||
        item.priceCredits !== expectedPrice
      )
        failure("offer-changed");
      if (
        !validId(item.version) ||
        !credits(item.priceCredits) ||
        item.priceCredits < 1
      )
        failure("invalid-price");
      const license = this.repository.ref(
          "protectedLicenses",
          keyFor(uid, bookId, item.version),
        ),
        wallet = this.repository.ref("protectedWallets", uid),
        operation = this.repository.ref(
          "protectedLedger",
          keyFor("buy", uid, operationId),
        );
      const [prior, balance, old] = await Promise.all([
        tx.get(license),
        tx.get(wallet),
        tx.get(operation),
      ]);
      if (
        old.exists &&
        (old.data().bookId !== bookId || old.data().version !== item.version)
      )
        failure("operation-mismatch");
      if (prior.exists) {
        if (prior.data().status !== "active") failure("license-revoked");
        return { licensed: true, charged: 0, replayed: true };
      }
      if (old.exists) failure("inconsistent-purchase");
      const before = balance.exists ? balance.data().balance : 0;
      if (!credits(before)) failure("invalid-balance");
      if (before < item.priceCredits) failure("insufficient-credits");
      const at = this.clock();
      tx.set(wallet, {
        balance: before - item.priceCredits,
        unit: "test-credit",
        updatedAt: at,
      });
      tx.create(license, {
        uid,
        bookId,
        version: item.version,
        sha256: item.sha256,
        status: "active",
        createdAt: at,
        revokedAt: null,
      });
      tx.create(operation, {
        kind: "book-access",
        uid,
        bookId,
        version: item.version,
        amount: -item.priceCredits,
        before,
        after: before - item.priceCredits,
        createdAt: at,
      });
      return {
        licensed: true,
        charged: item.priceCredits,
        balance: before - item.priceCredits,
      };
    });
  }
  async access(uid, bookId) {
    const book = await this.repository.read("protectedBooks", bookId);
    if (!book.exists || book.data().status !== "published")
      failure("book-unavailable");
    const item = book.data();
    const license = await this.repository.read(
      "protectedLicenses",
      keyFor(uid, bookId, item.version),
    );
    if (
      !license.exists ||
      license.data().status !== "active" ||
      license.data().sha256 !== item.sha256
    )
      failure("license-required");
    return item;
  }
  async revoke(actor, uid, bookId, version, reason) {
    if (
      ![actor, uid, bookId, version].every(validId) ||
      typeof reason !== "string" ||
      reason.trim().length < 3 ||
      reason.length > 500
    )
      failure("invalid-input");
    return this.repository.runTransaction(async (tx) => {
      await this.assertAdmin(tx, actor);
      const license = this.repository.ref(
          "protectedLicenses",
          keyFor(uid, bookId, version),
        ),
        snapshot = await tx.get(license);
      if (!snapshot.exists) failure("license-missing");
      if (snapshot.data().status === "revoked") return { replayed: true };
      const at = this.clock();
      tx.update(license, {
        status: "revoked",
        revokedAt: at,
        revokedBy: actor,
        reason: reason.trim(),
      });
      tx.create(this.repository.ref("protectedAudit"), {
        kind: "license-revoked",
        actorUid: actor,
        uid,
        bookId,
        version,
        reason: reason.trim(),
        createdAt: at,
      });
      return { revoked: true };
    });
  }
}
module.exports = { CreditLicenseService, validId, credits, failure, keyFor };
