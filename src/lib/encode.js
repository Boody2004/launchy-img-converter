import { removeBackground } from "./background.js";
import { findLogoPalette } from "./logo-trace.js";

const MAX_PIXELS = 16_777_216;
const MAX_SIDE = 16_383;
const TRACE_MAX_SIDE = 1000;
const LOGO_MAX_SIDE = 3000;
const LOGO_MAX_COLORS = 12;

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

function clearBackground(context, width, height, options) {
  const imageData = context.getImageData(0, 0, width, height);
  const background = removeBackground(imageData, options);
  if (background === "removed") context.putImageData(imageData, 0, 0);
  return background;
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

export async function toWebp(decoded, { quality, transparent, enclosed }) {
  const { width, height } = outputSize(decoded.width, decoded.height);
  const { canvas, context } = drawToCanvas(decoded.source, width, height);
  try {
    const background = transparent
      ? clearBackground(context, width, height, { enclosed })
      : null;
    if (await canEncodeWebp()) {
      const blob = await canvasToBlob(canvas, "image/webp", quality / 100);
      if (blob?.type === "image/webp") {
        return { blob, width, height, background };
      }
    }
    const { default: encode } = await import("@jsquash/webp/encode.js");
    const buffer = await encode(context.getImageData(0, 0, width, height), {
      quality,
    });
    const blob = new Blob([buffer], { type: "image/webp" });
    return { blob, width, height, background };
  } finally {
    release(canvas);
  }
}

function traceInput(decoded, width, height, maxSide, { transparent, enclosed }) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const traceWidth = Math.max(1, Math.round(width * scale));
  const traceHeight = Math.max(1, Math.round(height * scale));
  const { canvas, context } = drawToCanvas(
    decoded.source,
    traceWidth,
    traceHeight,
  );
  const imageData = context.getImageData(0, 0, traceWidth, traceHeight);
  release(canvas);
  const background = transparent
    ? removeBackground(imageData, { enclosed })
    : null;
  return { imageData, scale: width / traceWidth, background };
}

function runTrace(message, signal) {
  const worker = new Worker(new URL("./trace.worker.js", import.meta.url), {
    type: "module",
  });
  return new Promise((resolve, reject) => {
    signal?.addEventListener("abort", () => reject(new Error("aborted")));
    worker.onmessage = (event) => resolve(event.data);
    worker.onerror = () => reject(new Error("trace"));
    worker.postMessage(message, [message.data.buffer]);
  }).finally(() => worker.terminate());
}

const message = ({ imageData, scale }, extra) => ({
  width: imageData.width,
  height: imageData.height,
  data: imageData.data,
  scale,
  ...extra,
});

export async function traceSvg(decoded, settings, signal) {
  const { width, height } = outputSize(decoded.width, decoded.height);
  const small = traceInput(decoded, width, height, TRACE_MAX_SIDE, settings);
  const palette = findLogoPalette(
    small.imageData,
    Math.min(settings.colors, LOGO_MAX_COLORS),
  );

  if (palette) {
    const large = traceInput(decoded, width, height, LOGO_MAX_SIDE, settings);
    const { logo } = await runTrace(message(large, { palette }), signal);
    if (logo) {
      return {
        ...logo,
        background: large.background,
        source: "logo",
        colors: palette.length,
      };
    }
  }

  const { body } = await runTrace(
    message(small, { colors: settings.colors }),
    signal,
  );
  return { body, width, height, background: small.background, source: "trace" };
}

export function svgDocument({
  body,
  width,
  height,
  title,
  viewBox = `0 0 ${width} ${height}`,
}) {
  const safeTitle = title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const titleTag = safeTitle ? `<title>${safeTitle}</title>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}" role="img">${titleTag}${body}</svg>`;
}
