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

async function renderPage(page) {
  const { width, height } = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({
    scale: PAGE_LONG_SIDE / Math.max(width, height),
  });
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
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    cMapUrl: `${assets}cmaps/`,
    standardFontDataUrl: `${assets}standard_fonts/`,
    wasmUrl: `${assets}wasm/`,
    iccUrl: `${assets}iccs/`,
  });

  try {
    const document = await task.promise;
    const total = document.numPages;
    const digits = Math.max(2, String(total).length);
    // Kept short so slugify's length limit never cuts off the page number.
    const name = slugify(baseName(file.name)).slice(0, 60) || "pdf";

    for (let number = 1; number <= total && !signal.aborted; number++) {
      onPage(null, number, total);
      const blob = await renderPage(await document.getPage(number));
      if (signal.aborted) return;
      const pageName = `${name}-${String(number).padStart(digits, "0")}.png`;
      onPage(new File([blob], pageName, { type: "image/png" }), number, total);
    }
  } finally {
    await task.destroy();
  }
}
