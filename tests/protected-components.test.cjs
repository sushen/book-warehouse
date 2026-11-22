const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const {
  EncryptedFileStore,
} = require("../protected/adapters/encrypted-file-store.cjs");
const {
  TakaCreditPricePolicy,
  PaymentService,
  createProtectedSystem,
} = require("../protected");
test("reusable library imports without starting Firebase or an HTTP server", () => {
  assert.equal(typeof createProtectedSystem, "function");
  assert.equal(
    Object.keys(require.cache).some((file) =>
      file.endsWith(path.join("protected", "server.cjs")),
    ),
    false,
  );
});
test("taka pricing uses integer quote units and rounds 8 USDT reference to 992 credits", () => {
  const policy = new TakaCreditPricePolicy();
  assert.equal(policy.creditsFromReference({ amountMicros: 8_000_000, bdtPerUnitMinor: 13000 }), 1040);
  assert.equal(
    policy.creditsFromReference({
      amountMicros: 8_000_000,
      bdtPerUnitMinor: 12399,
    }),
    992,
  );
  assert.throws(() =>
    policy.creditsFromReference({ amountMicros: -1, bdtPerUnitMinor: 12399 }),
  );
  assert.throws(() => new TakaCreditPricePolicy({ bdtMinorPerCredit: 0 }));
});
test("encrypted storage binds content to book/version and rejects tampering/path escapes", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "bw-store-"));
  try {
    const store = new EncryptedFileStore(dir, randomBytes(32)),
      source = Buffer.from("%PDF-FICTIONAL-ONLY");
    await store.writeOriginal("book", "version", source);
    assert.deepEqual(await store.readOriginal("book", "version"), source);
    const data = await fs.readFile(store.path("book", "version", "encrypted"));
    assert.equal(data.includes(source), false);
    data[13] ^= 1;
    await fs.writeFile(store.path("book", "version", "encrypted"), data);
    await assert.rejects(store.readOriginal("book", "version"));
    assert.throws(() => store.path("../escape", "version", "encrypted"));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test("payment strategy does not issue credit if verification fails", async () => {
  let calls = 0;
  const credits = {
    applyVerifiedPayment: async (event) => {
      calls++;
      return event;
    },
  };
  const rejected = new PaymentService({
    gateway: {
      verify: async () => {
        throw new Error("unverified");
      },
    },
    credits,
  });
  await assert.rejects(rejected.processNotification({ paid: true }));
  assert.equal(calls, 0);
  const accepted = new PaymentService({
    gateway: { verify: async () => ({ id: "verified-test" }) },
    credits,
  });
  assert.equal((await accepted.processNotification({})).id, "verified-test");
  assert.equal(calls, 1);
});
