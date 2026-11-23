const MAX_PIXELS = 16_777_216;
const MAX_SIDE = 16_383;
const TRACE_MAX_SIDE = 1000;

export function outputSize(width, height) {
  const scale = Math.min(
    1,
    Math.sqrt(MAX_PIXELS / (width * height)),
    MAX_SIDE / Math.max(width, height),
  );
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function drawToCanvas(source, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);
  return { canvas, context };
}

const release = (canvas) => {
  canvas.width = 0;
  canvas.height = 0;
};

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve) => canvas.toBlob(resolve, type, quality));

let nativeWebp;

async function canEncodeWebp() {
  if (nativeWebp === undefined) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const blob = await canvasToBlob(canvas, "image/webp", 0.8);
    nativeWebp = blob?.type === "image/webp";
  }
  return nativeWebp;
}

export async function toWebp(decoded, quality) {
  const { width, height } = outputSize(decoded.width, decoded.height);
  const { canvas, context } = drawToCanvas(decoded.source, width, height);
  try {
    if (await canEncodeWebp()) {
      const blob = await canvasToBlob(canvas, "image/webp", quality / 100);
      if (blob?.type === "image/webp") return { blob, width, height };
    }
    const { default: encode } = await import("@jsquash/webp/encode.js");
    const buffer = await encode(context.getImageData(0, 0, width, height), {
      quality,
    });
    return { blob: new Blob([buffer], { type: "image/webp" }), width, height };
  } finally {
    release(canvas);
  }
}

export async function traceSvg(decoded, colors, signal) {
  const { width, height } = outputSize(decoded.width, decoded.height);
  const scale = Math.min(1, TRACE_MAX_SIDE / Math.max(width, height));
  const traceWidth = Math.max(1, Math.round(width * scale));
  const traceHeight = Math.max(1, Math.round(height * scale));
  const { canvas, context } = drawToCanvas(
    decoded.source,
    traceWidth,
    traceHeight,
  );
  const imageData = context.getImageData(0, 0, traceWidth, traceHeight);
  release(canvas);

  const worker = new Worker(new URL("./trace.worker.js", import.meta.url), {
    type: "module",
  });
  try {
    const body = await new Promise((resolve, reject) => {
      signal?.addEventListener("abort", () => reject(new Error("aborted")));
      worker.onmessage = (event) => resolve(event.data);
      worker.onerror = () => reject(new Error("trace"));
      worker.postMessage(
        {
          width: traceWidth,
          height: traceHeight,
          data: imageData.data,
          colors,
          scale: width / traceWidth,
        },
        [imageData.data.buffer],
      );
    });
    return { body, width, height };
  } finally {
    worker.terminate();
  }
}

export function svgDocument({ body, width, height, title }) {
  const safeTitle = title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const titleTag = safeTitle ? `<title>${safeTitle}</title>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img">${titleTag}${body}</svg>`;
}
