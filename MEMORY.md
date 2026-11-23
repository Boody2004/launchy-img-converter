# MEMORY

## Project Overview

- Name: launchy-img-converter (site name: Launchy Image Converter).
- Domain: https://launchy-img-converter.vercel.app (hosted on Vercel).
- Description: turns JPG, PNG and HEIC photos into fast WebP and AVIF files right in your browser. This wording was inferred from the project name, so edit `src/content/site.json` if the real purpose differs.
- Status: base setup only. Home and 404 pages exist; the converter itself is not built yet.

## Tech Stack

- Vite + React (JavaScript), React Router (lazy-loaded pages)
- Tailwind CSS v4 via `@tailwindcss/vite`
- Framer Motion with `LazyMotion` / `domAnimation`
- Inter Variable font self-hosted with Fontsource
- oxlint for linting
- Playwright (Chromium, WebKit) for `npm run check`
- Vercel for hosting (`vercel.json`)

## Decisions

- All visible text and SEO data live in `src/content/site.json`; components never hard-code text.
- `plugins/seo.js` generates all head tags (title, description, canonical, Open Graph, Twitter, JSON-LD) at build time.
- `vercel.json` handles SPA rewrites and headers.
- The 404 page adds `<meta name="robots" content="noindex">` while mounted.
- `npm run check` is run only by the owner, never by Claude unless asked.
- `og.jpg` does not exist yet, so the share image URL currently points at a missing file.

## TODO

- Add a real 1200x630 share image at `public/og.jpg`.
- Confirm or edit the description and wording in `src/content/site.json`.
- Run `npm run check` in the terminal.
- Connect the domain on Vercel and add env variables.
- Verify the site in Google Search Console and submit the sitemap.
- Test the share preview.
- Build the converter feature (add checks for it in `scripts/check-site.mjs`).
