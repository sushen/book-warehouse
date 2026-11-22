"use strict";
const { failure } = require("./credit-license-service.cjs");
class ReadingService {
  constructor({ publishing, licenses, files, pdf, repository, clock }) {
    Object.assign(this, {
      publishing,
      licenses,
      files,
      pdf,
      repository,
      clock,
    });
  }
  async preview(id) {
    const record = await this.publishing.book(id);
    if (record.status !== "published" || !record.previewPages)
      failure("preview-unavailable");
    return this.files.readPreview(id, record.version);
  }
  async page(id, number, identify) {
    const record = await this.publishing.book(id);
    if (
      record.status !== "published" ||
      !Number.isInteger(number) ||
      number < 1 ||
      number > record.pageCount
    )
      failure("page-unavailable");
    let identity;
    if (number > record.previewPages) {
      identity = await identify();
      await this.licenses.access(identity.uid, id);
    }
    const rendered = await this.pdf.renderPage(
      await this.files.readOriginal(id, record.version),
      number,
    );
    if (identity) {
      await this.licenses.access(identity.uid, id);
      await this.repository.append("protectedAudit", {
        kind: "read-page",
        uid: identity.uid,
        bookId: id,
        version: record.version,
        page: number,
        createdAt: this.clock(),
      });
    }
    return rendered;
  }
  async download(uid, id) {
    const record = await this.licenses.access(uid, id);
    if (!record.downloadAllowed) failure("download-disabled");
    const data = await this.files.readOriginal(id, record.version);
    await this.repository.append("protectedAudit", {
      kind: "download",
      uid,
      bookId: id,
      version: record.version,
      createdAt: this.clock(),
    });
    return data;
  }
}
module.exports = { ReadingService };
