# launchy-img-converter

Launchy Image Converter is Launchy's internal tool for turning JPG, PNG, HEIC and other images into WebP files (the default) or traced SVG vectors (every PDF page or slide becomes its own image), with SEO alt text, clean file names and copy-ready `<img>` HTML. Everything runs in the browser; no image is uploaded. Live at https://launchy-img-converter.vercel.app.

Built with Vite, React, Tailwind CSS, Framer Motion and React Router.

## How to run

```bash
npm install
npm run dev        # local dev server
npm run build      # production build into dist/
npm run preview    # serve the production build
npm run lint       # oxlint
npm run check      # build and test the whole site in real browsers
npm run verify     # lint, then check
```

## Where to edit content

- All visible text and the SEO block live in `src/content/site.json`. Components read from it; do not hard-code text.
- The `<head>` tags (title, description, canonical, Open Graph, Twitter, JSON-LD) are generated at build time from the `seo` block by `plugins/seo.js`.
- Static files are in `public/`: `robots.txt`, `sitemap.xml`, `llms.txt`, `favicon.svg`, and `og.jpg` (a 1200x630 share image you add yourself).
- Pages live in `src/pages/` and are lazy-loaded in `src/App.jsx`.
- `vercel.json` handles SPA rewrites and cache/security headers.

## Testing with `npm run check`

`npm run check` builds the site into `dist-check` and tests it in real browsers: Chromium desktop, Chromium phone and WebKit as an iPhone 14. It covers static files, head tags, accessibility basics, images, console errors, the 404 page, and the converter itself (PNG to WebP, alt text to file name and HTML, SVG tracing, ZIP download, PDF pages to images, one name for all images, transparent background) in every browser.

`npm run check -- https://launchy-img-converter.vercel.app` tests the live site instead.

## Rules

**Performance** (mobile Lighthouse 95+, LCP <= 2.5 s, CLS <= 0.1)

- The LCP element (usually the hero image): WebP or AVIF, about 100-150 KB, width and height attributes, `fetchpriority="high"`, `<link rel="preload" as="image">`, and never `loading="lazy"`. Never start its container at opacity 0 and never replace it after first paint.
- Images below the fold: `loading="lazy"`, `decoding="async"`, explicit dimensions or aspect-ratio. Import images from `src` so they get hashed names.
- Fonts are self-hosted with Fontsource, `font-display: swap`, only needed subsets and weights.
- Routes are lazy-loaded. Keep heavy libraries out of the first bundle. No moment, no full lodash. Use `LazyMotion` for Framer Motion.
- Avoid third-party scripts, or load them after idle with `defer`/`async`.
- Reserve space for images and late content. Animate only `transform` and `opacity`. Respect `prefers-reduced-motion`.

**Accessibility** (aim for Lighthouse 100)

- Alt text on meaningful images (empty alt for decorative), a label for every input, `aria-label` on icon-only buttons and links, visible focus styles, contrast of at least 4.5:1, tap targets of at least 44x44 px, a skip-to-content link, no positive tabindex.
- Semantic HTML: one h1 per page, ordered headings, header / nav / main / footer landmarks, real `<a href>` for internal links.

**Best practices**

- HTTPS only, no console errors or warnings in production, `rel="noopener"` on `target="_blank"` links.

**Testing**

- When you add a page, add its path to `PAGES` in `scripts/check-site.mjs`, and add it to `public/sitemap.xml` and `public/llms.txt`.
- When you add a feature (a form, a booking, a login, a language), add a check for it in `scripts/check-site.mjs`. Replace any backend and email calls with fakes inside the test.
- Never weaken or delete a check to make it pass.

## Environment variables

Copy `.env.example` to `.env.local`. Only variables starting with `VITE_` reach the browser, so never put secrets in them.
