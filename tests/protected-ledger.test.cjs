const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createRightsLedger } = require("../protected/ledger.cjs");
if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || ""))
  throw new Error("Local Firestore emulator required");
const app = initializeApp(
    { projectId: "demo-bw-protected-tests" },
    "protected-tests",
  ),
  db = getFirestore(app),
  now = () => FieldValue.serverTimestamp(),
  service = createRightsLedger(db, now);
after(() => deleteApp(app));
test("atomic licenses, duplicate charging, paid topup replay and revocation", async () => {
  const batch = db.batch();
  for (const collection of [
    "adminGrants",
    "protectedBooks",
    "protectedWallets",
    "protectedLicenses",
    "protectedLedger",
    "protectedPaymentIntents",
    "protectedPaymentEvents",
    "protectedAudit",
  ]) {
    const snap = await db.collection(collection).get();
    for (const d of snap.docs) batch.delete(d.ref);
  }
  await batch.commit();
  await db
    .doc("adminGrants/admin")
    .set({ role: "superuser", status: "active" });
  await db
    .doc("protectedBooks/book")
    .set({
      status: "published",
      priceCredits: 30,
      version: "v1",
      sha256: "source-hash",
    });
  await assert.rejects(
    service.grant("reader", "reader", 100, "grant1"),
    /admin-required/,
  );
  await service.grant("admin", "reader", 100, "grant1");
  await service.grant("admin", "reader", 100, "grant1");
  assert.equal(
    (await db.doc("protectedWallets/reader").get()).data().balance,
    100,
  );
  await assert.rejects(
    service.grant("admin", "reader", 101, "grant1"),
    /operation-mismatch/,
  );
  await assert.rejects(service.access("reader", "book"), /license-required/);
  const result = await Promise.all([
    service.purchase("reader", "book", "one", "v1", 30),
    service.purchase("reader", "book", "two", "v1", 30),
  ]);
  assert.equal(
    result.reduce((sum, r) => sum + r.charged, 0),
    30,
  );
  assert.equal(
    (await db.doc("protectedWallets/reader").get()).data().balance,
    70,
  );
  assert.equal(
    (
      await db
        .collection("protectedLedger")
        .where("kind", "==", "book-access")
        .get()
    ).size,
    1,
  );
  await service.access("reader", "book");
  await assert.rejects(
    service.purchase("other", "book", "three", "v1", 30),
    /insufficient-credits/,
  );
  await assert.rejects(
    service.purchase("reader", "book", "four", "v2", 30),
    /offer-changed/,
  );
  await service.revoke(
    "admin",
    "reader",
    "book",
    "v1",
    "Fictional dispute test",
  );
  await assert.rejects(service.access("reader", "book"), /license-required/);
  await assert.rejects(
    service.purchase("reader", "book", "five", "v1", 30),
    /license-revoked/,
  );
  assert.equal(
    (await db.doc("protectedWallets/reader").get()).data().balance,
    70,
  );
  await db
    .doc("protectedPaymentIntents/topup")
    .set({
      uid: "other",
      credits: 50,
      provider: "fictional-provider",
      paymentId: "fictional-order",
      amountMinor: 500,
      currency: "TEST",
      status: "pending",
    });
  const event = {
    id: "verified1",
    intentId: "topup",
    status: "succeeded",
    provider: "fictional-provider",
    paymentId: "fictional-order",
    amountMinor: 500,
    currency: "TEST",
  };
  await assert.rejects(
    service.applyVerifiedPayment({ ...event, amountMinor: 499 }),
    /payment-mismatch/,
  );
  await Promise.all([
    service.applyVerifiedPayment(event),
    service.applyVerifiedPayment({ ...event, id: "verified2" }),
  ]);
  assert.equal(
    (await db.doc("protectedWallets/other").get()).data().balance,
    50,
  );
  await service.applyVerifiedPayment(event);
  assert.equal(
    (await db.doc("protectedWallets/other").get()).data().balance,
    50,
  );
  assert.equal(
    (
      await db
        .collection("protectedLedger")
        .where("kind", "==", "verified-credit-topup")
        .get()
    ).size,
    1,
  );
});
