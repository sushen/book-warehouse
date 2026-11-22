"use strict";
const { failure } = require("../core/credit-license-service.cjs");
class FirebaseIdentity {
  constructor(auth, repository) {
    this.auth = auth;
    this.repository = repository;
  }
  async identify(authorization) {
    const token = (authorization || "").match(/^Bearer (\S+)$/)?.[1];
    if (!token) failure("sign-in-required");
    return this.auth.verifyIdToken(token, true);
  }
  async requireAdmin(authorization) {
    const user = await this.identify(authorization),
      grant = await this.repository.read("adminGrants", user.uid);
    if (
      !grant.exists ||
      grant.data().status !== "active" ||
      !["admin", "superuser"].includes(grant.data().role || "admin")
    )
      failure("admin-required");
    return user;
  }
}
module.exports = { FirebaseIdentity };
