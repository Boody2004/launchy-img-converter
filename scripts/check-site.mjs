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
