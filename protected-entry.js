import { isLocalRuntime } from './local-runtime.js';
if (/^https?:$/.test(location.protocol)) {
  const nav =
    document.querySelector(".site-header nav") ||
    document.querySelector(".admin-nav");
  if (nav) {
    const link = document.createElement("a");
    link.href = "protected.html";
    nav.append(link);
    const label = () => {
      link.textContent =
        document.documentElement.lang === "bn"
          ? "আপনার পড়ার জায়গা"
          : "Your reading space";
    };
    label();
    new MutationObserver(label).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });
  }
}
