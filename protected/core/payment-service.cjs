"use strict";
/** Provider Strategy port. An adapter must verify server-to-server evidence,
 * merchant, amount, currency and status before returning a normalized event.
 * There is intentionally no real provider implementation or HTTP webhook yet.
 */
class PaymentService {
  constructor({ gateway, credits }) {
    if (!gateway?.verify || !credits?.applyVerifiedPayment)
      throw new TypeError(
        "A verified-payment gateway and credit service are required",
      );
    this.gateway = gateway;
    this.credits = credits;
  }
  async processNotification(notification) {
    const verified = await this.gateway.verify(notification);
    return this.credits.applyVerifiedPayment(verified);
  }
}
module.exports = { PaymentService };
