# MEMORY

## Project Overview

- Name: launchy-img-converter (site name: Launchy Image Converter).
- Domain: https://launchy-img-converter.vercel.app (hosted on Vercel).
- Purpose: an internal tool for the company Launchy. Upload images and get WebP by default, or SVG on request, plus alt text and SEO file names to use on Launchy client websites.
- Design reference: the CloudConvert image converter (dark theme, hero with "ANY to FORMAT" visual, a centred drop card, format chips, footer), re-branded in Launchy blue.
- Status: the converter is built (2026-11-23).

## Tech Stack

- Vite + React (JavaScript), React Router (lazy-loaded pages)
- Tailwind CSS v4 via `@tailwindcss/vite`
- Framer Motion with `LazyMotion` / `domAnimation`
- Inter Variable font self-hosted with Fontsource
- oxlint for linting
- Playwright (Chromium, WebKit) for `npm run check`
- Vercel for hosting (`vercel.json`)
- Converter libraries, all lazy-loaded only when needed: `heic-to` (HEIC decoding, about 3 MB, LGPL-3.0), `imagetracerjs` (SVG tracing, runs in a Web Worker), `fflate` (ZIP), `@jsquash/webp` (WebAssembly WebP encoder for browsers like Safari that can't make WebP from a canvas).

## Decisions

- Owner's choices (2026-11-23): UI in English only; SVG means real vector tracing, not a raster wrapped in SVG; the owner writes alt text by hand (no AI); features are multi-file upload with a ZIP, a quality slider (default 80) and HEIC support. Resizing was not wanted.
- Everything runs in the browser. No backend, no uploads.
- WebP is the default format. Format and quality/colors are global settings; changing them re-converts every image (debounced 300 ms).
- File name = slug of the custom file name, else of the alt text, else of the original name. Duplicates get `-2`, `-3`. Slugs keep Unicode letters, so Arabic alt text gives Arabic file names.
- Each image shows a copy-ready `<img>` tag with alt, width, height, `loading="lazy"`, `decoding="async"`. SVG files get the alt text as `<title>` and `role="img"`. The ZIP includes `alt-text.json` (file, alt, width, height).
- Very large images are scaled down to at most 16.7 MP (the iOS canvas limit) and 16383 px per side. SVG tracing works on a copy of at most 1000 px and scales the paths back up.
- Brand colours: logo blue `#1a8cff`; buttons use `#1769e0` (brand-600) so white text passes 4.5:1. Tokens live in `src/index.css` (`ink-*`, `brand-*`).
- The logo is an SVG recreation of the PNG the owner sent (`src/components/Logo.jsx`, `public/favicon.svg`). Swap in the official SVG if one exists.
- All visible text and SEO data live in `src/content/site.json`; components never hard-code text.
- `plugins/seo.js` generates all head tags (title, description, canonical, Open Graph, Twitter, JSON-LD) at build time.
- `vercel.json` handles SPA rewrites and headers.
- The 404 page adds `<meta name="robots" content="noindex">` while mounted.
- `npm run check` is run only by the owner, never by Claude unless asked. It now also tests the converter in every browser profile.
- `og.jpg` does not exist yet, so the share image URL currently points at a missing file.

## TODO

- Run `npm run check` in the terminal (new converter checks included).
- Test with a real iPhone HEIC photo.
- Add a real 1200x630 share image at `public/og.jpg`.
- Connect the domain on Vercel and add env variables.
- Verify the site in Google Search Console and submit the sitemap (or set it to noindex if the tool should stay private).
- Test the share preview.
