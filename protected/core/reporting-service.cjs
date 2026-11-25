"use strict";
class ReportingService {
  constructor(repository) {
    this.repository = repository;
  }
  async wallet(uid) {
    const snapshot = await this.repository.read("protectedWallets", uid);
    return {
      uid,
      balance: snapshot.exists ? snapshot.data().balance : 0,
      unit: "test-credit",
      bdtPerCredit: 1,
    };
  }
  async report() {
    const entries = await this.repository.list("protectedLedger"),
      totals = {
        testCreditsGranted: 0,
        creditsSpent: 0,
        purchases: 0,
        verifiedTopups: 0,
        manuallyVerifiedTopups: 0,
        creditsSold: 0,
        manuallyVerifiedMoneyByCurrency: {},
        moneyByCurrency: {},
      };
    for (const entry of entries) {
      if (['verified-credit-topup','manually-verified-credit-topup'].includes(entry.kind)) totals.creditsSold += entry.amount;
      if (entry.kind === "test-credit-grant")
        totals.testCreditsGranted += entry.amount;
      if (entry.kind === "book-access") {
        totals.creditsSpent -= entry.amount;
        totals.purchases++;
      }
      if (entry.kind === "verified-credit-topup") {
        totals.verifiedTopups++;
        totals.moneyByCurrency[entry.currency] =
          (totals.moneyByCurrency[entry.currency] || 0) + entry.amountMinor;
      }
      if (entry.kind === 'manually-verified-credit-topup') {
        totals.manuallyVerifiedTopups++;
        totals.manuallyVerifiedMoneyByCurrency[entry.currency] = (totals.manuallyVerifiedMoneyByCurrency[entry.currency] || 0) + entry.amountMinor;
      }
    }
    return { mode: "local-prototype", totals, entries };
  }
}
module.exports = { ReportingService };
