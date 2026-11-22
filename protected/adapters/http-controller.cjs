"use strict";
const { validId, failure } = require("../core/credit-license-service.cjs");
const publicBook = (d) =>
  Object.fromEntries(
    [
      "id",
      "title",
      "author",
      "version",
      "status",
      "priceCredits",
      "pageCount",
      "previewPages",
      "previewPercent",
      "sha256",
      "downloadAllowed",
      "publishedAt",
      "priceReference",
    ]
      .filter((k) => d[k] !== undefined)
      .map((k) => [k, d[k]]),
  );
async function read(req, max = 65536) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max) failure("body-too-large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}
class ProtectedBooksHttpController {
  constructor({
    publishing,
    reading,
    credits,
    reports,
    identity,
    origins,
    maxUpload = 25 * 1024 * 1024,
    topups,
  }) {
    Object.assign(this, {
      publishing,
      reading,
      credits,
      reports,
      identity,
      origins,
      maxUpload,
      topups,
    });
  }
  async handle(req, res) {
    const {
      publishing,
      reading,
      credits: ledger,
      reports,
      identity,
      origins,
      topups,
    } = this;
    const user = (req) => identity.identify(req.headers.authorization),
      admin = (req) => identity.requireAdmin(req.headers.authorization);
    const book = (id) => publishing.book(id),
      upload = (id, data, uid) => publishing.upload(id, data, uid);
    const MAX = this.maxUpload;
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    const origin = req.headers.origin;
    if (origin && !origins.has(origin))
      return json(res, 403, { error: "origin-denied" });
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type",
      );
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }
    const url = new URL(req.url, "http://127.0.0.1"),
      parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] !== "api") return json(res, 404, { error: "not-found" });
    try {
      if (req.method === "GET" && url.pathname === "/api/info")
        return json(res, 200, {
          mode: "local-prototype",
          authentication: identity.authentication || "emulator",
          unit: "test-credit",
          bdtPerCredit: 1,
          realPaymentsEnabled: false,
        });
      if (req.method === "GET" && url.pathname === "/api/books") {
        return json(res, 200, (await publishing.list(true)).map(publicBook));
      }
      if (req.method === "GET" && url.pathname === "/api/me") {
        const identity = await user(req);
        return json(res, 200, await reports.wallet(identity.uid));
      }
      if (parts[1] === 'topup-methods' && req.method === 'GET') {
        await user(req);
        return json(res, 200, topups.paymentMethods());
      }
      if (parts[1] === 'topups') {
        const actor = await user(req);
        if (req.method === 'GET' && !parts[2]) return json(res, 200, await topups.list(actor.uid));
        if (req.method === 'POST' && !parts[2]) return json(res, 201, await topups.create(actor.uid, JSON.parse((await read(req)).toString()), actor));
        if (req.method === 'POST' && parts[3] === 'reference') {
          const input = JSON.parse((await read(req)).toString());
          return json(res, 200, await topups.submitReference(actor.uid, parts[2], input.reference));
        }
      }
      if (parts[1] === "books" && validId(parts[2])) {
        const id = parts[2];
        if (req.method === "GET" && parts[3] === "preview") {
          const record = await book(id);
          if (record.status !== "published" || !record.previewPages)
            failure("preview-unavailable");
          const data = await reading.preview(id);
          res.writeHead(200, {
            "Content-Type": "application/pdf",
            "Content-Disposition": 'inline; filename="preview.pdf"',
          });
          return res.end(data);
        }
        if (req.method === "POST" && parts[3] === "purchase") {
          const identity = await user(req),
            input = JSON.parse((await read(req)).toString());
          return json(
            res,
            200,
            await ledger.purchase(
              identity.uid,
              id,
              input.operationId,
              input.version,
              input.priceCredits,
            ),
          );
        }
        if (req.method === "GET" && parts[3] === "license") {
          const identity = await user(req);
          try {
            await ledger.access(identity.uid, id);
            return json(res, 200, { licensed: true });
          } catch (error) {
            if (error.code === "license-required")
              return json(res, 200, { licensed: false });
            throw error;
          }
        }
        if (req.method === "GET" && parts[3] === "page") {
          const data = await reading.page(id, Number(parts[4]), () =>
            user(req),
          );
          res.writeHead(200, { "Content-Type": "image/png" });
          return res.end(data);
        }
        if (req.method === "GET" && ["read", "download"].includes(parts[3])) {
          const identity = await user(req),
            record = await ledger.access(identity.uid, id);
          if (parts[3] === "read")
            return json(res, 200, {
              licensed: true,
              pageCount: record.pageCount,
            });
          if (parts[3] === "download" && !record.downloadAllowed)
            failure("download-disabled");
          const data = await reading.download(identity.uid, id);
          res.writeHead(200, {
            "Content-Type": "application/pdf",
            "Content-Disposition": `${parts[3] === "download" ? "attachment" : "inline"}; filename="licensed-book.pdf"`,
          });
          return res.end(data);
        }
      }
      if (parts[1] === "admin") {
        const identity = await admin(req);
        if (req.method === 'GET' && parts[2] === 'topups') return json(res, 200, await topups.list());
        if (req.method === 'POST' && parts[2] === 'topups' && parts[4] === 'review')
          return json(res, 200, await topups.review(identity.uid, parts[3], JSON.parse((await read(req)).toString())));
        if (req.method === "GET" && parts[2] === "books")
          return json(res, 200, (await publishing.list()).map(publicBook));
        if (req.method === "POST" && parts[2] === "books" && !parts[3])
          return json(
            res,
            201,
            await publishing.createDraft(
              identity.uid,
              JSON.parse((await read(req)).toString()),
            ),
          );
        if (validId(parts[3]) && parts[2] === "books") {
          const id = parts[3];
          if (req.method === "PUT" && parts[4] === "file")
            return json(
              res,
              200,
              await upload(id, await read(req, MAX), identity.uid),
            );
          if (req.method === "POST" && parts[4] === "policy")
            return json(
              res,
              200,
              await publishing.setPolicy(
                identity.uid,
                id,
                JSON.parse((await read(req)).toString()),
              ),
            );
        }
        if (req.method === "POST" && parts[2] === "grant") {
          const input = JSON.parse((await read(req)).toString());
          return json(
            res,
            200,
            await ledger.grant(
              identity.uid,
              input.uid,
              input.amount,
              input.operationId,
            ),
          );
        }
        if (req.method === "POST" && parts[2] === "revoke") {
          const input = JSON.parse((await read(req)).toString());
          return json(
            res,
            200,
            await ledger.revoke(
              identity.uid,
              input.uid,
              input.bookId,
              input.version,
              input.reason,
            ),
          );
        }
        if (req.method === "GET" && parts[2] === "report")
          return json(res, 200, await reports.report());
      }
      return json(res, 404, { error: "not-found" });
    } catch (error) {
      const code = error.code || "request-failed";
      const status =
        code === "sign-in-required" || String(code).startsWith("auth/")
          ? 401
          : [
                "admin-required",
                "license-required",
                "license-revoked",
                "download-disabled",
              ].includes(code)
            ? 403
            : code === "body-too-large"
              ? 413
              : 400;
      return json(res, status, {
        error: typeof code === "string" ? code : "request-failed",
      });
    }
  }
}
module.exports = { ProtectedBooksHttpController };
