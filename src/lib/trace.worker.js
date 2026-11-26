import ImageTracer from "imagetracerjs";
import { traceLogo } from "./logo-trace.js";

function tracePicture({ width, height, data, colors, scale }) {
  const options = ImageTracer.checkoptions({
    numberofcolors: colors,
    colorquantcycles: 3,
    pathomit: 4,
    roundcoords: 1,
    scale,
  });
  const traced = ImageTracer.imagedataToTracedata(
    { width, height, data },
    options,
  );

  let body = "";
  traced.layers.forEach((layer, layerIndex) => {
    // Nearly invisible layers come from the edges of transparent areas.
    if (traced.palette[layerIndex].a < 16) return;
    layer.forEach((path, pathIndex) => {
      if (path.isholepath) return;
      body += ImageTracer.svgpathstring(traced, layerIndex, pathIndex, options);
    });
  });

  return body.replace(/ opacity="1"/g, "").replace(/ +"/g, '"');
}

self.onmessage = (event) => {
  const message = event.data;
  if (message.palette) {
    try {
      self.postMessage({ logo: traceLogo(message, message.palette, message.scale) });
    } catch {
      self.postMessage({ logo: null });
    }
    return;
  }
  self.postMessage({ body: tracePicture(message) });
};
