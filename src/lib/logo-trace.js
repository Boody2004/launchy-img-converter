// Tracing for logos and icons made of a few flat colours. Unlike the general
// tracer it keeps small colour areas, works at high resolution, puts edges
// between pixels and fits smooth curves with real corners.

const SOLID = 200;
const MIN_SHARE = 0.003;
const MERGE = 28;
const PURE = 24;
const BLEND = 40;
const COVERAGE = 0.95;
// Measured: flat logos are 98% or more pure colour, photos 66% or less.
const PURE_SHARE = 0.9;
const MIN_AREA = 12;

let nearA = 0;
let nearB = -1;
let nearT = 0;
let nearD = 0;

// Finds the palette colour of a pixel, or the two colours it is an
// anti-aliased blend of. Results go to nearA, nearB, nearT and nearD.
function nearest(data, offset, colors) {
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  let best = 0;
  let bestDistance = Infinity;
  for (let k = 0; k < colors.length; k++) {
    const c = colors[k];
    const d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = k;
    }
  }
  nearA = best;
  nearB = -1;
  nearT = 0;
  nearD = Math.sqrt(bestDistance);
  if (nearD <= PURE) return;

  for (let p = 0; p < colors.length; p++) {
    for (let q = p + 1; q < colors.length; q++) {
      const P = colors[p];
      const Q = colors[q];
      const dx = Q[0] - P[0];
      const dy = Q[1] - P[1];
      const dz = Q[2] - P[2];
      const length = dx * dx + dy * dy + dz * dz;
      if (!length) continue;
      const t = Math.min(
        1,
        Math.max(0, ((r - P[0]) * dx + (g - P[1]) * dy + (b - P[2]) * dz) / length),
      );
      const d = Math.sqrt(
        (r - P[0] - t * dx) ** 2 + (g - P[1] - t * dy) ** 2 + (b - P[2] - t * dz) ** 2,
      );
      if (d < nearD && d < BLEND) {
        nearA = p;
        nearB = q;
        nearT = t;
        nearD = d;
      }
    }
  }
}

const distance = (a, b) =>
  Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

function onSegment(color, colors) {
  let best = Infinity;
  for (let p = 0; p < colors.length; p++) {
    for (let q = p + 1; q < colors.length; q++) {
      const P = colors[p];
      const d = [0, 1, 2].map((i) => colors[q][i] - P[i]);
      const length = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
      if (!length) continue;
      const t = Math.min(
        1,
        Math.max(0, d.reduce((sum, v, i) => sum + v * (color[i] - P[i]), 0) / length),
      );
      best = Math.min(best, distance(color, P.map((v, i) => v + t * d[i])));
    }
  }
  return best;
}

// Returns the colours, largest area first, or null when the image is not a
// flat-colour logo (photos, gradients, too many colours).
export function findLogoPalette({ data }, maxColors) {
  const buckets = new Map();
  let opaque = 0;
  let clear = 0;
  for (let o = 0; o < data.length; o += 4) {
    if (data[o + 3] < SOLID) {
      if (data[o + 3] < 8) clear++;
      continue;
    }
    opaque++;
    const key = ((data[o] >> 3) << 10) | ((data[o + 1] >> 3) << 5) | (data[o + 2] >> 3);
    let bucket = buckets.get(key);
    if (!bucket) buckets.set(key, (bucket = [0, 0, 0, 0]));
    bucket[0] += data[o];
    bucket[1] += data[o + 1];
    bucket[2] += data[o + 2];
    bucket[3]++;
  }
  if (opaque < 64) return null;

  const clusters = [];
  for (const bucket of [...buckets.values()].sort((a, b) => b[3] - a[3])) {
    const mean = [bucket[0], bucket[1], bucket[2]].map((v) => v / bucket[3]);
    const home = clusters.find((cluster) => distance(cluster.seed, mean) < MERGE);
    if (home) home.count += bucket[3];
    else if (clusters.length < 64) clusters.push({ seed: mean, count: bucket[3] });
  }
  clusters.sort((a, b) => b.count - a.count);

  const main = [];
  for (const cluster of clusters) {
    if (cluster.count / opaque < MIN_SHARE) break;
    // Anti-aliased edges between two colours are not colours of their own.
    if (main.length >= 2 && onSegment(cluster.seed, main.map((c) => c.seed)) < 20) continue;
    main.push(cluster);
    if (main.length > maxColors) return null;
  }
  // A single opaque colour is an empty page, not a logo.
  if (main.length === 1 && clear === 0) return null;

  const seeds = main.map((c) => c.seed);
  const modes = main.map(() => new Map());
  let covered = 0;
  let pure = 0;
  for (let o = 0; o < data.length; o += 4) {
    if (data[o + 3] < SOLID) continue;
    nearest(data, o, seeds);
    if (nearD <= BLEND) covered++;
    if (nearB < 0 && nearD <= PURE) pure++;
    if (nearB < 0 && nearD <= 12) {
      const key = (data[o] << 16) | (data[o + 1] << 8) | data[o + 2];
      modes[nearA].set(key, (modes[nearA].get(key) ?? 0) + 1);
    }
  }
  if (covered / opaque < COVERAGE || pure / opaque < PURE_SHARE) return null;

  return seeds.map((seed, k) => {
    let best = null;
    let count = 0;
    for (const [key, n] of modes[k]) {
      if (n > count) {
        count = n;
        best = key;
      }
    }
    return best === null
      ? seed.map(Math.round)
      : [best >> 16, (best >> 8) & 255, best & 255];
  });
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, s) => [a[0] * s, a[1] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const unit = (a) => {
  const n = Math.hypot(a[0], a[1]) || 1;
  return [a[0] / n, a[1] / n];
};

function resample(loop) {
  const lengths = loop.map((p, i) => Math.hypot(...sub(loop[(i + 1) % loop.length], p)));
  const total = lengths.reduce((a, b) => a + b, 0);
  const count = Math.max(8, Math.round(total));
  const step = total / count;
  const result = [];
  let i = 0;
  let done = 0;
  for (let k = 0; k < count; k++) {
    while (done + lengths[i] < k * step) done += lengths[i++];
    const t = lengths[i] ? (k * step - done) / lengths[i] : 0;
    result.push(add(loop[i], mul(sub(loop[(i + 1) % loop.length], loop[i]), t)));
  }
  return result;
}

const bezier = (c, t) => {
  const u = 1 - t;
  return [0, 1].map(
    (a) => u * u * u * c[0][a] + 3 * u * u * t * c[1][a] + 3 * u * t * t * c[2][a] + t * t * t * c[3][a],
  );
};

// Least-squares cubic fit (Schneider), split at the worst point if needed.
function fit(points, left, right, tolerance, result) {
  const first = points[0];
  const last = points[points.length - 1];
  const chord = sub(last, first);
  const length = Math.hypot(chord[0], chord[1]);
  if (
    length > 0 &&
    points.every(
      (p) => Math.abs((p[0] - first[0]) * chord[1] - (p[1] - first[1]) * chord[0]) / length <= tolerance * 0.75,
    )
  ) {
    result.push(["L", last]);
    return;
  }
  if (points.length < 4) {
    result.push(["C", add(first, mul(left, length / 3)), add(last, mul(right, length / 3)), last]);
    return;
  }

  let u = [0];
  for (let i = 1; i < points.length; i++) {
    u.push(u[i - 1] + Math.hypot(...sub(points[i], points[i - 1])));
  }
  u = u.map((v) => v / u[u.length - 1]);
  let curve;
  let worst = points.length >> 1;
  for (let round = 0; round < 6; round++) {
    let c00 = 0;
    let c01 = 0;
    let c11 = 0;
    let x0 = 0;
    let x1 = 0;
    points.forEach((p, i) => {
      const t = u[i];
      const s = 1 - t;
      const b1 = 3 * s * s * t;
      const b2 = 3 * s * t * t;
      const a1 = mul(left, b1);
      const a2 = mul(right, b2);
      c00 += dot(a1, a1);
      c01 += dot(a1, a2);
      c11 += dot(a2, a2);
      const rest = sub(p, add(mul(first, s * s * s + b1), mul(last, t * t * t + b2)));
      x0 += dot(a1, rest);
      x1 += dot(a2, rest);
    });
    const det = c00 * c11 - c01 * c01;
    let alphaLeft = det ? (x0 * c11 - x1 * c01) / det : 0;
    let alphaRight = det ? (c00 * x1 - c01 * x0) / det : 0;
    if (alphaLeft < 1e-3 || alphaRight < 1e-3 || alphaLeft > length * 3 || alphaRight > length * 3) {
      alphaLeft = alphaRight = length / 3;
    }
    curve = [first, add(first, mul(left, alphaLeft)), add(last, mul(right, alphaRight)), last];
    let error = 0;
    points.forEach((p, i) => {
      const e = Math.hypot(...sub(bezier(curve, u[i]), p));
      if (e > error) {
        error = e;
        worst = i;
      }
    });
    if (error <= tolerance) {
      result.push(["C", curve[1], curve[2], last]);
      return;
    }
    u = u.map((t, i) => {
      const s = 1 - t;
      const q = sub(bezier(curve, t), points[i]);
      const d1 = [0, 1].map(
        (a) => 3 * s * s * (curve[1][a] - curve[0][a]) + 6 * s * t * (curve[2][a] - curve[1][a]) + 3 * t * t * (curve[3][a] - curve[2][a]),
      );
      const d2 = [0, 1].map(
        (a) => 6 * s * (curve[2][a] - 2 * curve[1][a] + curve[0][a]) + 6 * t * (curve[3][a] - 2 * curve[2][a] + curve[1][a]),
      );
      const denominator = dot(d1, d1) + dot(q, d2);
      return denominator ? Math.min(1, Math.max(0, t - dot(q, d1) / denominator)) : t;
    });
    for (let i = 1; i < u.length; i++) u[i] = Math.max(u[i], u[i - 1]);
  }
  worst = Math.min(points.length - 3, Math.max(2, worst));
  const middle = unit(
    sub(points[Math.max(0, worst - 3)], points[Math.min(points.length - 1, worst + 3)]),
  );
  fit(points.slice(0, worst + 1), left, middle, tolerance, result);
  fit(points.slice(worst), mul(middle, -1), right, tolerance, result);
}

function vectorise(loop, tolerance, reach) {
  let p = resample(loop);
  const n = p.length;
  const at = (i) => ((i % n) + n) % n;
  const span = Math.min(reach, Math.floor(n / 4));
  const turn = p.map((q, i) => {
    const a = unit(sub(q, p[at(i - span)]));
    const b = unit(sub(p[at(i + span)], q));
    return Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
  });
  const corners = [];
  for (let i = 0; i < n; i++) {
    if (turn[i] < (40 * Math.PI) / 180) continue;
    let peak = true;
    for (let k = -span; k <= span && peak; k++) {
      if (turn[at(i + k)] > turn[i] || (k < 0 && turn[at(i + k)] === turn[i])) peak = false;
    }
    if (peak) corners.push(i);
  }
  const fixed = new Set(corners);
  for (let round = 0; round < 4; round++) {
    p = p.map((q, i) =>
      fixed.has(i) ? q : [0, 1].map((a) => (p[at(i - 1)][a] + 2 * q[a] + p[at(i + 1)][a]) / 4),
    );
  }
  let breaks;
  if (corners.length > 1) breaks = corners;
  else if (corners.length === 1) breaks = [corners[0], at(corners[0] + (n >> 1))].sort((a, b) => a - b);
  else breaks = [0, n >> 1];
  const tangent = (i, direction) =>
    fixed.has(i)
      ? unit(sub(p[at(i + direction * Math.max(3, Math.min(span, 8)))], p[at(i + direction)]))
      : unit(mul(sub(p[at(i + 3)], p[at(i - 3)]), direction));
  const segments = [];
  for (let k = 0; k < breaks.length; k++) {
    const from = breaks[k];
    const to = breaks[(k + 1) % breaks.length];
    const count = at(to - from) || n;
    const piece = Array.from({ length: count + 1 }, (_, j) => p[at(from + j)]);
    fit(piece, tangent(from, 1), tangent(to, -1), tolerance, segments);
  }
  return [["M", p[breaks[0]]], ...segments, ["Z"]];
}

const hex = (color) => `#${color.map((v) => v.toString(16).padStart(2, "0")).join("")}`;

// `scale` turns trace pixels into output pixels. The SVG is cropped to the artwork.
export function traceLogo({ data, width: w, height: h }, colors, scale) {
  const n = w * h;
  const first = new Int8Array(n).fill(-1);
  const second = new Int8Array(n).fill(-1);
  const mix = new Float32Array(n);
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let i = 0; i < n; i++) {
    const alpha = data[i * 4 + 3];
    if (alpha <= 8) continue;
    const x = i % w;
    const y = (i - x) / w;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
    if (alpha < SOLID) continue;
    nearest(data, i * 4, colors);
    first[i] = nearA;
    second[i] = nearB;
    mix[i] = nearT;
  }
  if (x1 < 0) throw new Error("empty");

  const dominant = (i) => (second[i] >= 0 && mix[i] >= 0.5 ? second[i] : first[i]);

  // Soft edge pixels have unreliable colour: take it from the most solid neighbour.
  for (let i = 0; i < n; i++) {
    const alpha = data[i * 4 + 3];
    if (alpha === 0 || alpha >= SOLID) continue;
    const x = i % w;
    const y = (i - x) / w;
    let best = -1;
    let strongest = -1;
    for (let r = 1; r <= 3 && best < 0; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const X = x + dx;
          const Y = y + dy;
          if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
          const j = Y * w + X;
          const a = data[j * 4 + 3];
          if (a >= SOLID && a > strongest) {
            strongest = a;
            best = dominant(j);
          }
        }
      }
    }
    if (best < 0) {
      nearest(data, i * 4, colors);
      best = nearA;
    }
    first[i] = best;
  }

  const nearLayer = (x, y, layer) => {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const X = x + dx;
        const Y = y + dy;
        if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const j = Y * w + X;
        if (data[j * 4 + 3] > 127 && dominant(j) === layer) return true;
      }
    }
    return false;
  };

  function contours(layer) {
    const W = w + 2;
    const H = h + 2;
    const field = new Float32Array(W * H);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const alpha = data[i * 4 + 3];
        if (!alpha || first[i] < 0) continue;
        let value = first[i] === layer ? 1 - mix[i] : second[i] === layer ? mix[i] : 0;
        // Run under later colours by two pixels so no hairline gap shows between them.
        if (value < 1 && dominant(i) > layer && nearLayer(x, y, layer)) value = 1;
        if (value > 0) field[(y + 1) * W + x + 1] = (value * alpha) / 255;
      }
    }

    const links = new Map();
    const points = new Map();
    const edge = (x, y, vertical) => {
      const id = (y * W + x) * 2 + (vertical ? 1 : 0);
      if (!points.has(id)) {
        const a = field[y * W + x];
        const b = vertical ? field[(y + 1) * W + x] : field[y * W + x + 1];
        const t = (0.5 - a) / (b - a);
        points.set(id, vertical ? [x - 0.5, y - 0.5 + t] : [x - 0.5 + t, y - 0.5]);
      }
      return id;
    };
    const join = (a, b) => {
      if (!links.has(a)) links.set(a, []);
      if (!links.has(b)) links.set(b, []);
      links.get(a).push(b);
      links.get(b).push(a);
    };
    for (let y = 0; y < H - 1; y++) {
      for (let x = 0; x < W - 1; x++) {
        const tl = field[y * W + x] > 0.5;
        const tr = field[y * W + x + 1] > 0.5;
        const br = field[(y + 1) * W + x + 1] > 0.5;
        const bl = field[(y + 1) * W + x] > 0.5;
        if (tl === tr && tr === br && br === bl) continue;
        const cut = [];
        if (tl !== tr) cut.push(edge(x, y, false));
        if (tr !== br) cut.push(edge(x + 1, y, true));
        if (br !== bl) cut.push(edge(x, y + 1, false));
        if (bl !== tl) cut.push(edge(x, y, true));
        if (cut.length === 2) join(cut[0], cut[1]);
        else {
          const [top, right, bottom, left] = cut;
          const inside =
            (field[y * W + x] + field[y * W + x + 1] + field[(y + 1) * W + x] + field[(y + 1) * W + x + 1]) / 4 > 0.5;
          if (inside === tl) {
            join(top, right);
            join(bottom, left);
          } else {
            join(top, left);
            join(right, bottom);
          }
        }
      }
    }

    const seen = new Set();
    const loops = [];
    for (const start of links.keys()) {
      if (seen.has(start)) continue;
      const loop = [];
      let at = start;
      let from = null;
      while (!seen.has(at)) {
        seen.add(at);
        loop.push(points.get(at));
        const [a, b] = links.get(at);
        const next = a !== from && !seen.has(a) ? a : b;
        from = at;
        at = next;
      }
      let area = 0;
      loop.forEach((q, i) => {
        const r = loop[(i + 1) % loop.length];
        area += q[0] * r[1] - r[0] * q[1];
      });
      if (Math.abs(area / 2) >= MIN_AREA) loops.push(loop);
    }
    return loops;
  }

  const artWidth = x1 - x0 + 1;
  const artHeight = y1 - y0 + 1;
  const tolerance = Math.max(0.8, artWidth / 5000);
  const reach = Math.max(6, Math.round(artWidth / 800));
  const number = (v) => String(Math.round(v * 10) / 10);
  const point = (q) => `${number((q[0] - x0 + 0.5) * scale)} ${number((q[1] - y0 + 0.5) * scale)}`;

  let body = "";
  colors.forEach((color, layer) => {
    const d = contours(layer)
      .map((loop) =>
        vectorise(loop, tolerance, reach)
          .map(([op, ...pts]) => op + pts.map(point).join(" "))
          .join(""),
      )
      .join("");
    if (d) body += `<path fill="${hex(color)}" fill-rule="evenodd" d="${d}"/>`;
  });
  if (!body) throw new Error("empty");

  return {
    body,
    viewBox: `0 0 ${number(artWidth * scale)} ${number(artHeight * scale)}`,
    width: Math.max(1, Math.round(artWidth * scale)),
    height: Math.max(1, Math.round(artHeight * scale)),
  };
}
