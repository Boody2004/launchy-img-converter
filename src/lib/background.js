const TOLERANCE = 24;
const MIN_BORDER_SHARE = 0.6;

function borderPixels(width, height) {
  const pixels = [];
  for (let x = 0; x < width; x++) pixels.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y++) pixels.push(y * width, y * width + width - 1);
  return pixels;
}

const distance = (data, offset, color) =>
  Math.max(
    Math.abs(data[offset] - color[0]),
    Math.abs(data[offset + 1] - color[1]),
    Math.abs(data[offset + 2] - color[2]),
  );

function dominantColor(data, pixels) {
  const buckets = new Map();
  let largest = null;
  for (const pixel of pixels) {
    const offset = pixel * 4;
    const key =
      ((data[offset] >> 4) << 8) |
      ((data[offset + 1] >> 4) << 4) |
      (data[offset + 2] >> 4);
    let bucket = buckets.get(key);
    if (!bucket) buckets.set(key, (bucket = [0, 0, 0, 0]));
    for (let c = 0; c < 3; c++) bucket[c] += data[offset + c];
    bucket[3] += 1;
    if (!largest || bucket[3] > largest[3]) largest = bucket;
  }
  return largest.slice(0, 3).map((sum) => Math.round(sum / largest[3]));
}

function connectedToBorder(width, height, border, matches) {
  const mask = new Uint8Array(width * height);
  const stack = new Int32Array(width * height);
  let size = 0;
  const visit = (pixel) => {
    if (mask[pixel] || !matches(pixel)) return;
    mask[pixel] = 1;
    stack[size++] = pixel;
  };

  border.forEach(visit);
  while (size) {
    const pixel = stack[--size];
    const x = pixel % width;
    if (x > 0) visit(pixel - 1);
    if (x < width - 1) visit(pixel + 1);
    if (pixel >= width) visit(pixel - width);
    if (pixel < width * (height - 1)) visit(pixel + width);
  }
  return mask;
}

function touches(mask, pixel, width, height) {
  const x = pixel % width;
  const y = (pixel - x) / width;
  for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny++) {
    for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++) {
      if (mask[ny * width + nx]) return true;
    }
  }
  return false;
}

// Without this, anti-aliased edges keep a halo of the old background colour.
function softenEdge(data, offset, color) {
  let alpha = 0;
  for (let c = 0; c < 3; c++) {
    const difference = data[offset + c] - color[c];
    if (difference === 0) continue;
    const range = difference > 0 ? 255 - color[c] : color[c];
    alpha = Math.max(alpha, Math.abs(difference) / range);
  }
  if (alpha <= 0 || alpha >= 1) return;
  for (let c = 0; c < 3; c++) {
    data[offset + c] = color[c] + (data[offset + c] - color[c]) / alpha;
  }
  data[offset + 3] *= alpha;
}

export function removeBackground({ data, width, height }, { enclosed }) {
  const border = borderPixels(width, height);
  const opaque = border.filter((pixel) => data[pixel * 4 + 3] >= 128);
  if (opaque.length < border.length / 2) return "transparent";

  const color = dominantColor(data, opaque);
  const sharing = opaque.filter(
    (pixel) => distance(data, pixel * 4, color) <= TOLERANCE,
  );
  if (sharing.length < border.length * MIN_BORDER_SHARE) return "kept";

  const matches = (pixel) =>
    data[pixel * 4 + 3] === 0 || distance(data, pixel * 4, color) <= TOLERANCE;

  let mask;
  if (enclosed) {
    mask = new Uint8Array(width * height);
    for (let pixel = 0; pixel < mask.length; pixel++) {
      if (matches(pixel)) mask[pixel] = 1;
    }
  } else {
    mask = connectedToBorder(width, height, border, matches);
  }

  for (let pixel = 0; pixel < mask.length; pixel++) {
    if (mask[pixel]) data.fill(0, pixel * 4, pixel * 4 + 4);
    else if (touches(mask, pixel, width, height)) {
      softenEdge(data, pixel * 4, color);
    }
  }
  return "removed";
}
