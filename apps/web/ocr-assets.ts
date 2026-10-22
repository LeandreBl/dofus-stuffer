import { createReadStream, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { Plugin } from "vite";

// Self-hosts the OCR engine under /ocr/ (the site's CSP forbids CDNs), straight from node_modules:
// served by the dev server, emitted into the build, never written into the (read-only) sources.
const require = createRequire(import.meta.url);
const root = (name: string) => dirname(require.resolve(`${name}/package.json`));
const files: Record<string, () => string> = {
  "worker.min.js": () => join(root("tesseract.js"), "dist/worker.min.js"),
  // LSTM-only builds: the worker picks one by the browser's SIMD support.
  ...Object.fromEntries(["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"]
    .map((file) => [file, () => join(root("tesseract.js-core"), file)])),
  "fra.traineddata.gz": () => join(root("@tesseract.js-data/fra"), "4.0.0_best_int/fra.traineddata.gz"),
};

export function ocrAssets(): Plugin {
  return {
    name: "ocr-assets",
    configureServer(server) {
      server.middlewares.use("/ocr/", (req, res, next) => {
        const file = files[(req.url ?? "").slice(1).split("?")[0]];
        if (!file) return next();
        res.setHeader("Content-Type", file().endsWith(".js") ? "text/javascript" : "application/gzip");
        createReadStream(file()).pipe(res);
      });
    },
    generateBundle() {
      for (const [name, file] of Object.entries(files)) this.emitFile({ type: "asset", fileName: `ocr/${name}`, source: readFileSync(file()) });
    },
  };
}
