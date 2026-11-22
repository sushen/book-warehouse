"use strict";
const { failure } = require("./credit-license-service.cjs");
class TakaCreditPricePolicy {
  constructor({ bdtMinorPerCredit = 100 } = {}) {
    if (!Number.isSafeInteger(bdtMinorPerCredit) || bdtMinorPerCredit < 1)
      throw new TypeError("Invalid credit value");
    this.bdtMinorPerCredit = bdtMinorPerCredit;
  }
  creditsFromReference({ amountMicros, bdtPerUnitMinor }) {
    if (
      !Number.isSafeInteger(amountMicros) ||
      amountMicros < 1 ||
      !Number.isSafeInteger(bdtPerUnitMinor) ||
      bdtPerUnitMinor < 1 ||
      !Number.isSafeInteger(amountMicros * bdtPerUnitMinor)
    )
      failure("invalid-price-reference");
    return Math.ceil(
      (amountMicros * bdtPerUnitMinor) / (1_000_000 * this.bdtMinorPerCredit),
    );
  }
}
module.exports = { TakaCreditPricePolicy };
