import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = new URL("../node_modules/pdfjs-dist/", import.meta.url);
const folders = ["cmaps", "standard_fonts", "wasm", "iccs"];

export default function pdfAssetsPlugin() {
  const files = new Map(
    folders.flatMap((folder) =>
      readdirSync(new URL(`${folder}/`, source)).map((name) => [
        `pdfjs/${folder}/${name}`,
        fileURLToPath(new URL(`${folder}/${name}`, source)),
      ]),
    ),
  );

  return {
    name: "pdf-assets",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = request.url.split("?")[0].slice(1);
        const file = files.get(path);
        if (!file) return next();
        if (path.endsWith(".wasm")) {
          response.setHeader("Content-Type", "application/wasm");
        } else if (path.endsWith(".js")) {
          response.setHeader("Content-Type", "text/javascript");
        }
        response.end(readFileSync(file));
      });
    },
    generateBundle() {
      for (const [fileName, file] of files) {
        this.emitFile({ type: "asset", fileName, source: readFileSync(file) });
      }
    },
  };
}
