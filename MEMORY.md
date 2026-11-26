# MEMORY

## Project Overview

- Name: launchy-img-converter (site name: Launchy Image Converter).
- Domain: https://launchy-img-converter.vercel.app (hosted on Vercel).
- Purpose: an internal tool for the company Launchy. Upload images and get WebP by default, or SVG on request, plus alt text and SEO file names to use on Launchy client websites.
- Design (changed 2026-11-23): the owner dropped the CloudConvert look and asked for something loosely inspired by a "securify / protect your data" landing page: pure black background, a glowing blob behind the converter card, pill buttons, glass cards and a single line of small format pills under a small "Supported formats" label that scrolls as an endless marquee (faded edges, pauses on hover; with reduced motion it stops and wraps, centred). Inspired, not copied. The big hero ("convert your images" headline, intro and stats) was removed at the owner's request, so the page opens straight on the converter card, whose title is the page h1. The "Why use it" benefits section, the tagline row and the header menu/CTA were removed too; the header is just the logo.
- Status: the converter is built (2026-11-23).

## Tech Stack

- Vite + React (JavaScript), React Router (lazy-loaded pages)
- Tailwind CSS v4 via `@tailwindcss/vite`
- Framer Motion with `LazyMotion` / `domAnimation`
- Inter Variable font self-hosted with Fontsource
- oxlint for linting
- Playwright (Chromium, WebKit) for `npm run check`
- Vercel for hosting (`vercel.json`)
- Converter libraries, all lazy-loaded only when needed: `pdfjs-dist` (PDF pages to images, legacy build for Safari support), `heic-to` (HEIC decoding, about 3 MB, LGPL-3.0), `imagetracerjs` (SVG tracing, runs in a Web Worker), `fflate` (ZIP), `@jsquash/webp` (WebAssembly WebP encoder for browsers like Safari that can't make WebP from a canvas).

## Decisions

- Owner's choices (2026-11-23): UI in English only; SVG means real vector tracing, not a raster wrapped in SVG; the owner writes alt text by hand (no AI); features are multi-file upload with a ZIP, a quality slider (default 80) and HEIC support. Resizing was not wanted.
- Everything runs in the browser. No backend, no uploads.
- PDF support (owner, 2026-11-26): every page or slide becomes its own image (the whole page, not the pictures embedded inside it). Pages render at 1920 px on the long side, are named `<pdf-name>-01`, `-02`, and then behave like any uploaded image. Their cards say "From PDF" with no size comparison, and their bitmaps are not cached, to save memory. `plugins/pdf-assets.js` copies the PDF.js fonts, CMaps, WASM and ICC files to `/pdfjs/`.
- Vector PDF to SVG (owner, 2026-11-26): for SVG output, a PDF page keeps its own shapes instead of being traced (tracing lost small colours in logos). `src/lib/pdf-vector.js` turns the PDF.js operator list into paths, clips, gradients and letter outlines, cropped to the artwork; Transparent background drops a full-page background shape. It reads from a second PDF.js document opened with `disableFontFace` and `fontExtraProperties` (needed to get letter outlines), so WebP page rendering is unchanged. Anything it can't copy exactly (images, blend modes, soft masks, non-opaque groups, mesh or tiling fills, non-embedded or Type 3 fonts, annotations) makes the whole page fall back to tracing, and the card says which happened. Never skip an unknown operator. Some fonts give the space glyph a lone "close": a path starting with it is hidden by browsers, so paths must start with a move. CMYK colours are converted by PDF.js with the ICC profile in `/pdfjs/iccs/`: in the browser La Quinta's orange comes out #f59622, matching the designer's export, and the green #74c044 against #77c043. A Node run gave different colours (#ff922a), so check colours in a browser.
- `usePdfImport` makes a new AbortController when its effect runs again: StrictMode's extra cleanup had silently ignored every PDF in `npm run dev` (fixed 2026-11-26).
- Transparent background (owner, 2026-11-26): a global setting, off by default. `src/lib/background.js` removes the dominant border colour only when it covers at least 60% of the border, so photos are left alone. "Also inside letters and shapes" (on by default) clears that colour everywhere, not just what touches the edges.
- One name for all images (owner, 2026-11-26): numbered by position (`name-01`, `name-02`). A per-image file name wins over it; it wins over alt text.
- WebP is the default format. Format and quality/colors are global settings; changing them re-converts every image (debounced 300 ms).
- File name = slug of the custom file name, else of the alt text, else of the original name. Duplicates get `-2`, `-3`. Slugs keep Unicode letters, so Arabic alt text gives Arabic file names.
- Each image shows a copy-ready `<img>` tag with alt, width, height, `loading="lazy"`, `decoding="async"`. SVG files get the alt text as `<title>` and `role="img"`. The ZIP includes `alt-text.json` (file, alt, width, height).
- Very large images are scaled down to at most 16.7 MP (the iOS canvas limit) and 16383 px per side. SVG tracing works on a copy of at most 1000 px and scales the paths back up.
- Colours (owner, 2026-11-23): everything blue, no red/orange/peach anywhere. Black background (`ink-*`), Launchy blue scale (`brand-100`…`brand-700`). Main buttons are `brand-600` with white text (passes 4.5:1); the blob glows in light-to-deep blue. Errors use light blue text with `role="alert"`, not red. Blobs are pure CSS (`.blob` in `src/index.css`, `src/components/Blob.jsx`) and float only when reduced motion is off.
- Fonts: Inter for text, Jost (Fontsource variable, normal weight axis only) for headlines.
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
- Test with a real slide-deck PDF (including an Arabic one).
- Add a real 1200x630 share image at `public/og.jpg`.
- Connect the domain on Vercel and add env variables.
- Verify the site in Google Search Console and submit the sitemap (or set it to noindex if the tool should stay private).
- Test the share preview.
