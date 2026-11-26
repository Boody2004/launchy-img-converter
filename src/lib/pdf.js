import { extractVector } from "./pdf-vector.js";
import { baseName, slugify } from "./text.js";

const PAGE_LONG_SIDE = 1920;

export const isPdf = (file) =>
  file.type === "application/pdf" || /\.pdf$/i.test(file.name);

let library;

function loadLibrary() {
  library ??= Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ])
    .then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    })
    .catch((error) => {
      library = undefined;
      throw error;
    });
  return library;
}

function pageViewport(page) {
  const { width, height } = page.getViewport({ scale: 1 });
  return page.getViewport({ scale: PAGE_LONG_SIDE / Math.max(width, height) });
}

// Letter outlines are only sent when fonts are drawn as paths, so vectors are
// read from their own copy of the file and page rendering stays as it was.
async function openVectors(pdfjs, task) {
  try {
    const document = await task.promise;
    const optionalContent = await document.getOptionalContentConfig();
    return async (number) => {
      let page;
      try {
        page = await document.getPage(number);
        return await extractVector(page, {
          OPS: pdfjs.OPS,
          optionalContent,
          viewport: pageViewport(page),
        });
      } catch {
        return null;
      } finally {
        page?.cleanup();
      }
    };
  } catch {
    return async () => null;
  }
}

async function renderPage(page) {
  const viewport = pageViewport(page);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  try {
    await page.render({ canvas, viewport }).promise;
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("render");
    return blob;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    page.cleanup();
  }
}

export async function readPdf(file, { signal, onPage }) {
  const pdfjs = await loadLibrary();
  const assets = new URL("/pdfjs/", window.location.origin).href;
  const open = async (options) =>
    pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      cMapUrl: `${assets}cmaps/`,
      standardFontDataUrl: `${assets}standard_fonts/`,
      wasmUrl: `${assets}wasm/`,
      iccUrl: `${assets}iccs/`,
      ...options,
    });
  const task = await open();
  let vectorTask;

  try {
    const document = await task.promise;
    const total = document.numPages;
    const digits = Math.max(2, String(total).length);
    // Kept short so slugify's length limit never cuts off the page number.
    const name = slugify(baseName(file.name)).slice(0, 60) || "pdf";

    vectorTask = await open({ disableFontFace: true, fontExtraProperties: true });
    const readVector = await openVectors(pdfjs, vectorTask);

    for (let number = 1; number <= total && !signal.aborted; number++) {
      onPage(null, number, total);
      const blob = await renderPage(await document.getPage(number));
      const vector = await readVector(number);
      if (signal.aborted) return;
      const pageName = `${name}-${String(number).padStart(digits, "0")}.png`;
      const image = new File([blob], pageName, { type: "image/png" });
      onPage(image, number, total, vector);
    }
  } finally {
    await Promise.all([task.destroy(), vectorTask?.destroy()]);
  }
}
