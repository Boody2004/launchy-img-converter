import { svgDocument } from "./encode.js";

export function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function outputBlob(result, alt) {
  if (result.format === "webp") return result.blob;
  return new Blob([svgDocument({ ...result, title: alt.trim() })], {
    type: "image/svg+xml",
  });
}

export async function zipBlob(entries, manifest) {
  const { zipSync, strToU8 } = await import("fflate");
  const files = {};
  for (const { name, blob, compress } of entries) {
    files[name] = [
      new Uint8Array(await blob.arrayBuffer()),
      { level: compress ? 6 : 0 },
    ];
  }
  files["alt-text.json"] = strToU8(JSON.stringify(manifest, null, 2));
  return new Blob([zipSync(files)], { type: "application/zip" });
}
