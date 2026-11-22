export const taka = (amount) =>
  new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(amount);
export function offerActions(licensed, previewPages, downloadAllowed) {
  return [
    ...(previewPages > 0 ? ["preview"] : []),
    ...(licensed
      ? ["read", ...(downloadAllowed ? ["download"] : [])]
      : ["buy"]),
  ];
}
