const HEIC = /\.(heic|heif)$/i;

const isHeic = (file) =>
  /image\/hei[cf]/i.test(file.type) || HEIC.test(file.name);

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
  try {
    return fromBitmap(await createImageBitmap(file));
  } catch {
    // Some browsers can't decode SVG or HEIC with createImageBitmap.
  }

  try {
    return await loadImageElement(file);
  } catch (error) {
    if (!isHeic(file)) throw error;
  }

  const { heicTo } = await import("heic-to");
  return fromBitmap(await heicTo({ blob: file, type: "bitmap" }));
}
