import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import pdfAssetsPlugin from "./plugins/pdf-assets.js";
import seoPlugin from "./plugins/seo.js";

export default defineConfig({
  plugins: [react(), tailwindcss(), seoPlugin(), pdfAssetsPlugin()],
  optimizeDeps: {
    exclude: ["@jsquash/webp"],
  },
  worker: {
    format: "es",
  },
});
