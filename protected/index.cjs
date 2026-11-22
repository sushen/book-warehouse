"use strict";
module.exports = {
  ...require("./system.cjs"),
  ...require("./core/credit-license-service.cjs"),
  ...require("./core/publishing-service.cjs"),
  ...require("./core/reading-service.cjs"),
  ...require("./core/reporting-service.cjs"),
  ...require("./core/price-policy.cjs"),
  ...require("./core/payment-service.cjs"),
  ...require("./core/topup-request-service.cjs"),
  ...require("./adapters/firestore-repository.cjs"),
  ...require("./adapters/firebase-identity.cjs"),
  ...require("./adapters/google-firebase-identity.cjs"),
  ...require("./adapters/encrypted-file-store.cjs"),
  ...require("./adapters/pdf-processor.cjs"),
};
