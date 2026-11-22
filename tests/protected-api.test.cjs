const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
if (process.env.BW_TEST_PROTECTED_API !== "local-only")
  throw new Error("Explicit local protected API test scope required");
const base = "http://127.0.0.1:8787/api";
async function token(email) {
  const response = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: "FictionalOnly123!",
        returnSecureToken: true,
      }),
    },
  );
  const data = await response.json();
  if (!response.ok) throw new Error("Emulator sign-in failed");
  return data.idToken;
}
async function newReader() {
  const response = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "fictional-api-" + randomUUID() + "@example.invalid",
        password: "FictionalOnly123!",
        returnSecureToken: true,
      }),
    },
  );
  const data = await response.json();
  if (!response.ok) throw new Error("Emulator signup failed");
  return { token: data.idToken, uid: data.localId };
}
async function api(route, auth, body, method = "GET", raw = false) {
  const headers = {};
  if (auth) headers.Authorization = "Bearer " + auth;
  if (body)
    headers["Content-Type"] = raw ? "application/pdf" : "application/json";
  return fetch(base + route, {
    method,
    headers,
    body: body ? (raw ? body : JSON.stringify(body)) : undefined,
  });
}
test("full PDF denied before license, separate preview, purchase unlock, replay and revocation", async () => {
  const admin = await token("superuser@example.invalid"),
    account = await newReader(),
    reader = account.token;
  assert.equal((await api("/info")).status, 200);
  const metadata = {
    title: "Fictional protected API test",
    author: "Fictional author",
    ownershipClaim: "Fictional test material created for local verification",
    priceCredits: 20,
    operationId: randomUUID(),
  };
  assert.equal((await api('/admin/books',admin,{...metadata,operationId:randomUUID(),priceCredits:991,priceReference:{asset:'USDT',amountMicros:8_000_000,bdtPerUnitMinor:12399}},'POST')).status,400);
  assert.equal(
    (await api("/admin/books", reader, metadata, "POST")).status,
    403,
  );
  const created = await (
      await api("/admin/books", admin, metadata, "POST")
    ).json(),
    id = created.id;
  assert.ok(id);
  const replay = await (
    await api("/admin/books", admin, metadata, "POST")
  ).json();
  assert.equal(replay.id, id);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bw-api-test-")),
    source = path.join(dir, "fictional.pdf");
  try {
    execFileSync(
      "python",
      [
        "-c",
        "import pymupdf,sys;d=pymupdf.open();[(lambda p,i:p.insert_text((40,80),'FICTIONAL PROTECTED PAGE '+str(i)))(d.new_page(width=420,height=595),i) for i in range(1,21)];d.save(sys.argv[1])",
        source,
      ],
      { windowsHide: true },
    );
    const original = fs.readFileSync(source),
      upload = await api(
        "/admin/books/" + id + "/file",
        admin,
        original,
        "PUT",
        true,
      );
    assert.equal(upload.status, 200);
    assert.equal((await upload.json()).previewPages, 2);
    assert.equal((await api("/books/" + id + "/preview")).status, 400);
    assert.equal(
      (
        await api(
          "/admin/books/" + id + "/policy",
          admin,
          { priceCredits: 20, downloadAllowed: true, status: "published" },
          "POST",
        )
      ).status,
      200,
    );
    const preview = await api("/books/" + id + "/preview");
    assert.equal(preview.status, 200);
    assert.match(preview.headers.get("content-type"), /pdf/);
    assert.equal((await api("/books/" + id + "/read")).status, 401);
    assert.equal((await api("/books/" + id + "/download", reader)).status, 403);
    const offer = (await (await api("/books")).json()).find((b) => b.id === id),
      operationId = randomUUID();
    const encrypted = fs.readFileSync(
      path.join(
        os.homedir(),
        "AppData",
        "Local",
        "BookWarehouse",
        "protected-prototype",
        id,
        offer.version + ".encrypted",
      ),
    );
    assert.notEqual(encrypted.subarray(0, 5).toString(), "%PDF-");
    assert.equal(encrypted.includes(original), false);
    const insufficient = await api(
      "/books/" + id + "/purchase",
      reader,
      { operationId, version: offer.version, priceCredits: 20 },
      "POST",
    );
    assert.equal(insufficient.status, 400);
    assert.equal(
      (
        await api(
          "/admin/grant",
          admin,
          { uid: account.uid, amount: 50, operationId: randomUUID() },
          "POST",
        )
      ).status,
      200,
    );
    const purchase = await api(
      "/books/" + id + "/purchase",
      reader,
      { operationId, version: offer.version, priceCredits: 20 },
      "POST",
    );
    assert.equal(purchase.status, 200);
    assert.equal((await purchase.json()).charged, 20);
    const again = await api(
      "/books/" + id + "/purchase",
      reader,
      { operationId: randomUUID(), version: offer.version, priceCredits: 20 },
      "POST",
    );
    assert.equal((await again.json()).charged, 0);
    assert.equal((await api("/books/" + id + "/page/3")).status, 401);
    const read = await api("/books/" + id + "/read", reader);
    assert.equal(read.status, 200);
    assert.equal((await read.json()).pageCount, 20);
    const full = await api("/books/" + id + "/download", reader);
    assert.equal(full.status, 200);
    assert.deepEqual(Buffer.from(await full.arrayBuffer()), original);
    const protectedPage = await api("/books/" + id + "/page/3", reader);
    assert.equal(protectedPage.status, 200);
    assert.equal(protectedPage.headers.get("content-type"), "image/png");
    assert.equal(
      (
        await api(
          "/admin/books/" + id + "/policy",
          admin,
          { priceCredits: 20, downloadAllowed: false, status: "published" },
          "POST",
        )
      ).status,
      200,
    );
    assert.equal((await api("/books/" + id + "/download", reader)).status, 403);
    const report = await (await api("/admin/report", admin)).json();
    assert.ok(report.totals.purchases >= 1);
    assert.ok(report.totals.testCreditsGranted >= 50);
    assert.equal((await api("/admin/report", reader)).status, 403);
    assert.equal(
      (
        await api(
          "/admin/revoke",
          admin,
          {
            uid: account.uid,
            bookId: id,
            version: offer.version,
            reason: "Fictional revocation verification",
          },
          "POST",
        )
      ).status,
      200,
    );
    assert.equal((await api("/books/" + id + "/read", reader)).status, 403);
    assert.equal((await api("/books/" + id + "/page/3", reader)).status, 403);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
