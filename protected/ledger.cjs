"use strict";
const {
  CreditLicenseService,
  validId,
  credits,
  failure,
} = require("./core/credit-license-service.cjs");
const {
  FirestoreRightsRepository,
} = require("./adapters/firestore-repository.cjs");
// Compatibility factory: existing consumers/tests keep their construction API.
function createRightsLedger(db, clock) {
  return new CreditLicenseService(new FirestoreRightsRepository(db), clock);
}
module.exports = {
  createRightsLedger,
  CreditLicenseService,
  validId,
  credits,
  failure,
};
