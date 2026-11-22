import { isLocalRuntime } from './local-runtime.js';
if (isLocalRuntime(location)) {
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
          ? "সুরক্ষিত বইয়ের স্থানীয় পরীক্ষা"
          : "Protected books prototype";
    };
    label();
    new MutationObserver(label).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });
  }
}
