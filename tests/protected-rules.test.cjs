const { test, after } = require("node:test");
const fs = require("node:fs");
const {
  initializeTestEnvironment,
  assertFails,
} = require("@firebase/rules-unit-testing");
const { doc, setDoc, getDoc } = require("firebase/firestore");
if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || ""))
  throw new Error("Local Firestore emulator required");
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
const setup = initializeTestEnvironment({
  projectId: "demo-bw-protected-security",
  firestore: {
    host,
    port: Number(port),
    rules: fs.readFileSync("firestore.rules", "utf8"),
  },
});
after(async () => (await setup).cleanup());
test("browser cannot forge balances, payment evidence, licenses or inspect private records", async () => {
  const env = await setup;
  const reader = env.authenticatedContext("reader").firestore();
  for (const collection of [
    "protectedWallets",
    "protectedLedger",
    "protectedLicenses",
    "protectedPaymentIntents",
    "protectedPaymentEvents",
    "protectedEvidence",
    "protectedAudit",
    "protectedTopupRequests",
    "protectedTopupReceipts",
  ]) {
    await assertFails(
      setDoc(doc(reader, collection, "forged"), {
        uid: "reader",
        balance: 1000000,
        status: "active",
      }),
    );
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), collection, "private"), { uid: "reader" }),
    );
    await assertFails(getDoc(doc(reader, collection, "private")));
  }
});
