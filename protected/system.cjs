"use strict";
const { CreditLicenseService } = require("./core/credit-license-service.cjs");
const { PublishingService } = require("./core/publishing-service.cjs");
const { ReadingService } = require("./core/reading-service.cjs");
const { ReportingService } = require("./core/reporting-service.cjs");
const { TakaCreditPricePolicy } = require("./core/price-policy.cjs");
const { TopupRequestService } = require("./core/topup-request-service.cjs");
const {
  ProtectedBooksHttpController,
} = require("./adapters/http-controller.cjs");
/** Composition factory; consumers supply their own persistence, identity,
 * encryption/PDF adapters and clock. No Firebase global or server is started.
 */
function createProtectedSystem({
  repository,
  files,
  pdf,
  identity,
  clock,
  origins,
  adminGuard,
  paymentMethods = [],
  pricing = new TakaCreditPricePolicy(),
}) {
  const credits = new CreditLicenseService(repository, clock, adminGuard);
  const publishing = new PublishingService({
    repository,
    files,
    pdf,
    clock,
    pricing,
    adminGuard,
  });
  const reading = new ReadingService({
    publishing,
    licenses: credits,
    files,
    pdf,
    repository,
    clock,
  });
  const reports = new ReportingService(repository);
  const topups = new TopupRequestService({ repository, ledger: credits, clock, methods: paymentMethods });
  const http = new ProtectedBooksHttpController({
    publishing,
    reading,
    credits,
    reports,
    identity,
    origins,
    topups,
  });
  return { credits, publishing, reading, reports, pricing, topups, http };
}
module.exports = { createProtectedSystem };
