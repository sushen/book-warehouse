"use strict";
const { failure } = require("../core/credit-license-service.cjs");
/** Real Firebase/Google identity with local financial/content persistence.
 * No service-account secret or production write is needed. */
class GoogleFirebaseIdentity {
  constructor({ auth, projectId, apiKey, context, fetcher = fetch }) {
    this.authentication = "google";
    Object.assign(this, { auth, projectId, apiKey, context, fetcher });
  }
  async identify(authorization) {
    const token = (authorization || "").match(/^Bearer (\S+)$/)?.[1];
    if (!token) failure("sign-in-required");
    let user;
    try {
      // The SDK verifies Google's signature, audience, issuer and expiry.
      user = await this.auth.verifyIdToken(token);
    } catch { failure("sign-in-required"); }
    if (user.firebase?.sign_in_provider !== "google.com") failure("sign-in-required");
    const response = await this.fetcher(
      "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(this.apiKey),
      { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token }), signal: AbortSignal.timeout(10000) },
    );
    if (!response.ok) failure("sign-in-required");
    const account = (await response.json()).users?.[0];
    if (!account || account.localId !== user.uid || account.disabled ||
        (account.validSince !== undefined && (!/^\d+$/.test(account.validSince) ||
          !Number.isFinite(user.auth_time) || user.auth_time < Number(account.validSince))))
      failure("sign-in-required");
    return user;
  }
  async requireAdmin(authorization) {
    const user = await this.identify(authorization);
    await this.readGrant(user.uid, authorization);
    return user;
  }
  async readGrant(uid, authorization) {
    // Read-only, under the existing project's Firestore rules and user's token.
    const response = await this.fetcher(
      `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents/adminGrants/${encodeURIComponent(uid)}`,
      { headers: { Authorization: authorization }, signal: AbortSignal.timeout(10000) },
    );
    if (!response.ok) failure("admin-required");
    const fields = (await response.json()).fields;
    if (fields?.status?.stringValue !== "active" ||
        !["admin", "superuser"].includes(fields?.role?.stringValue)) failure("admin-required");
  }
  async assertAdministrator(uid) {
    const authorization = this.context.getStore()?.authorization;
    const user = await this.identify(authorization);
    if (user.uid !== uid) failure("admin-required");
    await this.readGrant(uid, authorization);
  }
}
module.exports = { GoogleFirebaseIdentity };
