const HEIC = /\.(heic|heif)$/i;

const isHeic = (file) =>
  /image\/hei[cf]/i.test(file.type) || HEIC.test(file.name);

const isSvg = (file) =>
  file.type === "image/svg+xml" || /\.svg$/i.test(file.name);

const SVG_LONG_SIDE = 1920;
const BLANK_CHECK_SIDE = 2048;
// Percentages and em have no size of their own, so they don't match.
const LENGTH = /^\s*(\d*\.?\d+)\s*(px|pt|pc|mm|cm|in|q)?\s*$/i;
const UNITS = {
  px: 1,
  pt: 96 / 72,
  pc: 16,
  in: 96,
  cm: 96 / 2.54,
  mm: 96 / 25.4,
  q: 96 / 101.6,
};

function pixels(value) {
  const match = LENGTH.exec(value ?? "");
  return match ? Number(match[1]) * UNITS[(match[2] ?? "px").toLowerCase()] : 0;
}

// An SVG with only a viewBox would be drawn about 300 px wide.
async function withSize(file) {
  const parsed = new DOMParser().parseFromString(
    await file.text(),
    "image/svg+xml",
  );
  const svg = parsed.documentElement;
  if (svg.localName !== "svg" || parsed.querySelector("parsererror")) {
    return file;
  }

  let width = pixels(svg.getAttribute("width"));
  let height = pixels(svg.getAttribute("height"));
  if (width && height) return file;
  const [, , boxWidth, boxHeight] = (svg.getAttribute("viewBox") ?? "")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (!(boxWidth > 0 && boxHeight > 0)) return file;

  if (width) height = (width * boxHeight) / boxWidth;
  else if (height) width = (height * boxWidth) / boxHeight;
  else {
    const scale = SVG_LONG_SIDE / Math.max(boxWidth, boxHeight);
    width = boxWidth * scale;
    height = boxHeight * scale;
  }
  svg.setAttribute("width", Math.max(1, Math.round(width)));
  svg.setAttribute("height", Math.max(1, Math.round(height)));
  return new Blob([new XMLSerializer().serializeToString(svg)], {
    type: "image/svg+xml",
  });
}

function isBlank({ source, width, height }) {
  const scale = Math.min(1, BLANK_CHECK_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  canvas.width = 0;
  canvas.height = 0;
  for (let alpha = 3; alpha < data.length; alpha += 4) {
    if (data[alpha]) return false;
  }
  return true;
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const width = image.naturalWidth || 1024;
      const height = image.naturalHeight || 1024;
      resolve({ source: image, width, height, close() {} });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode"));
    };
    image.src = url;
  });
}

const fromBitmap = (bitmap) => ({
  source: bitmap,
  width: bitmap.width,
  height: bitmap.height,
  close: () => bitmap.close(),
});

export async function decodeImage(file) {
  const svg = isSvg(file);
  const input = svg ? await withSize(file) : file;
  try {
    return fromBitmap(await createImageBitmap(input));
  } catch {
    // Some browsers can't decode SVG or HEIC with createImageBitmap.
  }

  try {
    const image = await loadImageElement(input);
    // Chrome can "load" a file it can't decode, such as a tiled AVIF, as a
    // fully see-through picture.
    if (!svg && isBlank(image)) throw new Error("decode");
    return image;
  } catch (error) {
    if (!isHeic(file)) throw error;
  }

  const { heicTo } = await import("heic-to");
  return fromBitmap(await heicTo({ blob: file, type: "bitmap" }));
}
