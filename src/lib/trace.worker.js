import ImageTracer from "imagetracerjs";

self.onmessage = (event) => {
  const { width, height, data, colors, scale } = event.data;
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
    if (traced.palette[layerIndex].a === 0) return;
    layer.forEach((path, pathIndex) => {
      if (path.isholepath) return;
      body += ImageTracer.svgpathstring(traced, layerIndex, pathIndex, options);
    });
  });

  self.postMessage(body.replace(/ opacity="1"/g, "").replace(/ +"/g, '"'));
};
