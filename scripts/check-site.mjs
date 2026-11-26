import { readFileSync } from "node:fs";
import { build, preview } from "vite";
import { chromium, webkit, devices } from "playwright";

const { seo } = JSON.parse(
  readFileSync(new URL("../src/content/site.json", import.meta.url), "utf8"),
);

const PAGES = ["/"];
const PROFILES = [
  {
    name: "chromium desktop",
    launcher: chromium,
    options: { viewport: { width: 1440, height: 900 } },
  },
  {
    name: "chromium phone",
    launcher: chromium,
    options: { viewport: { width: 390, height: 844 } },
  },
  {
    name: "webkit iPhone 14",
    launcher: webkit,
    options: { ...devices["iPhone 14"] },
  },
];

const results = [];
let base = "";

function check(ok, label, detail = "") {
  results.push({ ok, label });
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `  ->  ${detail}` : ""}`,
  );
}

async function section(label, run) {
  try {
    await run();
  } catch (error) {
    check(
      false,
      `${label}: the check crashed`,
      String(error.message).split("\n")[0],
    );
  }
}

async function open(profile) {
  const browser = await profile.launcher.launch();
  const context = await browser.newContext(profile.options);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  return { browser, page };
}

const metaTag = (html, key, value) =>
  html.match(new RegExp(`<meta[^>]*${key}="${value}"[^>]*>`))?.[0] ?? "";
const metaContent = (tag) => tag.match(/content="([^"]*)"/)?.[1] ?? "";

async function staticFiles() {
  const get = async (path) => {
    const response = await fetch(base + path);
    return { status: response.status, text: await response.text() };
  };

  await section("static files", async () => {
    const robots = await get("/robots.txt");
    check(
      robots.status === 200 &&
        /^Allow: \//m.test(robots.text) &&
        /^Sitemap: https?:\/\/\S+\/sitemap\.xml/m.test(robots.text),
      "robots.txt allows crawling and points at the sitemap",
      robots.text.slice(0, 80),
    );

    const llms = await get("/llms.txt");
    check(
      llms.status === 200 &&
        /^# \S/m.test(llms.text) &&
        !/<html/i.test(llms.text),
      "llms.txt is Markdown with an H1",
      llms.text.slice(0, 80),
    );

    const sitemap = await get("/sitemap.xml");
    check(
      sitemap.status === 200 &&
        sitemap.text.includes("<urlset") &&
        sitemap.text.includes("<loc>"),
      "sitemap.xml lists the pages",
      sitemap.text.slice(0, 80),
    );
  });

  await section("head tags", async () => {
    const html = (await get("/")).text;
    const escapedTitle = seo.title.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    check(
      html.includes(`<title>${escapedTitle}</title>`),
      "the title is in the HTML before any JavaScript runs",
    );
    check(
      metaContent(metaTag(html, "name", "description")).length >= 50,
      "the meta description is in the HTML",
    );
    check(
      /<link[^>]*rel="canonical"[^>]*href="https?:\/\//.test(html),
      "there is a canonical link with a full address",
    );
    check(
      metaContent(metaTag(html, "property", "og:title")) !== "" &&
        metaContent(metaTag(html, "property", "og:description")) !== "",
      "Open Graph title and description are in the HTML",
    );
    check(
      /^https?:\/\//.test(metaContent(metaTag(html, "property", "og:image"))),
      "the share image has a full address",
    );
    check(
      metaContent(metaTag(html, "name", "twitter:card")) !== "",
      "the twitter card is in the HTML",
    );
    check(/<link[^>]*rel="icon"/.test(html), "there is a favicon link");
    check(
      !/fonts\.googleapis\.com/.test(html),
      "no render-blocking Google Fonts link",
    );

    const ld = html.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    )?.[1];
    let parsed = null;
    try {
      parsed = JSON.parse(ld);
    } catch {
      parsed = null;
    }
    check(
      parsed !== null && /Organization/.test(ld) && /WebSite/.test(ld),
      "the JSON-LD data is valid and describes the organization and the website",
    );
  });
}

async function pageChecks(profile, path) {
  const tag = `${profile.name} ${path}`;
  const { browser, page } = await open(profile);
  try {
    const problems = [];
    const requests = [];
    page.on("pageerror", (error) => problems.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") problems.push(message.text());
    });
    page.on("request", (request) => requests.push(request.url()));

    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const height = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    const step = page.viewportSize().height;
    for (let y = 0; y < height; y += step) {
      await page.evaluate((value) => window.scrollTo(0, value), y);
      await page.waitForTimeout(150);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(900);

    const info = await page.evaluate(() => {
      const name = (element) =>
        (
          element.innerText ||
          element.getAttribute("aria-label") ||
          element.getAttribute("title") ||
          element.querySelector("img[alt]")?.getAttribute("alt") ||
          (element.getAttribute("aria-labelledby")
            ? document.getElementById(element.getAttribute("aria-labelledby"))
                ?.innerText
            : "") ||
          ""
        ).trim();
      const visible = (element) => element.getClientRects().length > 0;
      const images = [...document.images];
      const firstLink = document.querySelector("a");

      return {
        lang: document.documentElement.lang,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        h1: [...document.querySelectorAll("h1")].map((heading) =>
          heading.innerText.trim(),
        ),
        main: Boolean(document.querySelector("main")),
        skipLink: Boolean(
          firstLink &&
          firstLink.getAttribute("href")?.startsWith("#") &&
          document.querySelector(firstLink.getAttribute("href")),
        ),
        noAlt: images
          .filter((image) => !image.hasAttribute("alt"))
          .map((image) => image.src),
        noSize: images
          .filter(
            (image) =>
              !(image.hasAttribute("width") && image.hasAttribute("height")),
          )
          .map((image) => image.src),
        lazyAbove: images
          .filter(
            (image) =>
              visible(image) &&
              image.loading === "lazy" &&
              image.getBoundingClientRect().top < window.innerHeight,
          )
          .map((image) => image.src),
        broken: images
          .filter(
            (image) =>
              visible(image) && !(image.complete && image.naturalWidth > 0),
          )
          .map((image) => image.currentSrc || image.src),
        unnamed: [...document.querySelectorAll("a, button")]
          .filter((element) => visible(element) && !name(element))
          .map((element) => element.outerHTML.slice(0, 80)),
        unlabeled: [
          ...document.querySelectorAll(
            "input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea",
          ),
        ]
          .filter(
            (field) =>
              !(
                field.labels?.length ||
                field.getAttribute("aria-label") ||
                field.getAttribute("aria-labelledby")
              ),
          )
          .map((field) => field.outerHTML.slice(0, 80)),
        unsafe: [...document.querySelectorAll('a[target="_blank"]')]
          .filter((link) => !/noopener/.test(link.rel))
          .map((link) => link.href),
      };
    });

    check(info.lang !== "", `${tag}: the page declares its language`);
    check(
      info.overflow <= 0,
      `${tag}: no horizontal scroll`,
      `${info.overflow}px`,
    );
    check(
      info.h1.length === 1 && info.h1[0] !== "",
      `${tag}: exactly one non-empty h1`,
      JSON.stringify(info.h1),
    );
    check(info.main, `${tag}: there is a main landmark`);
    check(
      info.skipLink,
      `${tag}: the first link is a skip-to-content link that points at something`,
    );
    check(
      info.noAlt.length === 0,
      `${tag}: every image has an alt attribute`,
      info.noAlt.join(", "),
    );
    check(
      info.noSize.length === 0,
      `${tag}: every image has width and height`,
      info.noSize.join(", "),
    );
    check(
      info.lazyAbove.length === 0,
      `${tag}: no image at the top of the page is lazy-loaded`,
      info.lazyAbove.join(", "),
    );
    check(
      info.broken.length === 0,
      `${tag}: every image loads`,
      info.broken.join(", "),
    );
    check(
      info.unnamed.length === 0,
      `${tag}: every link and button has a name`,
      info.unnamed.join(" | "),
    );
    check(
      info.unlabeled.length === 0,
      `${tag}: every form field has a label`,
      info.unlabeled.join(" | "),
    );
    check(
      info.unsafe.length === 0,
      `${tag}: new-tab links use rel="noopener"`,
      info.unsafe.join(", "),
    );
    check(
      !requests.some((url) => /fonts\.g(oogleapis|static)\.com/.test(url)),
      `${tag}: no request to Google Fonts`,
    );
    check(
      problems.length === 0,
      `${tag}: no errors in the console`,
      problems.slice(0, 3).join(" | "),
    );
  } finally {
    await browser.close();
  }
}

function samplePdf(pageCount, drawing = "") {
  const kids = Array.from({ length: pageCount }, (_, i) => `${i + 3} 0 R`);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pageCount} >>`,
    ...kids.map(
      () =>
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 960 540]${drawing && ` /Contents ${pageCount + 3} 0 R`} >>`,
    ),
    ...(drawing
      ? [`<< /Length ${drawing.length} >>\nstream\n${drawing}\nendstream`]
      : []),
  ];

  let text = "%PDF-1.7\n";
  const offsets = objects.map((object, i) => {
    const offset = text.length;
    text += `${i + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = text.length;
  const entries = offsets
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  text += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${entries}`;
  text += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(text);
}

async function converterChecks(profile) {
  const tag = `${profile.name} converter`;
  const { browser, page } = await open(profile);
  try {
    const problems = [];
    page.on("pageerror", (error) => problems.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") problems.push(message.text());
    });
    page.setDefaultTimeout(30000);
    await page.goto(base + "/", { waitUntil: "networkidle" });

    const png = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 300;
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, 400, 300);
      context.fillStyle = "#1a8cff";
      context.fillRect(40, 40, 200, 140);
      context.fillStyle = "#0b0f17";
      context.beginPath();
      context.arc(280, 190, 70, 0, Math.PI * 2);
      context.fill();
      return canvas.toDataURL("image/png").split(",")[1];
    });

    await page.locator('[data-testid="file-input"]').setInputFiles({
      name: "Test Photo.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
    const item = page.locator('[data-testid="file-item"]').first();
    await item.locator('[data-testid="html-snippet"]').waitFor();
    check(
      (await item.getAttribute("data-status")) === "done",
      `${tag}: an uploaded PNG is converted`,
    );

    const alt = "Launchy team at the office";
    await item.locator('[data-testid="alt-input"]').fill(alt);
    const snippet = await item
      .locator('[data-testid="html-snippet"]')
      .innerText();
    check(
      snippet.includes('src="launchy-team-at-the-office.webp"') &&
        snippet.includes(`alt="${alt}"`) &&
        snippet.includes('width="400"') &&
        snippet.includes('height="300"'),
      `${tag}: alt text sets the file name and the HTML snippet`,
      snippet,
    );

    const save = async (locator) => {
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        locator.click(),
      ]);
      return {
        name: download.suggestedFilename(),
        bytes: readFileSync(await download.path()),
      };
    };

    const webp = await save(item.getByRole("button", { name: "Download" }));
    check(
      webp.name === "launchy-team-at-the-office.webp" &&
        webp.bytes.subarray(0, 4).toString() === "RIFF" &&
        webp.bytes.subarray(8, 12).toString() === "WEBP",
      `${tag}: the download is a real WebP file with the SEO file name`,
      `${webp.name} ${webp.bytes.subarray(0, 12).toString("hex")}`,
    );

    await page.locator('label:has([data-testid="format-svg"])').click();
    await page.waitForFunction(() =>
      document
        .querySelector('[data-testid="html-snippet"]')
        ?.textContent.includes('.svg"'),
    );
    const svg = await save(item.getByRole("button", { name: "Download" }));
    const svgText = svg.bytes.toString("utf8");
    check(
      svg.name === "launchy-team-at-the-office.svg" &&
        svgText.startsWith("<svg") &&
        svgText.includes("<path") &&
        svgText.includes(`<title>${alt}</title>`),
      `${tag}: switching to SVG gives a traced vector with the alt text as its title`,
      `${svg.name} ${svgText.slice(0, 120)}`,
    );

    const zip = await save(page.locator('[data-testid="download-all"]'));
    check(
      zip.name.endsWith(".zip") && zip.bytes.subarray(0, 2).toString() === "PK",
      `${tag}: download all gives a ZIP file`,
      zip.name,
    );

    await page.getByRole("button", { name: "Clear all" }).click();
    await page.locator('label:has([data-testid="format-webp"])').click();
    await page.locator('[data-testid="file-input"]').setInputFiles({
      name: "Test Deck.pdf",
      mimeType: "application/pdf",
      buffer: samplePdf(2),
    });
    await page.waitForFunction(
      () =>
        document.querySelectorAll(
          '[data-testid="file-item"][data-status="done"]',
        ).length === 2,
    );
    const slides = await page
      .locator('[data-testid="html-snippet"]')
      .allInnerTexts();
    check(
      slides.length === 2 &&
        slides[0].includes('src="test-deck-01.webp"') &&
        slides[1].includes('src="test-deck-02.webp"') &&
        slides.every(
          (slide) =>
            slide.includes('width="1920"') && slide.includes('height="1080"'),
        ),
      `${tag}: every PDF page becomes its own image`,
      slides.join(" | "),
    );

    await page.locator('[data-testid="batch-name-input"]').fill("Hotel Logo");
    const named = await page
      .locator('[data-testid="html-snippet"]')
      .allInnerTexts();
    check(
      named[0].includes('src="hotel-logo-01.webp"') &&
        named[1].includes('src="hotel-logo-02.webp"'),
      `${tag}: one name for all images numbers each file`,
      named.join(" | "),
    );

    const pdfSvg = async (name, drawing) => {
      await page.getByRole("button", { name: "Clear all" }).click();
      await page.locator('[data-testid="file-input"]').setInputFiles({
        name,
        mimeType: "application/pdf",
        buffer: samplePdf(1, drawing),
      });
      await item.locator('[data-testid="svg-source"]').waitFor();
      await item.and(page.locator('[data-status="done"]')).waitFor();
      const file = await save(item.getByRole("button", { name: "Download" }));
      return {
        source: await item
          .locator('[data-testid="svg-source"]')
          .getAttribute("data-source"),
        text: file.bytes.toString("utf8"),
      };
    };
    await page.locator('label:has([data-testid="format-svg"])').click();

    const copied = await pdfSvg("Logo.pdf", "1 0 0 rg 100 100 200 100 re f");
    check(
      copied.source === "vector" &&
        copied.text.includes('fill="#ff0000"') &&
        copied.text.includes('width="400" height="200"'),
      `${tag}: a vector PDF keeps its own shapes, cropped to the artwork`,
      `${copied.source} ${copied.text.slice(0, 200)}`,
    );

    const traced = await pdfSvg("Blank.pdf", "");
    check(
      traced.source === "trace" && traced.text.startsWith("<svg"),
      `${tag}: a PDF page that can't be copied as vectors is traced and says so`,
      `${traced.source} ${traced.text.slice(0, 200)}`,
    );
    await page.locator('label:has([data-testid="format-webp"])').click();

    await page.getByRole("button", { name: "Clear all" }).click();
    await page.locator('[data-testid="transparent"]').check();
    await page.waitForTimeout(600);
    await page.locator('[data-testid="file-input"]').setInputFiles({
      name: "Logo.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
    await item.locator('[data-testid="html-snippet"]').waitFor();
    const cutOut = await save(item.getByRole("button", { name: "Download" }));
    const alphas = await page.evaluate(async (data) => {
      const response = await fetch(`data:image/webp;base64,${data}`);
      const bitmap = await createImageBitmap(await response.blob());
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      context.drawImage(bitmap, 0, 0);
      return [
        context.getImageData(5, 5, 1, 1).data[3],
        context.getImageData(100, 100, 1, 1).data[3],
      ];
    }, cutOut.bytes.toString("base64"));
    check(
      alphas[0] === 0 && alphas[1] === 255,
      `${tag}: transparent background clears the background and keeps the design`,
      alphas.join(", "),
    );
    await page.locator('[data-testid="transparent"]').uncheck();

    const finished = async (name, mimeType, buffer) => {
      await page.getByRole("button", { name: "Clear all" }).click();
      await page
        .locator('[data-testid="file-input"]')
        .setInputFiles({ name, mimeType, buffer });
      await item.and(page.locator('[data-status="done"], [data-status="error"]')).waitFor();
      return {
        status: await item.getAttribute("data-status"),
        text: await item.innerText(),
      };
    };

    const unsized = await finished(
      "Mark.svg",
      "image/svg+xml",
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 50"><rect width="200" height="50" fill="#1a8cff"/></svg>',
      ),
    );
    check(
      unsized.status === "done" &&
        unsized.text.includes('width="1920" height="480"'),
      `${tag}: an SVG with only a viewBox is converted at a large size`,
      unsized.text,
    );

    const clear = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 40;
      canvas.height = 30;
      canvas.getContext("2d");
      return canvas.toDataURL("image/png").split(",")[1];
    });
    // Stands in for a browser that fails to decode a file and "loads" it blank.
    await page.evaluate(() => {
      window.realCreateImageBitmap = window.createImageBitmap;
      window.createImageBitmap = () => Promise.reject(new Error("test"));
    });
    const blank = await finished("Blank.avif", "image/png", Buffer.from(clear, "base64"));
    const drawn = await finished("Drawn.png", "image/png", Buffer.from(png, "base64"));
    await page.evaluate(() => {
      window.createImageBitmap = window.realCreateImageBitmap;
    });
    check(
      blank.status === "error" && drawn.status === "done",
      `${tag}: a file that only loads as a blank picture shows an error`,
      `blank ${blank.status}, drawn ${drawn.status}`,
    );

    const [logoPng, noisePng] = await page.evaluate(() => {
      const logo = document.createElement("canvas");
      logo.width = 600;
      logo.height = 300;
      const context = logo.getContext("2d");
      context.fillStyle = "#2aa9e0";
      context.fillRect(50, 50, 400, 150);
      context.fillStyle = "#0b50a1";
      context.fillRect(120, 220, 300, 40);
      context.fillStyle = "#f69620";
      context.beginPath();
      context.arc(500, 80, 22, 0, Math.PI * 2);
      context.fill();

      const noise = document.createElement("canvas");
      noise.width = 200;
      noise.height = 150;
      const noiseContext = noise.getContext("2d");
      const pixels = noiseContext.createImageData(200, 150);
      for (let i = 0; i < pixels.data.length; i += 4) {
        pixels.data[i] = (i * 7) % 256;
        pixels.data[i + 1] = (i * 13) % 256;
        pixels.data[i + 2] = (i * 29) % 256;
        pixels.data[i + 3] = 255;
      }
      noiseContext.putImageData(pixels, 0, 0);
      return [logo, noise].map((canvas) => canvas.toDataURL("image/png").split(",")[1]);
    });
    await page.locator('label:has([data-testid="format-svg"])').click();
    await page.waitForTimeout(600);
    const tracedSvg = async (name, base64) => {
      await finished(name, "image/png", Buffer.from(base64, "base64"));
      const file = await save(item.getByRole("button", { name: "Download" }));
      return {
        source: await item
          .locator('[data-testid="svg-source"]')
          .getAttribute("data-source"),
        text: file.bytes.toString("utf8"),
      };
    };

    const logoSvg = await tracedSvg("Logo.png", logoPng);
    const logoWidth = Number(logoSvg.text.match(/ width="(\d+)"/)?.[1]);
    check(
      logoSvg.source === "logo" &&
        ["#2aa9e0", "#0b50a1", "#f69620"].every((color) =>
          logoSvg.text.includes(`fill="${color}"`),
        ) &&
        logoWidth >= 465 &&
        logoWidth <= 480,
      `${tag}: a flat-colour logo keeps every colour, even a small one, and is cropped to the artwork`,
      `${logoSvg.source} ${logoSvg.text.slice(0, 200)}`,
    );

    const noiseSvg = await tracedSvg("Noise.png", noisePng);
    check(
      noiseSvg.source === "trace" && noiseSvg.text.includes("<path"),
      `${tag}: an image with many colours is traced as a picture`,
      `${noiseSvg.source} ${noiseSvg.text.slice(0, 120)}`,
    );
    await page.locator('label:has([data-testid="format-webp"])').click();

    check(
      problems.length === 0,
      `${tag}: no errors in the console while converting`,
      problems.slice(0, 3).join(" | "),
    );
  } finally {
    await browser.close();
  }
}

async function notFoundCheck() {
  const { browser, page } = await open(PROFILES[0]);
  try {
    await page.goto(`${base}/this-page-does-not-exist`, {
      waitUntil: "networkidle",
    });
    const robots = await page.evaluate(
      () =>
        document
          .querySelector('meta[name="robots"]')
          ?.getAttribute("content") ?? "",
    );
    check(
      /noindex/.test(robots),
      "an unknown address shows a page marked noindex",
      robots,
    );
  } finally {
    await browser.close();
  }
}

async function main() {
  const target = process.argv[2];

  if (target) {
    base = target.replace(/\/+$/, "");
    console.log(`Checking the live site ${base}\n`);
  } else {
    console.log("Building the site...");
    await build({
      logLevel: "error",
      build: { outDir: "dist-check", emptyOutDir: true },
    });
    const server = await preview({
      build: { outDir: "dist-check" },
      preview: { port: 4179, open: false },
    });
    base = server.resolvedUrls.local[0].replace(/\/+$/, "");
    console.log(`Checking ${base}\n`);
    process.on("exit", () => server.httpServer.close());
  }

  await staticFiles();

  for (const profile of PROFILES) {
    for (const path of PAGES) {
      await section(`${profile.name} ${path}`, () => pageChecks(profile, path));
    }
    await section(`${profile.name} converter`, () => converterChecks(profile));
  }

  await section("not found page", notFoundCheck);

  const failed = results.filter((result) => !result.ok);
  console.log(
    `\n${results.length - failed.length} passed, ${failed.length} failed`,
  );
  failed.forEach((result) => console.log(`  FAILED: ${result.label}`));
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
