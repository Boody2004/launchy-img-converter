// Copies a PDF page's own shapes into SVG instead of tracing a picture of it.
// Anything it can't reproduce exactly throws, so the page is traced rather
// than saved with parts silently missing or wrong.

const unsupported = (reason) => {
  const error = new Error(`Unsupported PDF content: ${reason}`);
  error.name = "UnsupportedVector";
  throw error;
};

// pdf.js path data: a command code followed by its coordinates.
const PATH_COMMANDS = [
  ["M", 1],
  ["L", 1],
  ["C", 3],
  ["Q", 2],
  ["Z", 0],
];

const LINE_CAPS = ["butt", "round", "square"];
const LINE_JOINS = ["miter", "round", "bevel"];

// Applies `first`, then `second`.
const multiply = (first, second) => [
  first[0] * second[0] + first[1] * second[2],
  first[0] * second[1] + first[1] * second[3],
  first[2] * second[0] + first[3] * second[2],
  first[2] * second[1] + first[3] * second[3],
  first[4] * second[0] + first[5] * second[2] + second[4],
  first[4] * second[1] + first[5] * second[3] + second[5],
];

const apply = (m, x, y) => [
  x * m[0] + y * m[2] + m[4],
  x * m[1] + y * m[3] + m[5],
];

function parsePath(data, matrix) {
  const commands = [];
  for (let i = 0; i < data.length; ) {
    const command = PATH_COMMANDS[data[i++]];
    if (!command) unsupported("path data");
    const [letter, count] = command;
    const points = [];
    for (let p = 0; p < count; p++, i += 2) {
      points.push(apply(matrix, data[i], data[i + 1]));
    }
    // A browser hides a whole SVG path that doesn't start with a move, and some
    // fonts give the space letter a lone "close".
    if (!commands.length && letter !== "M") {
      if (letter === "Z") continue;
      unsupported("path data");
    }
    commands.push([letter, points]);
  }
  return commands;
}

const rectangle = (x0, y0, x1, y1, matrix) => [
  ["M", [apply(matrix, x0, y0)]],
  ["L", [apply(matrix, x1, y0)]],
  ["L", [apply(matrix, x1, y1)]],
  ["L", [apply(matrix, x0, y1)]],
  ["Z", []],
];

function bezierAt(points, t) {
  let current = points;
  while (current.length > 1) {
    current = current.slice(1).map((point, i) => current[i] + (point - current[i]) * t);
  }
  return current[0];
}

// Where a Bézier curve turns around on one axis.
function turningPoints(v) {
  let roots;
  if (v.length === 3) {
    const d = v[0] - 2 * v[1] + v[2];
    roots = d ? [(v[0] - v[1]) / d] : [];
  } else {
    const a = -v[0] + 3 * v[1] - 3 * v[2] + v[3];
    const b = 2 * (v[0] - 2 * v[1] + v[2]);
    const c = v[1] - v[0];
    if (Math.abs(a) < 1e-9) roots = b ? [-c / b] : [];
    else {
      const root = Math.sqrt(b * b - 4 * a * c);
      roots = [(-b + root) / (2 * a), (-b - root) / (2 * a)];
    }
  }
  return roots.filter((t) => t > 0 && t < 1);
}

function boundsOf(commands) {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  const include = (axis, value) => {
    box[axis] = Math.min(box[axis], value);
    box[axis + 2] = Math.max(box[axis + 2], value);
  };
  let from = null;
  let start = null;
  for (const [letter, points] of commands) {
    if (letter === "Z") {
      from = start;
      continue;
    }
    const end = points[points.length - 1];
    if (letter === "M") start = end;
    // A move with nothing drawn after it must not stretch the artwork box.
    else {
      for (const axis of [0, 1]) {
        include(axis, from[axis]);
        include(axis, end[axis]);
        if (points.length > 1) {
          const values = [from, ...points].map((point) => point[axis]);
          for (const t of turningPoints(values)) include(axis, bezierAt(values, t));
        }
      }
    }
    from = end;
  }
  return box;
}

const intersect = (a, b) => {
  const box = [
    Math.max(a[0], b[0]),
    Math.max(a[1], b[1]),
    Math.min(a[2], b[2]),
    Math.min(a[3], b[3]),
  ];
  return box[0] < box[2] && box[1] < box[3] ? box : null;
};

const EPSILON = 0.05;

const contains = (outer, inner) =>
  outer[0] <= inner[0] + EPSILON &&
  outer[1] <= inner[1] + EPSILON &&
  outer[2] >= inner[2] - EPSILON &&
  outer[3] >= inner[3] - EPSILON;

function isRectangle(commands) {
  const points = commands
    .filter(([letter]) => letter !== "Z")
    .flatMap(([letter, list]) => (letter === "C" || letter === "Q" ? [null] : list));
  if (points.includes(null)) return false;
  if (commands.filter(([letter]) => letter === "M").length !== 1) return false;
  const box = boundsOf(commands);
  const onCorner = ([x, y]) =>
    (Math.abs(x - box[0]) < EPSILON || Math.abs(x - box[2]) < EPSILON) &&
    (Math.abs(y - box[1]) < EPSILON || Math.abs(y - box[3]) < EPSILON);
  return (points.length === 4 || points.length === 5) && points.every(onCorner);
}

const number = (value) => String(Math.round(value * 100) / 100);

const pathString = (commands) =>
  commands
    .map(([letter, points]) =>
      letter + points.map(([x, y]) => `${number(x)} ${number(y)}`).join(" "),
    )
    .join("");

// How much the matrix enlarges a line width. Uneven scaling can't be copied.
function strokeScale([a, b, c, d]) {
  const x = Math.hypot(a, b);
  const y = Math.hypot(c, d);
  if (Math.abs(x - y) > x * 0.01 || Math.abs(a * c + b * d) > x * y * 0.01) {
    unsupported("unevenly scaled stroke");
  }
  return x;
}

export async function extractVector(
  page,
  { OPS, viewport, optionalContent },
) {
  const { fnArray, argsArray } = await page.getOperatorList();
  const names = new Map(Object.entries(OPS).map(([name, code]) => [code, name]));

  const pageBox = [0, 0, viewport.width, viewport.height];
  const clips = [];
  const gradients = [];
  const elements = [];

  let state = {
    matrix: viewport.transform,
    clip: null,
    fill: "#000000",
    stroke: "#000000",
    fillAlpha: 1,
    strokeAlpha: 1,
    lineWidth: 1,
    lineCap: 0,
    lineJoin: 0,
    miterLimit: 10,
    dash: [[], 0],
    font: null,
    fontSize: 0,
    charSpacing: 0,
    wordSpacing: 0,
    hScale: 1,
    leading: 0,
    rise: 0,
    textMode: 0,
  };
  const stack = [];
  const hidden = [];
  let pendingClip = null;
  let textMatrix = null;
  let cursor = [0, 0];
  let line = [0, 0];

  const visible = () => !hidden.includes(true);
  const save = () => stack.push({ ...state });
  const restore = () => {
    if (stack.length) state = stack.pop();
  };

  const addClip = (commands, rule) => {
    clips.push({
      commands,
      rule,
      parent: state.clip,
      box: boundsOf(commands),
      rect: isRectangle(commands),
    });
    state.clip = clips.length - 1;
  };

  // Drops clips that cut nothing off, and returns null for hidden shapes.
  const clipped = (bounds, clipId) => {
    let box = intersect(bounds, pageBox);
    let needed = box && contains(pageBox, bounds) ? null : "page";
    for (let id = clipId; box && id !== null; id = clips[id].parent) {
      const clip = clips[id];
      if (!clip.rect || !contains(clip.box, bounds)) needed = clipId;
      box = intersect(box, clip.box);
    }
    return box && { box, clip: needed };
  };

  const paint = (commands, { fill, stroke, evenodd }) => {
    if (!visible() || !commands.length) return;
    const attributes = [];
    let bounds = boundsOf(commands);

    const filled = fill && state.fillAlpha > 0;
    attributes.push(`fill="${filled ? state.fill : "none"}"`);
    if (filled && state.fillAlpha < 1) {
      attributes.push(`fill-opacity="${number(state.fillAlpha)}"`);
    }
    if (filled && evenodd) attributes.push('fill-rule="evenodd"');

    const stroked = stroke && state.strokeAlpha > 0;
    if (stroked) {
      if (state.lineWidth <= 0) unsupported("hairline stroke");
      const scale = strokeScale(state.matrix);
      const width = state.lineWidth * scale;
      attributes.push(`stroke="${state.stroke}"`, `stroke-width="${number(width)}"`);
      if (state.strokeAlpha < 1) {
        attributes.push(`stroke-opacity="${number(state.strokeAlpha)}"`);
      }
      if (state.lineCap) attributes.push(`stroke-linecap="${LINE_CAPS[state.lineCap]}"`);
      if (state.lineJoin) attributes.push(`stroke-linejoin="${LINE_JOINS[state.lineJoin]}"`);
      if (!state.lineJoin) attributes.push(`stroke-miterlimit="${number(state.miterLimit)}"`);
      const [dashes, phase] = state.dash;
      if (dashes.length) {
        attributes.push(
          `stroke-dasharray="${dashes.map((v) => number(v * scale)).join(" ")}"`,
          `stroke-dashoffset="${number(phase * scale)}"`,
        );
      }
      // Straight edges only need half the width; corners and caps reach further.
      const pad = (width / 2) * (isRectangle(commands) ? 1 : Math.SQRT2);
      bounds = [bounds[0] - pad, bounds[1] - pad, bounds[2] + pad, bounds[3] + pad];
    }

    if (!filled && !stroked) return;
    const result = clipped(bounds, state.clip);
    if (!result) return;
    elements.push({
      d: pathString(commands),
      attributes: attributes.join(" "),
      ...result,
      coversPage: filled && !stroked && isRectangle(commands) && contains(bounds, pageBox),
    });
  };

  const paintPath = (operation, commands) => {
    const name = names.get(operation);
    const fill = /fill/i.test(name);
    const stroke = /stroke/i.test(name);
    const closed = /^close/.test(name) ? [...commands, ["Z", []]] : commands;
    if (!fill && !stroke && name !== "endPath") unsupported(name);
    paint(closed, { fill, stroke, evenodd: /^(eo|closeEO)/.test(name) });
    if (pendingClip) {
      // A clip with an empty path hides everything that follows it.
      addClip(commands.length ? commands : rectangle(0, 0, 0, 0, state.matrix), pendingClip);
      pendingClip = null;
    }
  };

  const getObject = (id) => {
    const store = id.startsWith("g_") ? page.commonObjs : page.objs;
    return new Promise((resolve) => store.get(id, resolve));
  };

  const shade = async (id) => {
    if (!visible()) return;
    const [kind, type, bbox, stops, from, to, fromRadius, toRadius] =
      await getObject(id);
    if (kind !== "RadialAxial" || bbox) unsupported("shading");
    if (state.fillAlpha === 0) return;

    gradients.push({
      type,
      from,
      to,
      fromRadius,
      toRadius,
      stops,
      matrix: state.matrix,
    });

    const clip = state.clip === null ? null : clips[state.clip];
    const commands = clip
      ? clip.commands
      : rectangle(0, 0, viewport.width, viewport.height, [1, 0, 0, 1, 0, 0]);
    const result = clipped(boundsOf(commands), clip ? clip.parent : null);
    if (!result) return;
    const attributes = [`fill="url(#g${gradients.length - 1})"`];
    if (clip?.rule === "evenodd") attributes.push('fill-rule="evenodd"');
    if (state.fillAlpha < 1) attributes.push(`fill-opacity="${number(state.fillAlpha)}"`);
    elements.push({
      d: pathString(commands),
      attributes: attributes.join(" "),
      ...result,
      coversPage: false,
    });
  };

  const moveText = (x, y) => {
    line = [line[0] + x, line[1] + y];
    cursor = [...line];
  };

  const showText = (glyphs) => {
    const { font, fontSize, textMode } = state;
    if (textMode !== 0 && textMode !== 3) unsupported("outlined or clipping text");
    if (!font || font.isType3Font || font.missingFile || font.vertical || font.isInvalidPDFjsFont) {
      unsupported("font that is not embedded as outlines");
    }
    const matrix = textMatrix ? multiply(textMatrix, state.matrix) : state.matrix;
    const commands = [];
    let x = 0;
    for (const glyph of glyphs) {
      if (typeof glyph === "number") {
        x -= (glyph * fontSize) / 1000;
        continue;
      }
      if (textMode === 0 && visible() && !glyph.isSpace) {
        const key = `${font.loadedName}_path_${glyph.fontChar}`;
        if (!glyph.isInFont || glyph.accent || !page.commonObjs.has(key)) {
          unsupported("missing letter outline");
        }
        const outline = page.commonObjs.get(key)?.path;
        if (outline?.length) {
          // The cursor already includes horizontal scaling for earlier text.
          const place = [
            fontSize * state.hScale,
            0,
            0,
            fontSize,
            cursor[0] + x * state.hScale,
            cursor[1] + state.rise,
          ];
          commands.push(...parsePath(outline, multiply(place, matrix)));
        }
      }
      const spacing = (glyph.isSpace ? state.wordSpacing : 0) + state.charSpacing;
      x += glyph.width * fontSize * font.fontMatrix[0] + spacing;
    }
    cursor = [cursor[0] + x * state.hScale, cursor[1]];
    paint(commands, { fill: true });
  };

  const setGraphicsState = (entries) => {
    for (const [key, value] of entries) {
      if (key === "ca") state.fillAlpha = value;
      else if (key === "CA") state.strokeAlpha = value;
      else if (key === "LW") state.lineWidth = value;
      else if (key === "LC") state.lineCap = value;
      else if (key === "LJ") state.lineJoin = value;
      else if (key === "ML") state.miterLimit = value;
      else if (key === "D") state.dash = value;
      else if (key === "BM") {
        if (value !== "source-over") unsupported("blend mode");
      } else if (key === "SMask") {
        if (value) unsupported("soft mask");
      } else if (key !== "RI" && key !== "FL") unsupported(`graphics state ${key}`);
    }
  };

  const handlers = {
    dependency() {},
    beginCompat() {},
    endCompat() {},
    setRenderingIntent() {},
    setFlatness() {},
    // They only say which colour space follows; colours arrive as RGB.
    setFillColorSpace() {},
    setStrokeColorSpace() {},

    beginMarkedContent: () => hidden.push(false),
    beginMarkedContentProps: ([tag, properties]) =>
      hidden.push(tag === "OC" && !optionalContent.isVisible(properties)),
    endMarkedContent: () => hidden.pop(),

    save,
    restore,
    transform: (matrix) => {
      state.matrix = multiply(matrix, state.matrix);
    },
    setGState: ([entries]) => setGraphicsState(entries),

    setFillRGBColor: ([color]) => {
      state.fill = color;
    },
    setStrokeRGBColor: ([color]) => {
      state.stroke = color;
    },
    setLineWidth: ([value]) => {
      state.lineWidth = value;
    },
    setLineCap: ([value]) => {
      state.lineCap = value;
    },
    setLineJoin: ([value]) => {
      state.lineJoin = value;
    },
    setMiterLimit: ([value]) => {
      state.miterLimit = value;
    },
    setDash: (value) => {
      state.dash = value;
    },

    clip: () => {
      pendingClip = "nonzero";
    },
    eoClip: () => {
      pendingClip = "evenodd";
    },
    constructPath: ([operation, [data]]) =>
      paintPath(operation, data ? parsePath(data, state.matrix) : []),
    shadingFill: ([id]) => shade(id),

    paintFormXObjectBegin: ([matrix, bbox]) => {
      save();
      if (matrix) state.matrix = multiply(matrix, state.matrix);
      if (bbox) addClip(rectangle(...bbox, state.matrix), "nonzero");
    },
    paintFormXObjectEnd: restore,

    // A fully opaque, normal group looks the same when its shapes are copied.
    beginGroup: ([group]) => {
      if (group.smask || group.hasSoftMask || group.knockout || state.fillAlpha !== 1) {
        unsupported("transparency group");
      }
      save();
    },
    endGroup: restore,

    beginText: () => {
      textMatrix = null;
      cursor = [0, 0];
      line = [0, 0];
    },
    endText() {},
    setFont: ([id, size]) => {
      if (size < 0) unsupported("mirrored text");
      state.font = page.commonObjs.get(id);
      state.fontSize = size;
    },
    setCharSpacing: ([value]) => {
      state.charSpacing = value;
    },
    setWordSpacing: ([value]) => {
      state.wordSpacing = value;
    },
    setHScale: ([value]) => {
      state.hScale = value / 100;
    },
    setLeading: ([value]) => {
      state.leading = -value;
    },
    setTextRise: ([value]) => {
      state.rise = value;
    },
    setTextRenderingMode: ([value]) => {
      state.textMode = value;
    },
    setTextMatrix: ([matrix]) => {
      textMatrix = Array.from(matrix);
      cursor = [0, 0];
      line = [0, 0];
    },
    moveText: ([x, y]) => moveText(x, y),
    setLeadingMoveText: ([x, y]) => {
      state.leading = y;
      moveText(x, y);
    },
    nextLine: () => moveText(0, state.leading),
    showText: ([glyphs]) => showText(glyphs),
  };

  for (let i = 0; i < fnArray.length; i++) {
    const name = names.get(fnArray[i]);
    if (!Object.hasOwn(handlers, name)) unsupported(name);
    await handlers[name](argsArray[i] ?? []);
  }
  if (!elements.length) unsupported("empty page");

  return { pageBox, elements, clips, gradients };
}

function gradientMarkup(gradient, index) {
  const { type, from, to, fromRadius, toRadius, stops, matrix } = gradient;
  const common = `id="g${index}" gradientUnits="userSpaceOnUse" gradientTransform="matrix(${Array.from(matrix, (v) => Math.round(v * 1e6) / 1e6).join(" ")})"`;
  const body = stops
    .map(([offset, color]) => `<stop offset="${Math.round(offset * 1e4) / 1e4}" stop-color="${color}"/>`)
    .join("");
  return type === "axial"
    ? `<linearGradient ${common} x1="${from[0]}" y1="${from[1]}" x2="${to[0]}" y2="${to[1]}">${body}</linearGradient>`
    : `<radialGradient ${common} fx="${from[0]}" fy="${from[1]}" fr="${fromRadius}" cx="${to[0]}" cy="${to[1]}" r="${toRadius}">${body}</radialGradient>`;
}

// Returns the SVG body, cropped to what is actually drawn.
export function buildVector(model, { transparent }) {
  const { pageBox, clips, gradients } = model;
  let { elements } = model;
  const hasBackground = elements.length > 1 && elements[0].coversPage;
  let background = null;
  if (transparent) {
    background = hasBackground ? "removed" : "transparent";
    if (hasBackground) elements = elements.slice(1);
  }

  const usedClips = new Set();
  const useClip = (id) => {
    for (let at = id; at !== null && !usedClips.has(at); at = clips[at].parent) {
      usedClips.add(at);
    }
  };
  let usesPageClip = false;
  const usedGradients = new Set();
  const box = [Infinity, Infinity, -Infinity, -Infinity];

  const shapes = elements
    .map((element) => {
      for (const axis of [0, 1]) {
        box[axis] = Math.min(box[axis], element.box[axis]);
        box[axis + 2] = Math.max(box[axis + 2], element.box[axis + 2]);
      }
      const gradient = element.attributes.match(/url\(#g(\d+)\)/);
      if (gradient) usedGradients.add(Number(gradient[1]));
      let clip = "";
      if (element.clip === "page") {
        usesPageClip = true;
        clip = ' clip-path="url(#page)"';
      } else if (element.clip !== null) {
        useClip(element.clip);
        clip = ` clip-path="url(#c${element.clip})"`;
      }
      return `<path ${element.attributes}${clip} d="${element.d}"/>`;
    })
    .join("");

  const definitions = [
    ...[...usedGradients].map((index) => gradientMarkup(gradients[index], index)),
    ...[...usedClips]
      .sort((a, b) => a - b)
      .map((id) => {
        const { commands, rule, parent } = clips[id];
        const nested = parent === null ? "" : ` clip-path="url(#c${parent})"`;
        const evenodd = rule === "evenodd" ? ' clip-rule="evenodd"' : "";
        return `<clipPath id="c${id}"${nested}><path${evenodd} d="${pathString(commands)}"/></clipPath>`;
      }),
    ...(usesPageClip
      ? [`<clipPath id="page"><path d="M0 0H${number(pageBox[2])}V${number(pageBox[3])}H0Z"/></clipPath>`]
      : []),
  ].join("");

  const width = box[2] - box[0];
  const height = box[3] - box[1];
  return {
    body: `${definitions ? `<defs>${definitions}</defs>` : ""}${shapes}`,
    viewBox: [box[0], box[1], width, height].map(number).join(" "),
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
    background,
  };
}
