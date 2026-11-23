import { readFileSync } from "node:fs";

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export default function seoPlugin() {
  return {
    name: "seo-head",
    transformIndexHtml() {
      const site = JSON.parse(
        readFileSync(new URL("../src/content/site.json", import.meta.url), "utf8"),
      );
      const { seo, imageAlt, themeColor } = site;
      const url = `${seo.domain}/`;
      const image = `${seo.domain}${seo.image}`;

      const meta = (key, name, content) => ({
        tag: "meta",
        attrs: { [key]: name, content: escapeHtml(content) },
        injectTo: "head",
      });

      const jsonLd = JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": `${url}#organization`,
            name: seo.siteName,
            url,
            logo: `${seo.domain}/favicon.svg`,
          },
          {
            "@type": "WebSite",
            "@id": `${url}#website`,
            name: seo.siteName,
            url,
            description: seo.description,
            inLanguage: seo.locale.replace("_", "-"),
            publisher: { "@id": `${url}#organization` },
          },
        ],
      }).replace(/</g, "\\u003c");

      return [
        { tag: "title", children: escapeHtml(seo.title), injectTo: "head" },
        meta("name", "description", seo.description),
        {
          tag: "link",
          attrs: { rel: "canonical", href: url },
          injectTo: "head",
        },
        meta("name", "theme-color", themeColor),
        meta("property", "og:type", "website"),
        meta("property", "og:title", seo.title),
        meta("property", "og:description", seo.description),
        meta("property", "og:url", url),
        meta("property", "og:image", image),
        meta("property", "og:image:alt", imageAlt),
        meta("property", "og:site_name", seo.siteName),
        meta("property", "og:locale", seo.locale),
        meta("name", "twitter:card", "summary_large_image"),
        {
          tag: "script",
          attrs: { type: "application/ld+json" },
          children: jsonLd,
          injectTo: "head",
        },
      ];
    },
  };
}
