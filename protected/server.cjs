"use strict";
const http = require("node:http"),
  path = require("node:path"),
  os = require("node:os");
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const {
  FirestoreRightsRepository,
} = require("./adapters/firestore-repository.cjs");
const { EncryptedFileStore } = require("./adapters/encrypted-file-store.cjs");
const { PdfProcessor } = require("./adapters/pdf-processor.cjs");
const { FirebaseIdentity } = require("./adapters/firebase-identity.cjs");
const { createProtectedSystem } = require("./system.cjs");
const { AsyncLocalStorage } = require("node:async_hooks");
const { GoogleFirebaseIdentity } = require("./adapters/google-firebase-identity.cjs");
const { firestoreHost } = require('./firestore-host.cjs');
const host = firestoreHost(process.env), authMode = host.authMode;
const fs = require("node:fs");
// Never let an emulator setting disable signature checks on real Google tokens.
if (authMode === "google") delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
const root = path.resolve(
  process.env.BW_PROTECTED_DATA_DIR ||
    path.join(
      os.homedir(),
      "AppData",
      "Local",
      "BookWarehouse",
      "protected-prototype",
    ),
);
if (root.startsWith(path.resolve(__dirname, "..") + path.sep))
  throw new Error("Private storage must be outside the website tree");
(async () => {
  const app = initializeApp(
      { projectId: host.projectId, ...(host.mode === 'firebase' ? { credential: applicationDefault() } : {}) },
      "protected-local",
    ),
    database = getFirestore(app),
    repository = new FirestoreRightsRepository(database);
  // Check persistence access before listening; never fall back to a temporary database.
  try { await database.collection('protectedBooks').limit(1).get(); }
  catch { throw Error('The protected service cannot access the Firebase database. Configure trusted server Google credentials with Firestore access. No temporary database was created.'); }
  const files = await EncryptedFileStore.local(root),
    pdf = new PdfProcessor({
      workingDirectory: root,
      python: process.env.BW_PYTHON || "python",
    });
  const context = new AsyncLocalStorage();
  let identity;
  if (authMode === "google") {
    const config = require("../spark-config.json");
    if (config.projectId !== "book-warehouse-staging-261115") throw new Error("Unexpected identity project");
    const identityApp = initializeApp({ projectId: config.projectId }, "protected-google-identity");
    identity = new GoogleFirebaseIdentity({ auth: getAuth(identityApp), projectId: config.projectId,
      apiKey: config.apiKey, context });
  } else identity = new FirebaseIdentity(getAuth(app), repository);
  const clock = () => FieldValue.serverTimestamp();
  const system = createProtectedSystem({
    repository,
    files,
    pdf,
    identity,
    adminGuard: authMode === "google" ? uid => identity.assertAdministrator(uid) : undefined,
    paymentMethods: fs.existsSync(path.join(root, 'payment-methods.json'))
      ? JSON.parse(fs.readFileSync(path.join(root, 'payment-methods.json'), 'utf8')) : [],
    clock,
    origins: new Set(["http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:5174", "http://localhost:5174"]),
  });
  http
    .createServer((req, res) =>
      context.run({ authorization: req.headers.authorization }, () => system.http.handle(req, res)).catch(() => {
        if (!res.headersSent)
          res.writeHead(500, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          });
        res.end(JSON.stringify({ error: "service-unavailable" }));
      }),
    )
    .listen(8787, "127.0.0.1", () =>
      console.log(
        `Protected-book service on 127.0.0.1:8787; database=${host.mode}; real payment APIs disabled.`,
      ),
    );
})().catch(error => { console.error(error.message); process.exitCode = 1; });
