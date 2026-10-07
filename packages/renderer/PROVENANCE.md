# Native sprite renderer

Browser build of [PyDofus/d3-ts-renderer](https://github.com/PyDofus/d3-ts-renderer), commit d9c78be8eafab147459c639fe2fd01dec0ecd863.

Upstream usage restrictions are preserved in UPSTREAM.md. This package renders equipped items in the free optimizer. It does not provide a cosmetic skin builder. Game models remain the property of Ankama.

Rebuild from the pinned source with tsup 8.5.1: `tsup src/index.ts --format esm --target es2022 --platform browser --dts --out-dir browser-lib --external mediabunny`. Copy index.js and index.d.ts into lib.
