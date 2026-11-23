# launchy-img-converter

## Stack

Vite + React (JavaScript), React Router with lazy-loaded pages, Tailwind CSS v4 (`@tailwindcss/vite`), Framer Motion (`LazyMotion` + `domAnimation`), Inter Variable via Fontsource, oxlint, Playwright for `npm run check`, deployed on Vercel at https://launchy-img-converter.vercel.app.

- `vercel.json` handles SPA rewrites (and cache and security headers).
- All visible text and the `seo` block live in `src/content/site.json`. Components read from it; no hard-coded text.
- `plugins/seo.js` generates the head tags at build time from the `seo` block.

## Memory

Read `MEMORY.md` at the start of each session and update it whenever an important decision is made.

## Rules

### Performance (mobile Lighthouse target 95+, LCP <= 2.5 s, CLS <= 0.1)

- The LCP element (usually the hero image): WebP or AVIF, about 100-150 KB, width and height attributes, `fetchpriority="high"`, `<link rel="preload" as="image">`, and NEVER `loading="lazy"`. Never start its container at opacity 0 and never replace it after first paint.
- Images below the fold: `loading="lazy"`, `decoding="async"`, explicit dimensions or aspect-ratio. Import images from `src` so they get hashed names.
- Fonts: self-hosted with Fontsource, `font-display: swap`, only needed subsets and weights.
- Lazy-load routes. Keep heavy libraries out of the first bundle. No moment, no full lodash. Use `LazyMotion` for Framer Motion.
- Third-party scripts: avoid, or load after idle with `defer`/`async`.
- Reserve space for images and late content. Animate only `transform` and `opacity`. Respect `prefers-reduced-motion`.

### Accessibility (aim for Lighthouse 100)

- Alt text on meaningful images (empty alt for decorative), a label for every input, `aria-label` on icon-only buttons and links, visible focus styles, contrast of at least 4.5:1, tap targets of at least 44x44 px, a skip-to-content link, no positive tabindex.
- Semantic HTML: one h1 per page, ordered headings, header / nav / main / footer landmarks, real `<a href>` for internal links.

### Best practices

- HTTPS only, no console errors or warnings in production, `rel="noopener"` on `target="_blank"` links.
- Only public keys (prefixed `VITE_`) may reach the browser. Never put secrets in env variables the client can read.

### Testing (`npm run check`)

- `npm run check` builds the site and tests it in real browsers (Chromium desktop and phone, WebKit as an iPhone). `npm run check -- <url>` tests a live site instead. The owner runs it in the terminal. Never run it unless asked.
- When you add a page: add its path to `PAGES` in `scripts/check-site.mjs`, and add it to `public/sitemap.xml` and `public/llms.txt`.
- When you add a feature (a form, a booking, a login, a language): add a check for it in `scripts/check-site.mjs`. Replace any backend and email calls with fakes inside the test so nothing real is saved or sent.
- Never weaken or delete a check to make it pass. If a check is wrong, tell the owner.

### How to work

- Do NOT run tests, screenshots, Lighthouse or review passes on your own, and do not commit or push, unless asked.
- No code comments unless the reason is truly non-obvious.
- Write code that meets these rules, then tell the owner what you changed.
