"use strict";
const { createHash } = require("node:crypto");
const { isDeepStrictEqual } = require("node:util");
const { failure, validId, credits } = require("./credit-license-service.cjs");
class PublishingService {
  constructor({ repository, files, pdf, clock, pricing, adminGuard }) {
    Object.assign(this, { repository, files, pdf, clock, pricing, adminGuard });
    this.processing = new Set();
  }
  async book(id) {
    const snapshot = await this.repository.read("protectedBooks", id);
    if (!snapshot.exists) failure("book-unavailable");
    return { id, ...snapshot.data() };
  }
  async assertAdmin(uid, transaction) {
    if (this.adminGuard) return this.adminGuard(uid);
    const grant = transaction
      ? await transaction.get(this.repository.ref("adminGrants", uid))
      : await this.repository.read("adminGrants", uid);
    if (
      !grant.exists ||
      grant.data().status !== "active" ||
      !["admin", "superuser"].includes(grant.data().role || "admin")
    )
      failure("admin-required");
  }
  list(publishedOnly = false) {
    return this.repository.list(
      "protectedBooks",
      publishedOnly ? [["status", "==", "published"]] : [],
    );
  }
  async createDraft(actorUid, input) {
    if (
      ![input.title, input.author, input.ownershipClaim].every(
        (v) => typeof v === "string" && v.trim() && v.length <= 2000,
      ) ||
      !credits(input.priceCredits) ||
      input.priceCredits < 1 ||
      !validId(input.operationId)
    )
      failure("invalid-input");
    const metadata = {
      title: input.title.trim().slice(0, 120),
      author: input.author.trim().slice(0, 120),
      ownershipClaim: input.ownershipClaim.trim(),
      priceCredits: input.priceCredits,
    };
    if (input.priceReference) {
      if (
        input.priceReference.asset !== "USDT" ||
        this.pricing.creditsFromReference(input.priceReference) !==
          input.priceCredits
      )
        failure("invalid-price-reference");
      metadata.priceReference = {
        asset: "USDT",
        amountMicros: input.priceReference.amountMicros,
        bdtPerUnitMinor: input.priceReference.bdtPerUnitMinor,
        indicativeOnly: true,
      };
    }
    const id = createHash("sha256")
      .update(JSON.stringify([actorUid, input.operationId]))
      .digest("hex");
    await this.repository.runTransaction(async (tx) => {
      await this.assertAdmin(actorUid, tx);
      const ref = this.repository.ref("protectedBooks", id),
        old = await tx.get(ref);
      if (old.exists) {
        for (const field of Object.keys(metadata))
          if (!isDeepStrictEqual(old.data()[field], metadata[field]))
            failure("operation-mismatch");
        return;
      }
      tx.create(ref, {
        ...metadata,
        previewPercent: 10,
        status: "draft",
        downloadAllowed: true,
        createdAt: this.clock(),
        updatedAt: this.clock(),
      });
    });
    return { id };
  }
  async setPolicy(actorUid, id, input) {
    if (
      !credits(input.priceCredits) ||
      input.priceCredits < 1 ||
      typeof input.downloadAllowed !== "boolean" ||
      !["published", "withdrawn"].includes(input.status)
    )
      failure("invalid-input");
    await this.repository.runTransaction(async (tx) => {
      await this.assertAdmin(actorUid, tx);
      const ref = this.repository.ref("protectedBooks", id),
        old = await tx.get(ref);
      if (!old.exists || !old.data().version) failure("file-required");
      const changes = {
        priceCredits: input.priceCredits,
        downloadAllowed: input.downloadAllowed,
        status: input.status,
        updatedAt: this.clock(),
      };
      if (input.status === "published" && !old.data().publishedAt)
        changes.publishedAt = this.clock();
      if (
        old.data().priceReference &&
        input.priceCredits !== old.data().priceCredits
      )
        changes.priceReference = null;
      tx.update(ref, changes);
      tx.create(this.repository.ref("protectedAudit"), {
        kind: "book-policy",
        actorUid,
        bookId: id,
        priceCredits: input.priceCredits,
        status: input.status,
        createdAt: this.clock(),
      });
    });
    return { saved: true };
  }
  async upload(id, source, actorUid) {
    if (this.processing.has(id)) failure("upload-busy");
    this.processing.add(id);
    try {
      await this.assertAdmin(actorUid);
      const record = await this.book(id);
      if (record.status !== "draft") failure("book-not-draft");
      if (source.subarray(0, 5).toString() !== "%PDF-") failure("invalid-pdf");
      const version = createHash("sha256").update(source).digest("hex"),
        { info, preview } = await this.pdf.createPreview(
          source,
          record.previewPercent,
        );
      await this.files.writeOriginal(id, version, source);
      if (preview) await this.files.writePreview(id, version, preview);
      await this.repository.runTransaction(async (transaction) => {
        await this.assertAdmin(actorUid, transaction);
        const ref = this.repository.ref("protectedBooks", id),
          current = await transaction.get(ref);
        if (!current.exists || current.data().status !== "draft")
          failure("book-not-draft");
        transaction.update(ref, {
          ...info,
          version,
          sha256: version,
          status: "ready",
          uploadedBy: actorUid,
          updatedAt: this.clock(),
        });
        transaction.create(
          this.repository.ref("protectedEvidence", `${id}_${version}`),
          {
            bookId: id,
            version,
            sha256: version,
            pageCount: info.pageCount,
            ownershipClaim: record.ownershipClaim,
            claimantUid: actorUid,
            recordedAt: this.clock(),
            kind: "unverified-ownership-claim",
          },
        );
      });
      return info;
    } finally {
      this.processing.delete(id);
    }
  }
}
module.exports = { PublishingService };
